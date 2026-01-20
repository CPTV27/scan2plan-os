import type { Express, Request, Response } from "express";
import { isAuthenticated, requireRole } from "../replit_integrations/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { log } from "../lib/logger";
import { storage } from "../storage";
import { db } from "../db";
import { aiAnalytics, cpqConversations, dealPredictions, projectEmbeddings } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  analyzeProjectScope,
  analyzeDeal,
  extractFromDocument,
  processCPQChat,
  generateProposal,
  findSimilarProjects,
  createProjectSummary,
  findMatchingCaseStudies,
  getAIContext,
  formatContextForPrompt,
  aiClient,
  type ChatMessage,
  type ExtractedCPQData,
} from "../services/ai";
import { checkProposalGates, calculateMarginFromQuote } from "../lib/profitabilityGates";

export function registerAIRoutes(app: Express) {
  // Check if AI is configured
  app.get("/api/ai/status", isAuthenticated, asyncHandler(async (req, res) => {
    res.json({
      enabled: aiClient.isConfigured(),
      features: {
        scopingAssistant: true,
        documentIntelligence: true,
        dealIntelligence: true,
        naturalLanguageCPQ: true,
        proposalGenerator: true,
        projectMatcher: true,
      },
    });
  }));

  // Feature 1: Intelligent Project Scoping Assistant
  app.post("/api/cpq/analyze-project", isAuthenticated, requireRole("ceo", "sales"), asyncHandler(async (req, res) => {
    const startTime = Date.now();
    const { description, address, clientName, projectName, notes, leadId } = req.body;
    const user = req.user as any;

    const result = await analyzeProjectScope({
      description,
      address,
      clientName,
      projectName,
      notes,
    });

    // Track analytics
    await db.insert(aiAnalytics).values({
      feature: "scoping",
      userId: user?.id?.toString() || user?.claims?.email,
      leadId: leadId ? Number(leadId) : null,
      action: "generated",
      timeTakenMs: result.analysisTime,
      metadata: { suggestionCount: result.suggestions.length, confidence: result.overallConfidence },
    });

    log(`[AI Scoping] Generated ${result.suggestions.length} suggestions in ${Date.now() - startTime}ms`);
    res.json(result);
  }));

  // Feature 2: Enhanced Document Extraction (RFP Processor)
  app.post("/api/documents/analyze", isAuthenticated, requireRole("ceo", "sales"), asyncHandler(async (req, res) => {
    const { content, documentType } = req.body;
    const user = req.user as any;

    if (!content || typeof content !== "string") {
      return res.status(400).json({ error: "Document content is required" });
    }

    const validTypes = ["rfp", "sow", "specification", "drawing", "other"];
    const type = validTypes.includes(documentType) ? documentType : "other";

    const result = await extractFromDocument(content, type);

    // Track analytics
    await db.insert(aiAnalytics).values({
      feature: "document",
      userId: user?.id?.toString() || user?.claims?.email,
      action: "generated",
      timeTakenMs: result.analysisTime,
      metadata: { documentType: type, riskFlagsCount: result.riskFlags.length },
    });

    res.json(result);
  }));

  // Feature 3: Predictive Deal Intelligence
  app.get("/api/leads/:id/intelligence", isAuthenticated, requireRole("ceo", "sales"), asyncHandler(async (req, res) => {
    const leadId = Number(req.params.id);
    const user = req.user as any;

    const lead = await storage.getLead(leadId);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // Get historical deals for context
    const allLeads = await storage.getLeads();
    const historicalDeals = allLeads.filter(
      (l) => l.id !== leadId && (l.dealStage === "Closed Won" || l.dealStage === "Closed Lost")
    );

    const result = await analyzeDeal(lead, historicalDeals);

    // Store prediction for accuracy tracking
    await db.insert(dealPredictions).values({
      leadId,
      predictedProbability: result.winProbability,
      predictedOutcome: result.winProbability >= 50 ? "won" : "lost",
    });

    // Track analytics
    await db.insert(aiAnalytics).values({
      feature: "intelligence",
      userId: user?.id?.toString() || user?.claims?.email,
      leadId,
      action: "generated",
      timeTakenMs: result.analysisTime,
      metadata: { winProbability: result.winProbability, risksCount: result.risks.length },
    });

    res.json(result);
  }));

  // Feature 4: Natural Language CPQ Interface
  app.post("/api/cpq/chat", isAuthenticated, requireRole("ceo", "sales"), asyncHandler(async (req, res) => {
    const { message, conversationId, leadId } = req.body;
    const user = req.user as any;
    const userId = user?.id?.toString() || user?.claims?.email;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    // Get or create conversation
    let conversation: any = null;
    let conversationHistory: ChatMessage[] = [];
    let currentData: ExtractedCPQData = {};

    if (conversationId) {
      const [existing] = await db.select().from(cpqConversations).where(eq(cpqConversations.id, Number(conversationId)));
      if (existing) {
        conversation = existing;
        conversationHistory = (existing.messages as ChatMessage[]) || [];
        currentData = (existing.extractedData as ExtractedCPQData) || {};
      }
    }

    // Process the chat message
    const result = await processCPQChat(message, conversationHistory, currentData);

    // Update conversation history
    const newMessages: ChatMessage[] = [
      ...conversationHistory,
      { role: "user", content: message, timestamp: new Date() },
      { role: "assistant", content: result.response, timestamp: new Date() },
    ];

    // Save or update conversation
    if (conversation) {
      await db.update(cpqConversations)
        .set({
          messages: newMessages,
          extractedData: result.extractedData,
          updatedAt: new Date(),
        })
        .where(eq(cpqConversations.id, conversation.id));
    } else {
      const [newConv] = await db.insert(cpqConversations).values({
        leadId: leadId ? Number(leadId) : null,
        userId,
        messages: newMessages,
        extractedData: result.extractedData,
        status: "active",
      }).returning();
      conversation = newConv;
    }

    res.json({
      ...result,
      conversationId: conversation?.id || null,
    });
  }));

  // Create quote from CPQ conversation
  app.post("/api/cpq/chat/create-quote", isAuthenticated, requireRole("ceo", "sales"), asyncHandler(async (req, res) => {
    const { conversationId } = req.body;

    if (!conversationId) {
      return res.status(400).json({ error: "Conversation ID is required" });
    }

    const [conversation] = await db.select().from(cpqConversations).where(eq(cpqConversations.id, Number(conversationId)));
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const extractedData = conversation.extractedData as ExtractedCPQData;
    if (!extractedData) {
      return res.status(400).json({ error: "No data extracted from conversation" });
    }

    // Normalize disciplines - ensure it's an array
    let disciplines: string[] = ["architecture"];
    if (Array.isArray(extractedData.disciplines)) {
      disciplines = extractedData.disciplines;
    } else if (typeof extractedData.disciplines === "string") {
      disciplines = [extractedData.disciplines];
    }

    // Determine area kind based on buildingType (14-15 or legacy identifiers = landscape, others = standard)
    const buildingType = extractedData.buildingType || "1";
    // Coerce to string for comparison (handles both numeric and string values)
    const buildingTypeStr = String(buildingType);
    const isLandscape = buildingTypeStr === "14" || buildingTypeStr === "15" ||
      buildingTypeStr === "landscape_built" || buildingTypeStr === "landscape_natural";
    const areaKind = isLandscape ? "landscape" : "standard";

    // Normalize dispatch location to uppercase for legacy system compatibility
    const rawDispatch = extractedData.dispatchLocation || "WOODSTOCK";
    const dispatchLocation = typeof rawDispatch === 'string' ? rawDispatch.toUpperCase() : "WOODSTOCK";

    // Create quote from extracted data
    const quoteData = {
      leadId: conversation.leadId,
      quoteNumber: `Q-${Date.now()}`,
      projectName: extractedData.projectName || "Untitled Quote",
      projectAddress: extractedData.projectAddress || "Address TBD",
      typeOfBuilding: buildingType,
      areas: [{
        id: "1",
        name: "Area 1",
        kind: areaKind as "standard" | "landscape",
        buildingType,
        squareFeet: extractedData.squareFeet?.toString() || "",
        lod: extractedData.lod || "300",
        scope: extractedData.scope || "full",
        disciplines,
      }] as any,
      dispatchLocation,
      notes: extractedData.notes || "",
    };

    const quote = await storage.createCpqQuote(quoteData);

    // Update conversation with quote reference
    await db.update(cpqConversations)
      .set({
        quoteId: quote.id,
        status: "converted",
        updatedAt: new Date(),
      })
      .where(eq(cpqConversations.id, conversation.id));

    res.json({ quote, conversationId });
  }));

  // Feature 5: AI-Powered Proposal Generator
  app.post("/api/proposals/generate", isAuthenticated, requireRole("ceo", "sales"), asyncHandler(async (req, res) => {
    const { leadId, template, sections, persona, caseStudies } = req.body;
    const user = req.user as any;

    if (!leadId) {
      return res.status(400).json({ error: "Lead ID is required" });
    }

    const lead = await storage.getLead(Number(leadId));
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // Get latest CPQ quote to check margin
    const quotes = await storage.getCpqQuotesByLead(Number(leadId));
    const latestQuote = quotes.length > 0 ? quotes[quotes.length - 1] : null;
    const quotePricing = latestQuote?.pricingBreakdown as { totalClientPrice?: number; totalUpteamCost?: number } | null;

    // Check profitability gates
    const gateResults = checkProposalGates(lead, quotePricing ? { pricingBreakdown: quotePricing } : null);

    // Hard gates - block proposal generation
    if (!gateResults.gmGate.passed) {
      log(`[Proposal Gate] GM gate blocked for lead ${leadId}: ${gateResults.gmGate.message}`);
      return res.status(403).json({
        error: gateResults.gmGate.code,
        message: gateResults.gmGate.message,
        details: gateResults.gmGate.details,
      });
    }

    // Estimator card gate is a soft warning for backwards compatibility
    if (gateResults.estimatorCardGate.code === "ESTIMATOR_CARD_RECOMMENDED") {
      log(`[Proposal Gate] Tier A lead ${leadId} missing estimator card (soft warning)`);
      // Add to warnings but don't block
    }

    const validTemplates = ["technical", "executive", "standard"];
    const templateType = validTemplates.includes(template) ? template : "standard";

    const result = await generateProposal(lead, {
      template: templateType as "technical" | "executive" | "standard",
      sections,
      caseStudies,
      persona,
    });

    // Include any soft warnings in response
    if (gateResults.warnings.length > 0) {
      (result as any).warnings = gateResults.warnings;
    }

    // Track analytics
    await db.insert(aiAnalytics).values({
      feature: "proposal",
      userId: user?.id?.toString() || user?.claims?.email,
      leadId: Number(leadId),
      action: "generated",
      timeTakenMs: result.analysisTime,
      metadata: { template: templateType, sectionCount: result.sections.length, wordCount: result.metadata.wordCount },
    });

    res.json(result);
  }));

  // Feature 6: Smart Project Matching
  app.get("/api/projects/similar/:leadId", isAuthenticated, requireRole("ceo", "sales"), asyncHandler(async (req, res) => {
    const leadId = Number(req.params.leadId);
    const useEmbeddings = req.query.embeddings === "true";
    const user = req.user as any;

    const lead = await storage.getLead(leadId);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const allLeads = await storage.getLeads();

    const result = await findSimilarProjects(lead, allLeads, {
      useEmbeddings,
      maxResults: 5,
    });

    // Track analytics
    await db.insert(aiAnalytics).values({
      feature: "matching",
      userId: user?.id?.toString() || user?.claims?.email,
      leadId,
      action: "generated",
      timeTakenMs: result.analysisTime,
      metadata: { similarProjectsCount: result.similarProjects.length, useEmbeddings },
    });

    res.json(result);
  }));

  // Recommend case studies for a lead
  app.get("/api/case-studies/recommend/:leadId", isAuthenticated, requireRole("ceo", "sales"), asyncHandler(async (req, res) => {
    const leadId = Number(req.params.leadId);

    const lead = await storage.getLead(leadId);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const allLeads = await storage.getLeads();
    const result = await findMatchingCaseStudies(lead, 3);

    res.json({
      recommendations: result.recommendations,
      pricingBenchmarks: result.pricingBenchmarks,
    });
  }));

  // Store project embedding for future matching
  app.post("/api/projects/embed/:leadId", isAuthenticated, requireRole("ceo", "sales"), asyncHandler(async (req, res) => {
    const leadId = Number(req.params.leadId);

    const lead = await storage.getLead(leadId);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const summary = createProjectSummary(lead);
    const embeddingResult = await aiClient.embed(summary);

    if (!embeddingResult) {
      return res.status(500).json({ error: "Failed to generate embedding" });
    }

    // Check if embedding exists
    const [existing] = await db.select().from(projectEmbeddings).where(eq(projectEmbeddings.leadId, leadId));

    if (existing) {
      await db.update(projectEmbeddings)
        .set({
          embedding: JSON.stringify(embeddingResult.embedding),
          projectSummary: summary,
          updatedAt: new Date(),
        })
        .where(eq(projectEmbeddings.id, existing.id));
    } else {
      await db.insert(projectEmbeddings).values({
        leadId,
        embedding: JSON.stringify(embeddingResult.embedding),
        projectSummary: summary,
      });
    }

    res.json({ success: true, tokensUsed: embeddingResult.tokensUsed });
  }));

  // General AI query endpoint for assistant
  app.post("/api/ai/query", isAuthenticated, asyncHandler(async (req, res) => {
    const { question } = req.body;
    const user = req.user as any;

    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "Question is required" });
    }

    if (!aiClient.isConfigured()) {
      return res.status(503).json({ error: "AI service not configured" });
    }

    try {
      // Get context data
      const leads = await storage.getLeads();
      const projects = await storage.getProjects();

      // Calculate metrics for context
      const openLeads = leads.filter(l => !["Closed Won", "Closed Lost"].includes(l.dealStage));
      const totalPipelineValue = openLeads.reduce((sum, l) => sum + Number(l.value || 0), 0);
      const avgDealSize = openLeads.length > 0 ? totalPipelineValue / openLeads.length : 0;
      const staleLeads = openLeads.filter(l => {
        if (!l.lastContactDate) return true;
        const daysSince = (Date.now() - new Date(l.lastContactDate).getTime()) / (1000 * 60 * 60 * 24);
        return daysSince > 14;
      });
      const highValueLeads = openLeads.filter(l => Number(l.value) >= 10000);
      const proposalStage = openLeads.filter(l => l.dealStage === "Proposal");
      const negotiationStage = openLeads.filter(l => l.dealStage === "Negotiation");

      const contextSummary = `
Current Pipeline Summary:
- Total pipeline value: $${totalPipelineValue.toLocaleString()}
- Open deals: ${openLeads.length}
- Average deal size: $${Math.round(avgDealSize).toLocaleString()}
- High-value deals (>$10k): ${highValueLeads.length}
- Deals in Proposal stage: ${proposalStage.length}
- Deals in Negotiation stage: ${negotiationStage.length}
- Stale leads (>14 days no contact): ${staleLeads.length}
- Active projects: ${projects.length}

Recent high-value opportunities:
${highValueLeads.slice(0, 5).map(l => `- ${l.clientName}: $${Number(l.value).toLocaleString()} (${l.dealStage})`).join('\n')}

Leads needing follow-up:
${staleLeads.slice(0, 5).map(l => `- ${l.clientName}: Last contact ${l.lastContactDate ? new Date(l.lastContactDate).toLocaleDateString() : 'never'}`).join('\n')}
`;

      const systemPrompt = `You are an AI assistant for Scan2Plan, a laser scanning and BIM services company.
You help the CEO and sales team with pipeline insights, deal analysis, and recommendations.
Be concise and actionable in your responses. Use the context data to provide specific insights.

${contextSummary}`;

      const answer = await aiClient.generateText(systemPrompt, question, { maxTokens: 500 });

      // Track analytics
      await db.insert(aiAnalytics).values({
        feature: "assistant",
        userId: user?.id?.toString() || user?.claims?.email,
        action: "query",
        timeTakenMs: 0,
        metadata: { questionLength: question.length },
      });

      res.json({ answer });
    } catch (error: any) {
      log("ERROR: AI query failed - " + error.message);
      res.status(500).json({ error: "Failed to process query" });
    }
  }));

  // AI feature analytics
  app.get("/api/ai/analytics", isAuthenticated, requireRole("ceo"), asyncHandler(async (req, res) => {
    const analytics = await db.select().from(aiAnalytics).limit(100);

    const featureCounts: Record<string, number> = {};
    const actionCounts: Record<string, number> = {};
    let totalTimeTaken = 0;

    for (const record of analytics) {
      featureCounts[record.feature] = (featureCounts[record.feature] || 0) + 1;
      if (record.action) {
        actionCounts[record.action] = (actionCounts[record.action] || 0) + 1;
      }
      totalTimeTaken += record.timeTakenMs || 0;
    }

    res.json({
      totalUsage: analytics.length,
      byFeature: featureCounts,
      byAction: actionCounts,
      averageResponseTime: analytics.length > 0 ? Math.round(totalTimeTaken / analytics.length) : 0,
    });
  }));

  // AI Cache Stats (for monitoring cost savings)
  app.get("/api/ai/cache-stats", isAuthenticated, requireRole("ceo"), asyncHandler(async (req, res) => {
    const stats = aiClient.getCacheStats();
    res.json(stats);
  }));

  // Clear AI Cache (admin function)
  app.post("/api/ai/cache/clear", isAuthenticated, requireRole("ceo"), asyncHandler(async (req, res) => {
    aiClient.clearCache();
    res.json({ success: true, message: "AI cache cleared" });
  }));

  // Field Notes Processing Endpoint - transforms raw field notes into professional scope
  app.post("/api/field-notes/:id/process", isAuthenticated, requireRole("ceo", "sales", "production"), asyncHandler(async (req, res) => {
    const fieldNoteId = Number(req.params.id);
    const user = req.user as any;

    const fieldNote = await storage.getFieldNote(fieldNoteId);
    if (!fieldNote) {
      return res.status(404).json({ error: "Field note not found" });
    }

    if (!aiClient.isConfigured()) {
      return res.status(503).json({ error: "AI service not configured" });
    }

    // Mark as processing
    await storage.updateFieldNote(fieldNoteId, { status: "Processing" });

    try {
      const FIELD_NOTE_PROMPT = `You are a professional BIM project manager translating raw field notes from a laser scanning technician into a clear, professional scope summary.

Transform the technician's shorthand and informal notes into:
1. A professional project scope summary
2. Key observations and findings
3. Any potential issues or concerns identified
4. Recommended next steps

Be concise but thorough. Maintain technical accuracy while improving clarity.

## EXAMPLE

Input (raw field notes):
"bldg 4 floors, mech rm basement access thru loading dock only. hvac old - looks like 70s vintage. some ductwork hidden above drop ceiling need to verify. client wants arch+mep. coord w/ facilities guy joe - only avail mornings. parking lot scan needed for site plan. watch for forklift traffic in warehouse area"

Output (professional scope summary):

**Project Scope Summary**
Four-story commercial building requiring comprehensive laser scanning for architecture and MEP documentation. Includes basement mechanical room access via loading dock entrance. Parking lot scan required for site plan development.

**Key Observations**
- HVAC systems appear to be 1970s vintage; documentation may require additional verification
- Concealed ductwork above drop ceiling tiles requiring selective investigation
- Active warehouse operations with material handling equipment in facility

**Potential Issues**
- Limited access window: Facilities contact (Joe) available mornings only
- Site safety: Active forklift traffic in warehouse zone requires coordination
- Hidden conditions: Concealed ductwork above drop ceilings may impact MEP modeling

**Recommended Next Steps**
1. Schedule morning site visits to coordinate with facilities contact
2. Plan selective ceiling tile removal for ductwork verification
3. Coordinate scan schedule around warehouse shift operations
4. Obtain site safety orientation for warehouse protocols`;

      const result = await aiClient.generateText(
        FIELD_NOTE_PROMPT,
        `Raw Field Notes:\n${fieldNote.rawContent}`,
        { maxTokens: 1000, temperature: 0.3 }
      );

      if (!result) {
        await storage.updateFieldNote(fieldNoteId, { status: "Failed" });
        return res.status(500).json({ error: "AI processing failed" });
      }

      const updated = await storage.updateFieldNote(fieldNoteId, {
        processedScope: result,
        status: "Completed",
      });

      // Track analytics
      await db.insert(aiAnalytics).values({
        feature: "field_notes",
        userId: user?.id?.toString() || user?.claims?.email,
        action: "processed",
        metadata: { fieldNoteId, rawLength: fieldNote.rawContent.length, processedLength: result.length },
      });

      log(`[AI Field Notes] Processed field note ${fieldNoteId}`);
      res.json(updated);
    } catch (error: any) {
      await storage.updateFieldNote(fieldNoteId, { status: "Failed" });
      log(`ERROR: [AI Field Notes] Processing failed: ${error?.message}`);
      res.status(500).json({ error: "Processing failed" });
    }
  }));

  // Streaming Proposal Generation - better UX for long generations
  app.post("/api/proposals/generate-stream", isAuthenticated, requireRole("ceo", "sales"), asyncHandler(async (req, res) => {
    const { leadId, template, sections, persona } = req.body;
    const user = req.user as any;

    if (!leadId) {
      return res.status(400).json({ error: "Lead ID is required" });
    }

    const lead = await storage.getLead(Number(leadId));
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    if (!aiClient.isConfigured()) {
      return res.status(503).json({ error: "AI service not configured" });
    }

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const PERSONA_MESSAGING: Record<string, string> = {
      BP1: "The Engineer - Focus on technical accuracy, data quality, and precision specifications",
      BP2: "The GC - Emphasize schedule reliability, coordination benefits, and RFI reduction",
      BP3: "The Architect - Highlight design integration, BIM compatibility, and creative flexibility",
      BP4: "The Developer - Lead with ROI, timeline efficiency, and cost certainty",
    };

    const validTemplates = ["technical", "executive", "standard"];
    const templateType = validTemplates.includes(template) ? template : "standard";
    const personaContext = persona && PERSONA_MESSAGING[persona]
      ? PERSONA_MESSAGING[persona]
      : "General prospect - balance technical and business value";

    const defaultSections = templateType === "executive"
      ? ["executive_summary", "value_proposition", "scope_overview", "investment", "next_steps"]
      : ["executive_summary", "scope_of_work", "deliverables", "timeline", "pricing"];

    const requestedSections = sections || defaultSections;

    const projectContext = {
      projectName: lead.projectName,
      clientName: lead.clientName,
      projectAddress: lead.projectAddress,
      buildingType: lead.buildingType,
      sqft: lead.sqft,
      scope: lead.scope,
      disciplines: lead.disciplines,
      value: lead.value,
    };

    const systemPrompt = `You are an expert proposal writer for Scan2Plan, a professional laser scanning and BIM services company. Create compelling, professional proposals.`;

    const userPrompt = `Generate a ${templateType} proposal for this project:

Project: ${JSON.stringify(projectContext, null, 2)}
Buyer Persona: ${personaContext}
Sections: ${requestedSections.join(", ")}

Write professional, compelling content. Each section should be 100-300 words.`;

    try {
      const startTime = Date.now();
      const stream = await aiClient.chatStream({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.6,
        maxTokens: 4000,
      });

      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }

      // Send completion event
      res.write(`data: ${JSON.stringify({ done: true, analysisTime: Date.now() - startTime })}\n\n`);
      res.end();

      // Track analytics
      await db.insert(aiAnalytics).values({
        feature: "proposal_stream",
        userId: user?.id?.toString() || user?.claims?.email,
        leadId: Number(leadId),
        action: "generated",
        timeTakenMs: Date.now() - startTime,
        metadata: { template: templateType, streaming: true },
      });
    } catch (error: any) {
      log(`ERROR: [AI Proposal Stream] Generation failed: ${error?.message}`);
      res.write(`data: ${JSON.stringify({ error: error?.message || "Generation failed" })}\n\n`);
      res.end();
    }
  }));

  // Feature 7: Context-Aware Rewrite
  app.post("/api/ai/rewrite", isAuthenticated, requireRole("ceo", "sales"), asyncHandler(async (req, res) => {
    const { text, instruction, leadId } = req.body;

    if (!text || !instruction) {
      return res.status(400).json({ error: "Text and instruction are required" });
    }

    let contextPrompt = "";
    if (leadId) {
      try {
        const context = await getAIContext(Number(leadId));
        contextPrompt = formatContextForPrompt(context);
      } catch (e) {
        log(`WARN: Failed to get context for lead ${leadId}: ${e}`);
      }
    }

    const systemPrompt = `You are an expert proposal editor for Scan2Plan. 
Your goal is to rewrite the provided text based on the user's instruction and the project context.
Maintain a professional, persuasive tone suitable for high-value B2B proposals.

${contextPrompt}

IMPORTANT: Return ONLY the rewritten text. Do not include quotes or explanations.`;

    const result = await aiClient.generateText(
      systemPrompt,
      `Original Text:\n"${text}"\n\nInstruction: ${instruction}`,
      { temperature: 0.7 }
    );

    res.json({ rewritedText: result });
  }));
}
