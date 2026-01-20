import { Router } from "express";
import { db } from "../db";
import { sequences, sequenceSteps, sequenceEnrollments, leads, type Sequence, type SequenceStep, type SequenceEnrollment } from "@shared/schema";
import { eq, and, lte, isNull } from "drizzle-orm";
import { isAuthenticated, requireRole } from "../replit_integrations/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { getGmailClient, sendEmail } from "../services/gmail";
import { log } from "../lib/logger";

export const sequencesRouter = Router();

// === SCHEDULER LOGIC ===

async function processSequences() {
    try {
        const now = new Date();

        // Find active enrollments due for execution
        const enrollments = await db
            .select()
            .from(sequenceEnrollments)
            .where(
                and(
                    eq(sequenceEnrollments.status, "active"),
                    lte(sequenceEnrollments.nextExecutionAt, now)
                )
            );

        if (enrollments.length === 0) return;

        log(`INFO: processing ${enrollments.length} sequence enrollments`);

        const gmail = await getGmailClient(); // Re-use connection

        for (const enrollment of enrollments) {
            await executeStep(enrollment, gmail);
        }
    } catch (error: any) {
        log(`ERROR: Sequence scheduler failed: ${error.message}`);
    }
}

async function executeStep(enrollment: SequenceEnrollment, gmail: any) {
    try {
        // Get current step
        const [step] = await db
            .select()
            .from(sequenceSteps)
            .where(
                and(
                    eq(sequenceSteps.sequenceId, enrollment.sequenceId),
                    eq(sequenceSteps.stepOrder, enrollment.currentStep || 1)
                )
            );

        if (!step) {
            // No more steps, mark complete
            await db
                .update(sequenceEnrollments)
                .set({ status: "completed", completedAt: new Date(), nextExecutionAt: null })
                .where(eq(sequenceEnrollments.id, enrollment.id));
            return;
        }

        // Execute Step
        if (step.type === 'email') {
            const [lead] = await db.select().from(leads).where(eq(leads.id, enrollment.leadId));
            if (!lead || !lead.contactEmail) {
                // Fail if no email
                await db.update(sequenceEnrollments).set({ status: "paused" }).where(eq(sequenceEnrollments.id, enrollment.id));
                return;
            }

            // TODO: Replace variables in subject/content ({{clientName}}, etc.)
            const subject = step.subject?.replace(/{{clientName}}/g, lead.clientName) || "Follow up";
            const content = step.content?.replace(/{{clientName}}/g, lead.clientName) || "";

            await sendEmail(gmail, lead.contactEmail, subject, content);
            log(`INFO: Sent sequence email to ${lead.clientName} (Step ${step.stepOrder})`);
        }

        // Move to next step
        const nextStepOrder = (enrollment.currentStep || 1) + 1;
        const [nextStep] = await db
            .select()
            .from(sequenceSteps)
            .where(
                and(
                    eq(sequenceSteps.sequenceId, enrollment.sequenceId),
                    eq(sequenceSteps.stepOrder, nextStepOrder)
                )
            );

        if (nextStep) {
            // Schedule next execution
            const nextRun = new Date();
            nextRun.setDate(nextRun.getDate() + (nextStep.delayDays || 1));

            await db.update(sequenceEnrollments).set({
                currentStep: nextStepOrder,
                nextExecutionAt: nextRun
            }).where(eq(sequenceEnrollments.id, enrollment.id));
        } else {
            // Completed
            await db.update(sequenceEnrollments).set({
                status: "completed",
                completedAt: new Date(),
                nextExecutionAt: null
            }).where(eq(sequenceEnrollments.id, enrollment.id));
        }

    } catch (error: any) {
        log(`ERROR: Failed to execute sequence step for enrollment ${enrollment.id}: ${error.message}`);
        // Optional: Pause enrollment on error
    }
}

// Initialize Scheduler
let schedulerStarted = false;
export function initSequenceScheduler() {
    if (schedulerStarted) return;
    schedulerStarted = true;
    // Run every 60 seconds
    setInterval(processSequences, 60 * 1000);
    log("INFO: Sequence scheduler started");
}

// === ROUTES ===

// Get All Sequences
sequencesRouter.get("/api/sequences", isAuthenticated, asyncHandler(async (req, res) => {
    const all = await db.select().from(sequences).orderBy(sequences.name);
    res.json(all);
}));

// Create Sequence
sequencesRouter.post("/api/sequences", isAuthenticated, requireRole("ceo", "sales", "marketing"), asyncHandler(async (req, res) => {
    const [newSeq] = await db.insert(sequences).values(req.body).returning();
    res.json(newSeq);
}));

// Get Steps
sequencesRouter.get("/api/sequences/:id/steps", isAuthenticated, asyncHandler(async (req, res) => {
    const steps = await db
        .select()
        .from(sequenceSteps)
        .where(eq(sequenceSteps.sequenceId, parseInt(req.params.id)))
        .orderBy(sequenceSteps.stepOrder);
    res.json(steps);
}));

// Add Step
sequencesRouter.post("/api/sequences/:id/steps", isAuthenticated, requireRole("ceo", "sales", "marketing"), asyncHandler(async (req, res) => {
    const sequenceId = parseInt(req.params.id);
    const [newStep] = await db.insert(sequenceSteps).values({ ...req.body, sequenceId }).returning();
    res.json(newStep);
}));

// Enroll Lead
sequencesRouter.post("/api/leads/:leadId/enroll", isAuthenticated, requireRole("ceo", "sales"), asyncHandler(async (req, res) => {
    const leadId = parseInt(req.params.leadId);
    const { sequenceId } = req.body;

    // Check if already enrolled
    const [existing] = await db
        .select()
        .from(sequenceEnrollments)
        .where(and(
            eq(sequenceEnrollments.leadId, leadId),
            eq(sequenceEnrollments.sequenceId, sequenceId),
            eq(sequenceEnrollments.status, "active")
        ));

    if (existing) {
        return res.status(400).json({ message: "Lead is already enrolled in this active sequence" });
    }

    // Get first step delay
    const [firstStep] = await db
        .select()
        .from(sequenceSteps)
        .where(and(eq(sequenceSteps.sequenceId, sequenceId), eq(sequenceSteps.stepOrder, 1)));

    const startDelay = firstStep?.delayDays || 0;
    const nextRun = new Date();
    if (startDelay > 0) nextRun.setDate(nextRun.getDate() + startDelay);

    const [enrollment] = await db.insert(sequenceEnrollments).values({
        leadId,
        sequenceId,
        currentStep: 1,
        status: "active",
        nextExecutionAt: nextRun, // If 0 delay, runs immediately (next tick) or now? Scheduler picks up <= now.
    }).returning();

    res.json(enrollment);
}));
