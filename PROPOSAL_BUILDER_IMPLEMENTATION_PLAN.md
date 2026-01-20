# Proposal Builder Implementation Plan

## Executive Summary

The proposal builder needs a significant overhaul to generate professional PDF proposals matching the provided examples (30 Cooper Sq and 61 Woods Road proposals).

**Current State:** Basic template system with markdown editing exists, but PDF generation doesn't match required format.

**Target State:** Full-featured proposal builder that:
- Pulls data from Lead Details AND Quote Builder
- Generates 9-page PDFs matching example structure
- Allows per-proposal text customization
- Includes pricing line items from quotes
- Supports variable substitution in templates

---

## Gap Analysis

### What Works ✅
1. **Template Management** - CRUD operations for templates and groups work
2. **Section Editing** - ProposalLayoutEditor allows markdown editing
3. **Draft Saving** - Proposals save to database correctly
4. **Preview** - ProposalPreview renders markdown with cover page
5. **Database Schema** - Tables exist for templates, groups, generated proposals

### What's Missing ❌
1. **PDF Generation** - Current `generateEstimatePDF` doesn't match required format
2. **API Endpoints** - `/api/proposals/:leadId/send` and `/api/proposals/:leadId/generate-pdf` don't exist
3. **Data Integration** - No mapping from Lead/Quote → Proposal
4. **Line Item System** - No extraction of pricing breakdown into estimate table
5. **Template Content** - Templates don't match 9-page structure from examples

---

## Implementation Phases

### **Phase 1: PDF Generator Foundation** 🏗️

**Goal:** Build new PDF generator matching example structure

**Files to Create/Modify:**
- `server/pdf/proposalGenerator.ts` (new)
- `server/pdf/helpers.ts` (new)

**Steps:**
1. Create `proposalGenerator.ts` using `pdfkit`
2. Implement page-by-page rendering:
   - Page 1: Cover page with logo
   - Page 2: About + Why Scan2Plan
   - Page 3: The Project (Overview, Scope, Deliverables, Timeline)
   - Pages 5-6: Estimate table with line items
   - Page 7: Payment Terms
   - Page 8: Capabilities (boilerplate)
   - Page 9: Difference (boilerplate)
   - Pages 10-11: BIM Standards table

**Technical Details:**
- Use `pdfkit` for PDF generation
- Support table rendering for estimate and standards
- Match exact formatting from example PDFs:
  - Font: Helvetica
  - Colors: Brand colors (primary blue #2563eb)
  - Spacing: Consistent margins and line heights
  - Tables: Clean borders, alternating row colors

**Success Criteria:**
- PDF matches visual structure of examples
- All 11 pages render correctly
- Tables format properly
- Logo displays on cover page

---

### **Phase 2: Data Integration Layer** 🔗

**Goal:** Map Lead + Quote data into proposal sections

**Files to Create/Modify:**
- `server/lib/proposalDataMapper.ts` (new)
- Update `server/pdf/proposalGenerator.ts`

**Steps:**
1. Implement helper functions from `PROPOSAL_DATA_MAPPING.md`:
   - `calculateTotalSqft(areas)`
   - `extractScope(areas)`
   - `extractDisciplines(areas)`
   - `extractLodLevels(areas)`
   - `formatServices(services)`
   - `generateLineItems(quote)`

2. Create `proposalDataMapper.ts`:
   ```typescript
   interface ProposalData {
     // Cover page
     projectTitle: string;
     clientName: string;
     date: string;
     location: string;

     // Project details
     overview: {
       projectName: string;
       address: string;
       buildingType: string;
       sqft: number;
       description: string;
     };

     // Scope
     scope: {
       scopeSummary: string;
       disciplines: string;
       deliverables: string;
       lodLevels: string[];
     };

     // Timeline
     timeline: {
       duration: string;
       milestones: string[];
     };

     // Estimate
     lineItems: LineItem[];
     subtotal: number;
     total: number;

     // Payment
     paymentTerms: {
       structure: string;
       upfrontAmount: number;
       totalAmount: number;
       methods: string[];
       terms: string;
     };
   }

   function mapProposalData(lead: Lead, quote: CpqQuote | null): ProposalData {
     // Implementation
   }
   ```

3. Integrate data mapper with PDF generator

**Success Criteria:**
- All dynamic fields populate correctly
- Fallback logic works (Quote → Lead → defaults)
- Line items extract from pricing breakdown
- Calculations are accurate (totals, sqft, rates)

---

### **Phase 3: API Endpoints** 🌐

**Goal:** Build endpoints for PDF generation and sending

**Files to Create/Modify:**
- Update `server/routes/proposals.ts`

**Endpoints to Add:**

#### 1. `POST /api/proposals/:leadId/generate-pdf`
```typescript
// Generate PDF for download
// Input: { caseStudyIds: number[] } (optional)
// Output: PDF blob
async (req, res) => {
  const leadId = parseInt(req.params.leadId);
  const { caseStudyIds } = req.body;

  // 1. Fetch lead
  const lead = await storage.getLead(leadId);

  // 2. Fetch latest quote
  const quotes = await storage.getCpqQuotesByLead(leadId);
  const quote = quotes.find(q => q.isLatest) || quotes[0];

  // 3. Fetch saved proposal (if exists)
  const proposals = await db
    .select()
    .from(generatedProposals)
    .where(eq(generatedProposals.leadId, leadId))
    .orderBy(desc(generatedProposals.createdAt));
  const latestProposal = proposals[0];

  // 4. Map data
  const proposalData = mapProposalData(lead, quote);

  // 5. Apply section customizations from saved proposal
  if (latestProposal?.sections) {
    // Use customized section content
  }

  // 6. Generate PDF
  const pdfDoc = await generateProposalPDF(proposalData, latestProposal?.sections);

  // 7. Return PDF
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Scan2Plan_Proposal_${lead.clientName}.pdf"`);
  pdfDoc.pipe(res);
  pdfDoc.end();
}
```

#### 2. `POST /api/proposals/:leadId/send`
```typescript
// Generate PDF and update lead status
// Input: { caseStudyIds: number[] }
// Output: { success: true, pdfSize: number }
async (req, res) => {
  const leadId = parseInt(req.params.leadId);

  // 1. Generate PDF (same as above)
  const pdfDoc = await generateProposalPDF(...);

  // 2. Save to buffer
  const chunks = [];
  pdfDoc.on('data', chunk => chunks.push(chunk));
  await new Promise((resolve) => pdfDoc.on('end', resolve));
  const pdfBuffer = Buffer.concat(chunks);

  // 3. Update lead status
  await storage.updateLead(leadId, {
    dealStage: "Proposal Sent"
  });

  // 4. Create proposal email event (for tracking)
  // TODO: Implement email sending

  // 5. Return success
  res.json({
    success: true,
    pdfSize: pdfBuffer.length
  });
}
```

**Success Criteria:**
- Both endpoints work without errors
- PDFs download correctly
- Lead status updates on send
- Error handling for missing data

---

### **Phase 4: Template Content Updates** 📝

**Goal:** Create/update templates to match 9-page structure

**Files to Create:**
- Database seed script: `server/seed/proposalTemplates.ts`

**Templates to Create:**

1. **Cover Page** (category: `cover`)
   - Name: "Cover Page"
   - Content: Minimal (just project title variable)
   - Variables: `{{projectName}}`, `{{clientName}}`, `{{date}}`

2. **About Scan2Plan** (category: `company`)
   - Name: "About Scan2Plan"
   - Content: Company overview (boilerplate)
   - Variables: None

3. **Why Scan2Plan** (category: `company`)
   - Name: "Why Scan2Plan?"
   - Content: Value proposition bullet points
   - Variables: None

4. **Project Overview** (category: `project`)
   - Name: "The Project - Overview"
   - Content: Project description with variables
   - Variables: `{{clientName}}`, `{{projectName}}`, `{{projectAddress}}`, `{{buildingType}}`, `{{totalSqft}}`

5. **Scope of Work** (category: `project`)
   - Name: "Scope of Work"
   - Content: Detailed scope description
   - Variables: `{{scope}}`, `{{disciplines}}`, `{{bimDeliverable}}`, `{{bimVersion}}`

6. **Deliverables** (category: `project`)
   - Name: "Deliverables"
   - Content: What client will receive
   - Variables: `{{deliverables}}`, `{{lodLevels}}`

7. **Timeline** (category: `project`)
   - Name: "Timeline"
   - Content: Project schedule
   - Variables: `{{timeline}}`, `{{milestones}}`

8. **Estimate** (category: `pricing`)
   - Name: "Estimate"
   - Content: Table of line items (generated dynamically)
   - Variables: `{{lineItems}}`, `{{subtotal}}`, `{{total}}`

9. **Payment Terms** (category: `terms`)
   - Name: "Payment Terms"
   - Content: Payment structure and policies
   - Variables: `{{upfrontAmount}}`, `{{totalAmount}}`, `{{paymentMethods}}`, `{{estimatedSqft}}`

10. **Capabilities** (category: `appendix`)
    - Name: "Scan2Plan Capabilities"
    - Content: Services overview (boilerplate)
    - Variables: None

11. **Difference** (category: `appendix`)
    - Name: "The Scan2Plan Difference"
    - Content: Competitive advantages (boilerplate)
    - Variables: None

12. **BIM Standards** (category: `appendix`)
    - Name: "BIM Modeling Standards"
    - Content: LoD table (generated dynamically)
    - Variables: `{{lodStandards}}`

**Template Group:**
- Name: "Standard Proposal"
- Slug: "standard"
- isDefault: `true`
- Sections: All 12 templates in order

**Success Criteria:**
- All templates created in database
- Template group references correct sections
- Content matches example PDFs
- Variables are properly defined

---

### **Phase 5: Variable Substitution** 🔄

**Goal:** Implement {{variable}} replacement in templates

**Files to Modify:**
- `client/src/features/proposals/hooks/useProposalTemplates.ts`
- `server/lib/proposalDataMapper.ts`

**Implementation:**

1. Update `substituteVariables` function in `useProposalTemplates.ts`:
```typescript
export function substituteVariables(
  template: string,
  context: { lead: Lead; quote: CpqQuote | null }
): string {
  const variables = buildVariableMap(context);

  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key]?.toString() || match;
  });
}

function buildVariableMap(context: { lead: Lead; quote: CpqQuote | null }) {
  const { lead, quote } = context;

  return {
    // Cover
    projectName: quote?.projectName || lead.projectName || "Untitled Project",
    clientName: quote?.clientName || lead.clientName,
    date: new Date().toLocaleDateString(),
    location: quote?.projectAddress || lead.projectAddress,

    // Project
    projectAddress: quote?.projectAddress || lead.projectAddress,
    buildingType: quote?.typeOfBuilding || lead.buildingType,
    totalSqft: calculateTotalSqft(quote?.areas || []) || lead.sqft,
    scope: extractScope(quote?.areas || []),
    disciplines: extractDisciplines(quote?.areas || []),

    // Deliverables
    bimDeliverable: quote?.scopingData?.bimDeliverable || lead.bimDeliverable,
    bimVersion: quote?.scopingData?.bimVersion || lead.bimVersion,
    lodLevels: extractLodLevels(quote?.areas || []).join(", "),

    // Timeline
    timeline: lead.timeline || "4-6 weeks",

    // Pricing
    subtotal: quote?.totalPrice ? Number(quote.totalPrice) * 0.95 : 0,
    total: quote?.totalPrice || 0,
    upfrontAmount: quote?.totalPrice ? Number(quote.totalPrice) * 0.5 : 0,
    totalAmount: quote?.totalPrice || 0,

    // Payment
    paymentMethods: "Check, Wire Transfer, Credit Card",
    estimatedSqft: calculateTotalSqft(quote?.areas || []) || lead.sqft,

    // Add all other variables...
  };
}
```

**Success Criteria:**
- All variables substitute correctly
- Missing variables show placeholder or default value
- Complex variables (arrays, calculations) work
- Preview updates when data changes

---

### **Phase 6: Line Item Generation** 💰

**Goal:** Extract pricing breakdown into estimate table rows

**Files to Create:**
- `server/lib/lineItemGenerator.ts`

**Implementation:**

```typescript
interface LineItem {
  item: string;
  description: string;
  qty: number | string;
  rate: number;
  amount: number;
}

function generateLineItems(quote: CpqQuote, lead: Lead): LineItem[] {
  const items: LineItem[] = [];

  // 1. Scanning services per area
  if (quote?.areas && Array.isArray(quote.areas)) {
    quote.areas.forEach((area: any) => {
      items.push({
        item: `${area.buildingType} - Laser Scanning`,
        description: `${area.sqft} sqft, ${area.scope}`,
        qty: area.sqft,
        rate: area.scanningCost / area.sqft,
        amount: area.scanningCost
      });
    });
  }

  // 2. Modeling services per area
  if (quote?.areas && Array.isArray(quote.areas)) {
    quote.areas.forEach((area: any) => {
      items.push({
        item: `${area.buildingType} - ${area.discipline} Modeling`,
        description: `LOD ${area.lodLevel}`,
        qty: area.sqft,
        rate: area.modelingCost / area.sqft,
        amount: area.modelingCost
      });
    });
  }

  // 3. Travel
  if (quote?.distance || quote?.customTravelCost) {
    const travelAmount = Number(quote.customTravelCost) || (quote.distance * 0.75);
    items.push({
      item: "Travel",
      description: `${quote.distance} miles from ${quote.dispatchLocation}`,
      qty: quote.distance || 1,
      rate: quote.distance ? travelAmount / quote.distance : travelAmount,
      amount: travelAmount
    });
  }

  // 4. Additional services
  if (quote?.services?.matterport > 0) {
    items.push({
      item: "Matterport 3D Tour",
      description: "Virtual walkthrough",
      qty: quote.services.matterport,
      rate: 500,
      amount: quote.services.matterport * 500
    });
  }

  if (quote?.services.photography > 0) {
    items.push({
      item: "Site Photography",
      description: "Professional site photos",
      qty: quote.services.photography,
      rate: 300,
      amount: quote.services.photography * 300
    });
  }

  return items;
}
```

**PDF Table Rendering:**
```typescript
function renderEstimateTable(doc: PDFDocument, lineItems: LineItem[], y: number) {
  // Table headers
  doc.font('Helvetica-Bold').fontSize(10);
  doc.text('ITEM', 50, y);
  doc.text('DESCRIPTION', 150, y);
  doc.text('QTY', 350, y);
  doc.text('RATE', 410, y);
  doc.text('AMOUNT', 480, y, { align: 'right' });

  y += 20;

  // Table rows
  doc.font('Helvetica').fontSize(9);
  lineItems.forEach((item, idx) => {
    const bgColor = idx % 2 === 0 ? '#f9fafb' : '#ffffff';
    doc.rect(40, y - 5, 525, 18).fillColor(bgColor).fill();

    doc.fillColor('#000000');
    doc.text(item.item, 50, y);
    doc.text(item.description, 150, y, { width: 180 });
    doc.text(item.qty.toString(), 350, y);
    doc.text(`$${item.rate.toFixed(2)}`, 410, y);
    doc.text(`$${item.amount.toFixed(2)}`, 480, y, { align: 'right' });

    y += 20;
  });

  // Total
  y += 10;
  const total = lineItems.reduce((sum, item) => sum + item.amount, 0);
  doc.font('Helvetica-Bold').fontSize(11);
  doc.text('TOTAL:', 410, y);
  doc.text(`$${total.toFixed(2)}`, 480, y, { align: 'right' });

  return y;
}
```

**Success Criteria:**
- Line items extract from all quote areas
- Quantities and rates calculate correctly
- Table renders cleanly in PDF
- Totals match quote.totalPrice

---

### **Phase 7: Testing & Refinement** ✅

**Goal:** End-to-end testing and polish

**Test Cases:**

1. **Simple Quote (1 area)**
   - Single building, one discipline
   - Verify all pages render
   - Check line item calculations

2. **Complex Quote (multiple areas)**
   - Multiple buildings with different scopes
   - Different LoD levels per discipline
   - Verify line items per area

3. **Quote with Travel**
   - Custom travel cost
   - Distance-based travel
   - Verify travel line item

4. **Quote with Services**
   - Matterport + Photography
   - Verify service line items

5. **No Quote (Lead only)**
   - Fall back to lead data
   - Verify all fields populate
   - Check defaults

6. **Customized Sections**
   - Edit sections in proposal builder
   - Save draft
   - Verify customizations appear in PDF

7. **Variable Substitution**
   - All {{variables}} replaced
   - No undefined/null values
   - Proper formatting

**Performance:**
- PDF generation < 2 seconds
- Large proposals (20+ line items) work
- No memory leaks

**Error Handling:**
- Missing lead: 404
- Missing quote: Use lead data
- Invalid data: Graceful fallbacks
- PDF generation failure: Return error

**Success Criteria:**
- All test cases pass
- No console errors
- PDFs match examples visually
- Data accuracy 100%

---

## Technical Architecture

### PDF Generation Flow
```
User clicks "Download PDF"
  ↓
ProposalBuilder.tsx → handleDownloadPDF()
  ↓
API: POST /api/proposals/:leadId/generate-pdf
  ↓
Fetch Lead + Quote from DB
  ↓
proposalDataMapper.mapProposalData()
  ↓
Fetch saved proposal sections (if exists)
  ↓
Apply section customizations
  ↓
proposalGenerator.generateProposalPDF()
  ↓
Render each page sequentially:
  - Cover page
  - About + Why
  - Project details
  - Estimate table (from line items)
  - Payment terms
  - Capabilities
  - Difference
  - BIM Standards
  ↓
Return PDF stream to client
  ↓
Browser downloads PDF
```

### Data Flow
```
Lead Details Form
  ↓ (save)
leads table
  ↑
  |
  └──> proposalDataMapper ←── cpqQuotes table
                                  ↑
                                  | (save)
                            Quote Builder Form
```

---

## Files to Create/Modify

### New Files
- `server/pdf/proposalGenerator.ts` - Main PDF generation logic
- `server/pdf/helpers.ts` - PDF rendering utilities
- `server/lib/proposalDataMapper.ts` - Data mapping layer
- `server/lib/lineItemGenerator.ts` - Line item extraction
- `server/seed/proposalTemplates.ts` - Template seed data
- `PROPOSAL_DATA_MAPPING.md` - Documentation (created)
- `PROPOSAL_BUILDER_IMPLEMENTATION_PLAN.md` - This file

### Modified Files
- `server/routes/proposals.ts` - Add new endpoints
- `client/src/features/proposals/hooks/useProposalTemplates.ts` - Enhanced variable substitution
- `server/routes.ts` - Register new routes (if needed)

---

## Dependencies

### Already Installed
- `pdfkit` - PDF generation ✅
- `@types/pdfkit` - TypeScript types ✅

### May Need
- `pdfkit-table` - For complex tables (optional)
- `sharp` - Image processing for logos (if needed)

---

## Risk Mitigation

### Risk: PDF doesn't match examples exactly
**Mitigation:** Iterative refinement with side-by-side comparison

### Risk: Complex pricing breakdowns
**Mitigation:** Start with simple quotes, add complexity gradually

### Risk: Performance issues with large PDFs
**Mitigation:** Streaming PDF generation, async processing

### Risk: Missing data breaks PDF generation
**Mitigation:** Comprehensive fallback values, validation before generation

---

## Timeline Estimate

**Phase 1:** PDF Generator Foundation - 1-2 days
**Phase 2:** Data Integration Layer - 1 day
**Phase 3:** API Endpoints - 0.5 days
**Phase 4:** Template Content - 0.5 days
**Phase 5:** Variable Substitution - 0.5 days
**Phase 6:** Line Item Generation - 1 day
**Phase 7:** Testing & Refinement - 1 day

**Total:** ~5-6 days of focused development

---

## Success Metrics

- ✅ PDFs match example structure (visual comparison)
- ✅ All data fields populate correctly
- ✅ Line items calculate accurately
- ✅ No console errors or warnings
- ✅ Performance < 2 seconds per PDF
- ✅ User can customize sections per-proposal
- ✅ API endpoints handle all edge cases

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Start Phase 1:** Build PDF generator
3. **Iterate on each phase** with testing
4. **User acceptance testing** with real proposals
5. **Deploy to production** after QA

---

## Questions for Review

1. Should we support multiple template groups (e.g., "Simple Quote" vs "Full Proposal")?
2. Do we need email integration for sending proposals?
3. Should PDFs save to cloud storage (GCS) or just stream to browser?
4. Are there any custom fields or sections needed beyond the examples?
5. Do we want version tracking for proposal PDFs?

---

**Last Updated:** 2026-01-20
**Status:** Ready for implementation
