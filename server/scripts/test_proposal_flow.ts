
import fs from "fs";
import { db } from "../db";
import { leads, cpqQuotes, generatedProposals, proposalTemplates } from "@shared/schema";
import { substituteVariables } from "../lib/variableSubstitution";
import { generateProposalPDF } from "../pdf/proposalGenerator";
import { mapProposalData } from "../lib/proposalDataMapper";
import { eq } from "drizzle-orm";

async function runTest() {
    console.log("Starting Proposal Flow Test...");
    const timestamp = Date.now();

    try {
        // 1. Create Test Lead
        console.log("Creating Lead...");
        const [lead] = await db.insert(leads).values({
            clientName: `Test Client ${timestamp}`,
            clientEmail: `test${timestamp}@example.com`,
            projectName: "Project Alpha",
            projectAddress: "123 Test St, Testville",
            dealStage: "Leads",
            // clientTier: "Tier 1",
        }).returning();
        console.log("Created Lead:", lead.id);

        // 2. Create Test Quote
        console.log("Creating Quote...");
        const [quote] = await db.insert(cpqQuotes).values({
            leadId: lead.id,
            quoteNumber: `Q-${timestamp}`,
            projectName: "Project Alpha",
            projectAddress: "123 Test St, Testville",
            typeOfBuilding: "Commercial",
            dispatchLocation: "New York",
            totalPrice: "5000.00",
            areas: [], // Required field
            pricingBreakdown: [
                { name: "Field Scanning", description: "LOD 200 scanning", totalPrice: 3000 },
                { name: "Modeling", description: "Revit Model", totalPrice: 2000 }
            ]
        }).returning();
        console.log("Created Quote:", quote.id);

        // 3. Get Templates
        console.log("Fetching Templates...");
        const templates = await db.select().from(proposalTemplates);
        const aboutTemplate = templates.find(t => t.name === "About Scan2Plan");
        const capsTemplate = templates.find(t => t.name === "Scan2Plan Capabilities");

        // 4. Create Generated Proposal with Custom Content
        console.log("Creating Generated Proposal...");
        const customAboutContent = `
# About {{client_name}}'s Project

We are excited to work on {{project_name}}.
Total investment: {{total_price}}.

This is a **customized** section replacing the standard About text.
    `.trim();

        const customCapsContent = `
## Our Capabilities for {{client_name}}

- Custom Scanning
- Custom Modeling
- Speed: Fast
    `.trim();

        const sections = [
            {
                templateId: aboutTemplate?.id || 1,
                name: "About Scan2Plan",
                content: customAboutContent,
                sortOrder: 1,
                included: true
            },
            {
                templateId: capsTemplate?.id || 2,
                name: "Scan2Plan Capabilities",
                content: customCapsContent,
                sortOrder: 2,
                included: true
            },
            {
                templateId: 99,
                name: "Estimate Notes",
                content: "These are **custom estimate notes** for {{client_name}}.",
                sortOrder: 3,
                included: true
            },
            {
                templateId: 100,
                name: "Square Footage Audit",
                content: "Custom Audit Text: We will check sqft for {{project_name}}.",
                sortOrder: 4,
                included: true
            },
            {
                templateId: 101,
                name: "Terms & Conditions",
                content: "1. Pay us money.\n2. Don't sue us.\n3. {{payment_terms}} apply.",
                sortOrder: 5,
                included: true
            }
        ];

        const [genProp] = await db.insert(generatedProposals).values({
            leadId: lead.id,
            cpqQuoteId: quote.id,
            name: `Test Proposal ${timestamp}`,
            sections: sections,
        }).returning();
        console.log("Created Generated Proposal:", genProp.id);

        // 5. Simulate Route Logic
        console.log("Simulating PDF Generation...");

        // Prepare Proposal Data using mapper
        console.log("Mapping Data...");
        const proposalData = mapProposalData(lead, quote);
        console.log("Data Mapped Successfully.");

        // Process Custom Sections
        const customSections = sections
            .filter((s) => s.included)
            .map((s) => ({
                name: s.name,
                // Apply variable substitution
                content: substituteVariables(s.content, lead, quote, proposalData),
            }));

        console.log("Custom Sections being passed:", JSON.stringify(customSections, null, 2));

        // Generate PDF
        const doc = await generateProposalPDF(proposalData, customSections);

        // Write to file
        const writeStream = fs.createWriteStream("test_proposal_output.pdf");
        doc.pipe(writeStream);
        doc.end();

        writeStream.on("finish", () => {
            console.log("PDF generated successfully: test_proposal_output.pdf");
            process.exit(0);
        });

        writeStream.on("error", (err) => {
            console.error("Error writing PDF:", err);
            process.exit(1);
        });

    } catch (err) {
        console.error("Test failed with exception:", err);
        process.exit(1);
    }
}

runTest();
