/**
 * Seed script for Proposal Templates
 * 
 * Populates the database with the standard set of 12 proposal templates
 * and the default "Standard Proposal" group.
 */

import { db } from "../db";
import { proposalTemplates, proposalTemplateGroups, type InsertProposalTemplate } from "@shared/schema";
import { eq } from "drizzle-orm";
import { log } from "../lib/logger";

const TEMPLATES: InsertProposalTemplate[] = [
    // 1. Cover Page
    {
        name: "Cover Page",
        slug: "cover-page",
        category: "cover",
        content: "# {{project_name}}\n\nPrepared for: {{client_name}}\nDate: {{date}}",
        description: "Standard cover page with project title and client name",
        isDefault: true,
        sortOrder: 1,
        variables: ["project_name", "client_name", "date"]
    },

    // 2. About Scan2Plan
    {
        name: "About Scan2Plan",
        slug: "about-scan2plan",
        category: "company",
        content: "## About Scan2Plan\n\nScan2Plan is a leading provider of professional 3D laser scanning and BIM documentation services. We specialize in capturing existing conditions with millimeter accuracy and delivering high-quality Building Information Models that architects, engineers, and construction professionals rely on for design, renovation, and facility management projects.\n\nOur focus is on design. We understand that your BIM model is the foundation for critical design decisions, coordination workflows, and construction documentation. That's why we deliver models that are not just accurate, but also intelligently structured, properly detailed, and ready to integrate seamlessly into your project workflow.",
        description: "Company overview and mission statement",
        isDefault: true,
        sortOrder: 2,
        variables: []
    },

    // 3. Why Scan2Plan
    {
        name: "Why Scan2Plan?",
        slug: "why-scan2plan",
        category: "company",
        content: "## Why Scan2Plan?\n\n* **Unmatched Accuracy:** Millimeter-precise scanning with the latest Leica and FARO technology\n* **Expert Modeling:** BIM specialists trained in architecture, MEP, and structural disciplines\n* **Fast Turnaround:** Efficient workflows deliver projects on time without compromising quality\n* **Design-Ready Models:** Intelligently structured for coordination, clash detection, and fabrication\n* **Seamless Integration:** Models work with your existing Revit, AutoCAD, and Navisworks workflows\n* **Dedicated Support:** Direct access to your project team throughout the engagement",
        description: "Value proposition bullet points",
        isDefault: true,
        sortOrder: 3,
        variables: []
    },

    // 4. Project Overview
    {
        name: "The Project - Overview",
        slug: "project-overview",
        category: "project",
        content: "## The Project\n\n### Overview\n\n{{client_name}} has engaged Scan2Plan to provide professional 3D laser scanning and BIM modeling services for {{project_name}}, located at {{project_address}}. The project encompasses {{total_sqft}} square feet of {{building_type}} space.",
        description: "High-level summary of the project scope and location",
        isDefault: true,
        sortOrder: 4,
        variables: ["client_name", "project_name", "project_address", "total_sqft", "building_type"]
    },

    // 5. Scope of Work
    {
        name: "Scope of Work",
        slug: "scope-of-work",
        category: "project",
        content: "### Scope of Work\n\nThe scope of work includes **{{scope}}**.\n\n**Disciplines:**\n{{disciplines}}\n\n**Deliverables:**\n* {{bim_deliverable}} ({{bim_version}})\n* Registered Point Cloud (.RCP)\n* Viewer Files (Recap/JetStream)",
        description: "Detailed breakdown of the project scope and deliverables",
        isDefault: true,
        sortOrder: 5,
        variables: ["scope", "disciplines", "bim_deliverable", "bim_version"]
    },

    // 6. Deliverables Detail
    {
        name: "Deliverables Detail",
        slug: "deliverables-detail",
        category: "project",
        content: "### Detailed Deliverables\n\n**1. 3D BIM Model ({{bim_deliverable}})**\nA comprehensive 3D model developed to **LOD {{lod_levels}}** specifications. The model will include all visible architectural, structural, and MEP elements as defined in the project requirements.\n\n**2. Point Cloud Data**\nFull resolution, colorized point cloud data registered and cleaned. Delivered in .RCP (Autodesk ReCap) format for easy import into design software.\n\n**3. Site Photos**\nHigh-resolution 360° panoramic photos captured at each scan location for visual reference.",
        description: "Specific details about what will be delivered",
        isDefault: true,
        sortOrder: 6,
        variables: ["bim_deliverable", "lod_levels"]
    },

    // 7. Timeline
    {
        name: "Timeline",
        slug: "timeline",
        category: "project",
        content: "### Timeline\n\nWe anticipate a total duration of **{{timeline}}** to complete the scanning and modeling work.\n\n* **Field Scanning:** 1-3 days\n* **Point Cloud Processing:** 1-2 days\n* **BIM Modeling:** Remainder of schedule\n* **QA/QC Review:** Final 2 days",
        description: "Estimated project schedule",
        isDefault: true,
        sortOrder: 7,
        variables: ["timeline"]
    },

    // 8. Estimate
    {
        name: "Estimate",
        slug: "estimate",
        category: "pricing",
        content: "## Investment\n\n### Pricing Breakdown\n\n{{line_items_table}}\n\n### Total Investment: {{total_price}}\n\n*Prices are valid for 30 days from proposal date.*",
        description: "Dynamic pricing table generated from quote line items",
        isDefault: true,
        sortOrder: 8,
        variables: ["line_items_table", "total_price"]
    },

    // 9. Payment Terms
    {
        name: "Payment Terms",
        slug: "payment-terms",
        category: "terms",
        content: "## Payment Structure\n\n* **Deposit:** {{upfront_amount}} (50%) due upon contract signing\n* **Final Payment:** {{final_amount}} (50%) due upon delivery of final model\n\n### Methods\nWe accept Check, Wire Transfer, and Credit Card (3% processing fee).\n\n### Terms\n{{payment_terms}}",
        description: "Payment schedule and accepted methods",
        isDefault: true,
        sortOrder: 9,
        variables: ["upfront_amount", "final_amount", "payment_terms"]
    },

    // 10. Capabilities
    {
        name: "Scan2Plan Capabilities",
        slug: "capabilities",
        category: "appendix",
        content: "## Scan2Plan Capabilities\n\n### Core Services\n* **3D Laser Scanning** - High-definition reality capture of existing conditions\n* **BIM Modeling** - Revit, AutoCAD, and other BIM platforms (LOD 100-400)\n* **As-Built Documentation** - Accurate floor plans, elevations, and sections\n* **MEP Coordination** - Multi-discipline models for clash detection\n* **Structural Analysis** - Precise models for engineering and assessment\n* **Facility Management** - As-built models for ongoing operations",
        description: "Overview of company services (boilerplate)",
        isDefault: true,
        sortOrder: 10,
        variables: []
    },

    // 11. The Scan2Plan Difference
    {
        name: "The Scan2Plan Difference",
        slug: "difference",
        category: "appendix",
        content: "## The Scan2Plan Difference\n\n* **Uncompromising Quality:** Every project undergoes rigorous quality control.\n* **Deep Expertise:** Our team includes licensed architects and engineers.\n* **True Partnership:** We're invested in your project's success.\n* **Continuous Innovation:** We leverage the latest AI and automation tools.\n* **Our Commitments:** Accuracy Guarantee, On-Time Delivery, and value protection.",
        description: "Company competitive advantages (boilerplate)",
        isDefault: true,
        sortOrder: 11,
        variables: []
    },

    // 12. BIM Standards
    {
        name: "BIM Modeling Standards",
        slug: "bim-standards",
        category: "appendix",
        content: "## BIM Modeling Standards\n\nOur BIM models are developed according to industry-standard Level of Development (LoD) specifications.\n\n* **LOD 200 (Approximate Geometry):** Walls, floors, roofs, major systems for early design.\n* **LOD 300 (Precise Geometry):** Detailed architectural and MEP elements for construction docs.\n* **LOD 350 (Coordination Model):** All systems with connections for clash detection.\n* **LOD 400 (Fabrication Ready):** Shop-drawing level detail for fabrication.\n\n**This project will be delivered to: LOD {{lod_levels}}**",
        description: "Explanation of LOD levels",
        isDefault: true,
        sortOrder: 12,
        variables: ["lod_levels"]
    }
];

export async function seedProposalTemplates() {
    log("INFO: Seeding proposal templates...");

    try {
        // 1. Upsert Templates
        const createdTemplates = [];
        for (const template of TEMPLATES) {
            // Check if exists
            let existing = await db.query.proposalTemplates.findFirst({
                where: eq(proposalTemplates.slug, template.slug)
            });

            if (existing) {
                // Update
                const [updated] = await db
                    .update(proposalTemplates)
                    .set(template)
                    .where(eq(proposalTemplates.id, existing.id))
                    .returning();
                createdTemplates.push(updated);
            } else {
                // Insert
                const [created] = await db
                    .insert(proposalTemplates)
                    .values(template)
                    .returning();
                createdTemplates.push(created);
            }
        }

        log(`INFO: Seeded ${createdTemplates.length} proposal templates.`);

        // 2. Create/Update Standard Group
        const standardGroup: any = {
            name: "Standard Proposal",
            slug: "standard",
            description: "Default full-service proposal template",
            isDefault: true,
            sections: createdTemplates.map((t, idx) => ({
                templateId: t.id,
                sortOrder: idx + 1,
                required: true
            }))
        };

        let existingGroup = await db.query.proposalTemplateGroups.findFirst({
            where: eq(proposalTemplateGroups.slug, "standard")
        });

        if (existingGroup) {
            await db
                .update(proposalTemplateGroups)
                .set(standardGroup)
                .where(eq(proposalTemplateGroups.id, existingGroup.id));
            log("INFO: Updated 'Standard Proposal' template group.");
        } else {
            await db
                .insert(proposalTemplateGroups)
                .values(standardGroup);
            log("INFO: Created 'Standard Proposal' template group.");
        }

        log("INFO: Proposal templates seeding complete.");
    } catch (error) {
        log(`ERROR: Failed to seed proposal templates: ${error}`);
    }
}

// Allow running directly if called as main module
import { fileURLToPath } from "url";
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    seedProposalTemplates()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
