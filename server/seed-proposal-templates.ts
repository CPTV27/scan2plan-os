/**
 * Seed Default Proposal Templates
 * 
 * Creates the default boilerplate templates for proposal generation.
 * Run with: npx tsx server/seed-proposal-templates.ts
 */

import { db } from "./db";
import { proposalTemplates, proposalTemplateGroups } from "@shared/schema";
import { eq } from "drizzle-orm";

const DEFAULT_TEMPLATES = [
    {
        name: "Cover Page",
        slug: "cover-page",
        category: "intro",
        sortOrder: 1,
        isDefault: true,
        variables: ["client_name", "project_name", "quote_date", "valid_until"],
        content: `# Scan2Plan Proposal

## {{project_name}}

**Prepared for:** {{client_name}}

**Date:** {{quote_date}}

**Valid Until:** {{valid_until}}

---

*Professional 3D Scanning & BIM Modeling Services*

![Scan2Plan Logo](/logo.png)

---

**Scan2Plan**
Brooklyn, NY
www.scan2plan.com
`,
    },
    {
        name: "Executive Summary",
        slug: "executive-summary",
        category: "intro",
        sortOrder: 2,
        isDefault: true,
        variables: ["project_name", "client_name", "project_address"],
        content: `## Executive Summary

Thank you for considering Scan2Plan for your **{{project_name}}** project located at **{{project_address}}**.

We are pleased to provide this proposal for professional 3D laser scanning and BIM modeling services. Our team combines cutting-edge technology with deep industry expertise to deliver accurate, reliable as-built documentation.

### Why Scan2Plan?

- **Accuracy Guaranteed**: ±1/8" precision across all deliverables
- **Fast Turnaround**: Industry-leading delivery times
- **Full-Service**: From field scanning to final BIM model
- **Quality Assured**: ISO-certified processes

We look forward to partnering with {{client_name}} on this project.
`,
    },
    {
        name: "About Scan2Plan",
        slug: "about-scan2plan",
        category: "company",
        sortOrder: 3,
        isDefault: true,
        variables: [],
        content: `## About Scan2Plan

**Scan2Plan** is a leading provider of 3D laser scanning and BIM modeling services, serving architects, engineers, contractors, and building owners across the Northeast.

### Our Expertise

- **3D Laser Scanning**: High-definition point cloud capture
- **BIM Modeling**: LOD 200-400 Revit models
- **CAD Conversion**: 2D floor plans and elevations
- **Virtual Tours**: Matterport 3D walkthroughs
- **As-Built Documentation**: Complete building documentation

### Our Clients

We proudly serve industry leaders including:
- Top architecture firms
- Major general contractors
- Property management companies
- Educational institutions
- Healthcare facilities

### Quality Commitment

All projects are delivered with our quality guarantee. Our ISO-certified workflow ensures consistency, accuracy, and reliability on every engagement.
`,
    },
    {
        name: "Scope of Work",
        slug: "scope-of-work",
        category: "scope",
        sortOrder: 4,
        isDefault: true,
        variables: ["project_name", "project_address", "areas_table"],
        content: `## Scope of Work

### Project Location
**{{project_address}}**

### Areas Included

{{areas_table}}

### Field Work

Our certified technicians will perform comprehensive 3D laser scanning of all areas specified above. The scanning process includes:

1. **Site Preparation**: Coordination with facility contacts
2. **Scanning**: Complete coverage of all specified areas
3. **Field Notes**: Documentation of conditions and observations
4. **Quality Check**: On-site verification of data capture

### Deliverables

Upon completion of modeling, you will receive:

- Revit model at specified LOD levels
- Point cloud files (RCP/RCS format)
- PDF exports of floor plans and elevations
- Project coordination support
`,
    },
    {
        name: "Deliverables Detail",
        slug: "deliverables-detail",
        category: "scope",
        sortOrder: 5,
        isDefault: true,
        variables: [],
        content: `## Deliverables

### Revit BIM Model

Your Revit model will include:

- **Architecture**: Walls, doors, windows, ceilings, stairs, railings
- **MEP/F**: Major mechanical equipment, ductwork, piping, fixtures
- **Structural**: Columns, beams, floor/roof structure

### LOD Definitions

| LOD | Description |
|-----|-------------|
| LOD 200 | Generic system representations, approximate geometry |
| LOD 300 | Specific system assemblies, accurate geometry and location |
| LOD 350 | LOD 300 plus interfaces and connections |
| LOD 400 | Fabrication-ready, shop drawing level detail |

### File Formats

- Revit (.rvt) - Native format
- Point Cloud (.rcp/.rcs) - Compressed laser scan data
- DWG (.dwg) - AutoCAD format
- PDF - Print-ready documentation
`,
    },
    {
        name: "Service Deliverables",
        slug: "service-deliverables",
        category: "pricing",
        sortOrder: 6,
        isDefault: true,
        variables: ["scope", "matterport_scope"],
        content: `## What's Included

**End-to-End Project Management and Customer Service**

Our team provides dedicated project management from kick-off through delivery, ensuring clear communication and timely updates throughout the engagement.

---

### LiDAR Scanning
A certified scanning technician will capture the {{scope}} using state-of-the-art 3D laser scanning equipment. Our technicians are trained to efficiently capture comprehensive data while minimizing disruption to your operations.

### Matterport Scanning
A scanning technician will capture the {{matterport_scope}} using Matterport Pro2 cameras, creating immersive 3D virtual tours and dollhouse views of your space.

### Point Cloud Registration
Point cloud data captured on-site will be registered, cleaned, and reviewed for quality assurance. This process ensures seamless alignment of all scan positions and removes noise or artifacts from the data.

### BIM Modeling
Your deliverable will be modeled in your preferred software (Revit, ArchiCAD, Rhino, SketchUp, etc.) to the specified Level of Detail. Our modeling team follows industry-standard BIM practices and your template requirements.

### CAD Drafting
CAD sheets will be prepared according to your standards, including floor plans, reflected ceiling plans, elevations, and sections as specified in your scope.

### QA/QC
The entire project is redundantly reviewed and checked by our QC team and senior engineering staff. Multiple quality gates ensure accuracy, completeness, and adherence to your deliverable specifications.
`,
    },
    {
        name: "Pricing",
        slug: "pricing",
        category: "pricing",
        sortOrder: 7,
        isDefault: true,
        variables: ["line_items_table", "total_price"],
        content: `## Investment

### Pricing Breakdown

{{line_items_table}}

---

### **Total: {{total_price}}**

*Prices are valid for 30 days from proposal date.*

### What's Included

- All field scanning labor and equipment
- BIM modeling to specified LOD levels
- One round of revisions
- Project management and coordination
- Electronic file delivery
`,
    },
    {
        name: "Timeline",
        slug: "timeline",
        category: "scope",
        sortOrder: 8,
        isDefault: true,
        variables: ["timeline"],
        content: `## Timeline

### Estimated Project Duration: {{timeline}}

| Phase | Duration |
|-------|----------|
| Scheduling & Coordination | 1-2 days |
| Field Scanning | 1-3 days |
| Data Processing | 2-3 days |
| BIM Modeling | 1-3 weeks |
| Quality Review | 2-3 days |
| Delivery & Revisions | As needed |

*Timeline begins upon receipt of signed proposal and retainer payment.*

### Scheduling Flexibility

We can often accommodate rush timelines for an additional fee. Please contact us to discuss expedited options if needed.
`,
    },
    {
        name: "Payment Terms - Owner",
        slug: "payment-terms-owner",
        category: "terms",
        sortOrder: 9,
        isDefault: true,
        variables: [],
        content: `## Payment Terms

### Pricing Basis

The price estimate is based on a square footage estimate. The total cost of the project will be determined by the actual square footage scanned and modeled. We use the **BOMA 2024 Gross Areas Standard**, and will send a square footage audit approximately one week after scan completion.

### Payment Schedule

- **50% of the estimated cost** will be due at the time of the client engaging the Services.
- The first invoice will be for half of the estimated cost.
- The second invoice, due upon delivery, will be for the outstanding balance based on the total square footage scanned and modeled.

### Accepted Forms of Payment

- **ACH** (Preferred Method)
- **Check** - Please mail check to Scan2Plan, 188 1st St., Troy, NY 12180
- **Credit Card** (additional 3% fee) - Email accounting@scan2plan.io to request this option
`,
    },
    {
        name: "Payment Terms - Partner",
        slug: "payment-terms-partner",
        category: "terms",
        sortOrder: 9,
        isDefault: false,
        variables: [],
        content: `## Payment Terms

### Pricing Basis

The price estimate is based on a square footage estimate. The total cost of the project will be determined by the actual square footage scanned and modeled. We use the **BOMA 2024 Gross Areas Standard**, and will send a square footage audit approximately one week after scan completion.

### Payment Schedule

- **50% of the estimated cost** will be due at the time of the client ("Client") engaging the Services.
- The first invoice will be for half of the estimated cost.
- The second invoice will be for the outstanding balance based on the total square footage scanned and modeled.

### Accepted Forms of Payment

- **ACH** (Preferred Method)
- **Check** - Please mail check to Scan2Plan, 188 1st St., Troy, NY 12180
- **Credit Card** (additional 3% fee) - Email accounting@scan2plan.io to request this option
`,
    },
    {
        name: "Payment Terms - Net 30",
        slug: "payment-terms-net30",
        category: "terms",
        sortOrder: 9,
        isDefault: false,
        variables: [],
        content: `## Payment Terms

### Net 30

Net 30 - upon delivery.

### Pricing Basis

The price estimate is based on a square footage estimate. The total cost of the project will be determined by the actual square footage scanned and modeled. We use the **BOMA 2024 Gross Areas Standard**, and will send a square footage audit approximately one week after scan completion.

**Net 30 Projects carry a 5% service fee.**

### Accepted Forms of Payment

- **ACH** (Preferred Method)
- **Check** - Please mail check to Scan2Plan, 188 1st St., Troy, NY 12180
- **Credit Card** (additional 3% fee) - Email accounting@scan2plan.io to request this option
`,
    },
    {
        name: "Payment Terms - Net 60",
        slug: "payment-terms-net60",
        category: "terms",
        sortOrder: 9,
        isDefault: false,
        variables: [],
        content: `## Payment Terms

### Net 60

Net 60 - upon delivery.

### Pricing Basis

The price estimate is based on a square footage estimate. The total cost of the project will be determined by the actual square footage scanned and modeled. We use the **BOMA 2024 Gross Areas Standard**, and will send a square footage audit approximately one week after scan completion.

**Net 60 Projects carry a 10% service fee.**

### Accepted Forms of Payment

- **ACH** (Preferred Method)
- **Check** - Please mail check to Scan2Plan, 188 1st St., Troy, NY 12180
- **Credit Card** (additional 3% fee) - Email accounting@scan2plan.io to request this option
`,
    },
    {
        name: "Payment Terms - Net 90",
        slug: "payment-terms-net90",
        category: "terms",
        sortOrder: 9,
        isDefault: false,
        variables: [],
        content: `## Payment Terms

### Net 90

Net 90 - upon delivery.

### Pricing Basis

The price estimate is based on a square footage estimate. The total cost of the project will be determined by the actual square footage scanned and modeled. We use the **BOMA 2024 Gross Areas Standard**, and will send a square footage audit approximately one week after scan completion.

**Net 90 Projects carry a 15% service fee.**

### Accepted Forms of Payment

- **ACH** (Preferred Method)
- **Check** - Please mail check to Scan2Plan, 188 1st St., Troy, NY 12180
- **Credit Card** (additional 3% fee) - Email accounting@scan2plan.io to request this option
`,
    },
    {
        name: "General Terms",
        slug: "general-terms",
        category: "terms",
        sortOrder: 10,
        isDefault: true,
        variables: [],
        content: `## Terms & Conditions

### Revisions

- One round of revisions is included in the base price
- Additional revisions billed at standard hourly rates
- Major scope changes require a change order

### Cancellation

- Cancellation before field work: Full refund less 10% administrative fee
- Cancellation after field work: Field work charges apply
- Cancellation during modeling: Pro-rated charges apply

### Intellectual Property

- All deliverables become client property upon final payment
- Scan2Plan retains right to use project for portfolio/marketing (anonymized)
`,
    },
    {
        name: "Insurance & Liability",
        slug: "insurance-liability",
        category: "legal",
        sortOrder: 10,
        isDefault: true,
        variables: [],
        content: `## Insurance & Liability

### Coverage

Scan2Plan maintains comprehensive insurance coverage:

- **General Liability**: $2,000,000 per occurrence
- **Professional Liability (E&O)**: $1,000,000 per claim
- **Workers Compensation**: As required by law
- **Auto Liability**: $1,000,000 combined single limit

### Certificates

Insurance certificates available upon request. Additional insured endorsements available.

### Limitation of Liability

Scan2Plan's liability is limited to the contract value. We are not responsible for:

- Decisions made based on deliverables
- Consequential or incidental damages
- Delays due to site access issues
- Third-party claims
`,
    },
    {
        name: "Terms & Conditions",
        slug: "terms-conditions",
        category: "legal",
        sortOrder: 11,
        isDefault: true,
        variables: [],
        content: `## Scan2Plan Terms & Conditions

### 1. Definitions

- **"S2P"** means Scan2Plan.
- **"Client"** means the party accepting the Proposal.
- **"Services"** means the work described in the Proposal, including reality capture, processing, and production of deliverables.
- **"Deliverables"** means the files and outputs identified in the Proposal (e.g., point cloud, BIM model, CAD drawings).
- **"Project Site"** means the location(s) where S2P performs on-site Services.
- **"Non-Recoverable Expenses"** means costs incurred or committed by S2P that cannot be canceled or refunded (including travel, lodging, shipping, permits, third-party fees, and mobilization costs).

---

### 2. Responsibilities of Scan2Plan

S2P will assign a dedicated point of contact to each project. This designated representative will be accessible to Client. S2P may change the point of contact with advance notice.

---

### 3. Responsibilities of the Client

**3.1 Compensation**
Client shall compensate S2P in accordance with the payment terms in the Proposal.

**3.2 Authorized Representative**
Client may appoint an authorized representative empowered to act on Client's behalf and remain in prompt communication with S2P.

**3.3 Cooperation**
Client shall cooperate with S2P by:
- Providing complete and accurate information regarding Project Site conditions and project requirements.
- Responding to S2P requests for information, decisions, and approvals within a reasonable timeframe.
- Reviewing Deliverables promptly for conformance to the Proposal and promptly notifying S2P of any issues.
- Coordinating access, escorts, keys, and site logistics necessary for on-site work.

**3.4 Site Access for Scanning Technician**
During the scheduled scanning period, the scanning technician requires access to all areas required by the Proposal, including rooms, floors, roof areas, closets, mechanical spaces, and other relevant locations.

**3.5 Client Preparation and Shoot Conditions**
Client shall ensure the Project Site is prepared for scanning, including:
- Adequate lighting and general tidiness in scanning areas.
- Removal of clutter and moveable obstructions as reasonably required.
- Maintaining clear line-of-sight where feasible; Client acknowledges LiDAR capture requires unobstructed visibility of surfaces and features.
- Client acknowledges areas with limited visibility due to obstructions, locked rooms, safety restrictions, or inaccessibility may require assumptions, exclusions, or later rescheduling.

**3.6 Timeliness and Shoot Readiness**
S2P may wait up to 30 minutes after arrival for Client access and scan readiness. Delays beyond 30 minutes may be billed at $150.00 per hour (or portion thereof).

**3.7 Safety, Hazardous Conditions, and Site Rules**
Client is responsible for ensuring the Project Site is safe and compliant with applicable site rules and safety requirements. Client shall disclose known hazardous materials or unsafe conditions prior to mobilization. S2P may suspend or stop on-site work if conditions are unsafe or access is restricted; any resulting delay, remobilization, or rescheduling fees may apply.

---

### 4. Payment, Delinquency, and Collection

Payment is due as stated in the Proposal unless otherwise agreed in writing.

Any amounts not paid when due are delinquent. S2P reserves the right, at its discretion, to charge interest on delinquent balances up to the maximum rate permitted by applicable law, calculated from the due date until paid in full.

Client shall reimburse S2P for reasonable costs of collection, including attorney's fees and court costs.

S2P may suspend Services and/or withhold Deliverables until all outstanding balances are paid in full.

---

### 5. Scheduling, Rescheduling, Reshoots, and Cancellations

**5.1 Access Failures**
If the scanning technician cannot access required areas due to Client-caused conditions (including lack of keys/escort, restricted access, site not ready, or inaccurate site representations), the visit may be rescheduled and reshoot/cancellation fees may apply as set forth below.

**5.2 Project Tiers, Reshoot, and Cancellation Fees**

*Project Tier Definitions:*
- **Tier A Projects:** Large-scale or complex projects with a daily field value typically ranging from $3,500 to $7,000 per day, including multi-day scans, large facilities, or projects requiring specialized coordination.
- **Tier B and Tier C Projects:** Projects not meeting Tier A criteria.

S2P reserves the right to designate the applicable tier in the Proposal or prior to scheduling.

*Reshoot Fees (Client-Caused):*
If a reshoot is required due to Client-caused conditions:
- **Tier A:** Reshoot fee equal to 100% of the scheduled daily field rate for the affected day(s), plus Non-Recoverable Expenses.
- **Tier B/C:** $1,500.00 plus Non-Recoverable Expenses.

*Cancellation Fees (Client-Caused):*
- **Tier A:**
  - Within 72 hours of scheduled start: 100% of the scheduled daily field rate for affected day(s), plus Non-Recoverable Expenses.
  - More than 72 hours prior: Non-Recoverable Expenses only.
- **Tier B/C:**
  - Within 48 hours of scheduled start: $450.00 plus Non-Recoverable Expenses.
  - More than 48 hours prior: Non-Recoverable Expenses only.

---

### 6. Scope Control and Change Orders

Services are limited to those expressly stated in the Proposal. Items not expressly included are excluded, including destructive investigation, concealed conditions, code compliance determinations, engineering design, construction means/methods, fabrication-level detailing, or licensed land surveying.

Any change to scope, assumptions, schedule, access conditions, deliverable formats, level of detail, or added areas shall require written authorization and may require a change order and additional fees.

---

### 7. Client Review and Acceptance

Client shall review Deliverables within a reasonable time after delivery. If Client believes Deliverables do not conform to the Proposal, Client shall notify S2P in writing with sufficient detail to evaluate the issue. S2P will have a reasonable opportunity to verify and address verified nonconformance within the scope of the Proposal.

---

### 8. Non-Solicitation

During the term of the engagement and for two (2) years thereafter, Client shall not, directly or indirectly, solicit for employment or engagement any S2P employee, consultant, or contractor who was materially involved in the Services during the preceding twelve (12) months, without S2P's prior written consent.

---

### 9. Property Rights and Use

Client acknowledges that these Terms, the Proposal, and any disclosure of confidential information do not grant Client any license or right to S2P confidential information except as necessary to receive the Services.

Except as stated here, all work-product created by S2P while performing Services remains S2P property until payment is received in full.

Upon full payment, the Deliverables identified in the Proposal become Client property for Client's internal business purposes. Client may not permit third parties to rely on the Deliverables as instruments of professional service without S2P's prior written consent.

S2P may charge fees to any user other than Client for use of the work-product or Deliverables, unless S2P agrees otherwise in writing.

---

### 10. Third-Party Reliance Prohibition

Deliverables are prepared solely for Client and the uses stated in the Proposal. No third party may rely on the Deliverables without S2P's prior written consent. Client shall indemnify and hold harmless S2P from third-party claims arising from unauthorized distribution or reliance.

---

### 11. Digital Model and No-Survey Disclaimer

BIM models, CAD files, and point clouds are instruments of service for design and coordination purposes only. They are not construction documents and shall not be used for construction means/methods, safety planning, fabrication, or layout.

Any topographic or site documentation is for design purposes only and is not a land survey. S2P does not provide licensed surveying services unless expressly stated in writing in the Proposal.

---

### 12. Force Majeure

S2P is not liable for delay or failure to perform due to events beyond its reasonable control, including weather, site shutdowns, labor disputes, governmental actions, utility outages, security restrictions, or unsafe site conditions. Timelines shall be extended accordingly.

---

### 13. Limitation of Liability

Services are provided without any warranty, express or implied, except as expressly stated in these Terms. S2P does not warrant that Services will meet Client's requirements beyond the scope stated in the Proposal.

To the fullest extent permitted by applicable law, S2P and its affiliates shall not be liable for indirect, incidental, punitive, special, consequential, or exemplary damages, or any loss arising from Client's use of the Services or Deliverables.

S2P's total liability arising out of or related to the Services shall not exceed the total fees actually paid by Client to S2P for the Services giving rise to the claim.

S2P is not responsible for inaccurate information supplied by Client or third parties, undisclosed site conditions, hazardous materials, or the actions/inactions of contractors, consultants, utilities, or governmental agencies.

---

### 14. Standard of Care; Reliance on Client-Provided Data

S2P will perform Services in a professional manner consistent with generally accepted industry standards for services of a similar type and scope.

Client acknowledges S2P may rely on survey control, benchmarks, control networks, reference points, existing drawings, and other information supplied by Client, owner, or third parties. S2P is not responsible for inaccuracies in such information unless S2P has verifiable knowledge of substantial inconsistencies.

No other warranty or guarantee is made or implied.

---

### 15. Indemnification

Client shall indemnify and hold harmless S2P and its affiliates from and against losses, damages, liabilities, costs, and expenses (including reasonable attorney's fees) arising out of or relating to third-party claims to the extent caused by:
- Client's breach of these Terms or the Proposal;
- Client's negligence or willful misconduct;
- Hazardous conditions at the Project Site not disclosed to S2P;
- Unauthorized distribution, reliance, or use of Deliverables by third parties.

S2P shall remain responsible for its own negligence or willful misconduct to the extent required by applicable law.

---

### 16. Governing Law and Venue

These Terms and the Proposal shall be governed by and construed in accordance with the laws of the State of New York, without regard to conflict-of-law principles.

Any legal action, claim, or proceeding arising out of or relating to these Terms, the Proposal, or the Services shall be brought exclusively in the state or federal courts located in Rensselaer County, New York, and the parties consent to such jurisdiction and venue, including for small claims proceedings to the extent permitted.

---

### 17. Entire Agreement; Order of Precedence; Changes

These Terms and the Proposal constitute the entire agreement between the parties regarding the Services and supersede prior discussions or understandings.

In the event of conflict, the Proposal controls scope and pricing; these Terms control all other matters.

Any modification must be in writing and signed by both parties. If S2P issues updated terms, such updates apply only to future proposals unless expressly incorporated into an existing signed agreement.

---

### 18. Severability; Waiver; Assignment

If any provision is held unenforceable, the remaining provisions remain in effect. Failure to enforce any provision is not a waiver. Client may not assign this agreement without S2P's prior written consent.

---

*S2P retains the right to modify these General Terms and Conditions periodically. As revisions come into effect, the Client acknowledges that continued utilization of S2P's services may signify consent to adhere to these revised terms upon receipt from S2P.*
`,
    },
    {
        name: "Signature Block",
        slug: "signature-block",
        category: "legal",
        sortOrder: 11,
        isDefault: true,
        variables: ["client_name", "quote_date"],
        content: `## Acceptance

By signing below, {{client_name}} agrees to the scope, pricing, and terms outlined in this proposal.

---

**Client Signature:** _________________________

**Printed Name:** _________________________

**Title:** _________________________

**Date:** _________________________

---

**Scan2Plan Authorization:**

**Signature:** _________________________

**Printed Name:** _________________________

**Date:** {{quote_date}}

---

*Please sign and return this proposal to proceed. Thank you for your business!*
`,
    },
];

const DEFAULT_GROUPS = [
    {
        name: "Standard Proposal",
        slug: "standard",
        description: "Complete proposal with all standard sections",
        isDefault: true,
    },
    {
        name: "Simple Quote",
        slug: "simple",
        description: "Abbreviated proposal for quick turnaround",
        isDefault: false,
    },
    {
        name: "Enterprise",
        slug: "enterprise",
        description: "Extended proposal with additional legal and compliance sections",
        isDefault: false,
    },
];

async function seedProposalTemplates() {
    console.log("🌱 Seeding proposal templates...");

    // Check if templates already exist
    const existing = await db.select().from(proposalTemplates).limit(1);
    if (existing.length > 0) {
        console.log("⚠️  Templates already exist. Skipping seed.");
        return;
    }

    // Insert templates
    const insertedTemplates = await db
        .insert(proposalTemplates)
        .values(DEFAULT_TEMPLATES)
        .returning();

    console.log(`✅ Inserted ${insertedTemplates.length} templates`);

    // Create template groups with section references
    const templatesBySlug = Object.fromEntries(
        insertedTemplates.map((t) => [t.slug, t])
    );

    // Standard group includes all templates
    const standardSections = insertedTemplates
        .filter((t) => t.isDefault)
        .map((t, idx) => ({
            templateId: t.id,
            sortOrder: t.sortOrder || idx + 1,
            required: true,
        }));

    // Simple group - just core sections
    const simpleSections = ["cover-page", "scope-of-work", "service-deliverables", "pricing", "signature-block"]
        .map((slug, idx) => ({
            templateId: templatesBySlug[slug]?.id,
            sortOrder: idx + 1,
            required: true,
        }))
        .filter((s) => s.templateId);

    // Enterprise group - all plus additional
    const enterpriseSections = insertedTemplates.map((t, idx) => ({
        templateId: t.id,
        sortOrder: t.sortOrder || idx + 1,
        required: true,
    }));

    // Insert groups
    const groups = [
        { ...DEFAULT_GROUPS[0], sections: standardSections },
        { ...DEFAULT_GROUPS[1], sections: simpleSections },
        { ...DEFAULT_GROUPS[2], sections: enterpriseSections },
    ];

    const insertedGroups = await db
        .insert(proposalTemplateGroups)
        .values(groups)
        .returning();

    console.log(`✅ Inserted ${insertedGroups.length} template groups`);
    console.log("🎉 Proposal template seeding complete!");
}

seedProposalTemplates()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Seed failed:", error);
        process.exit(1);
    });
