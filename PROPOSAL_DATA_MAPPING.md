# Proposal Data Mapping Strategy

## Overview
This document maps data from **Lead Details** and **Quote Builder** to the **Proposal PDF** sections.

## Data Sources

### Lead Details (from `leads` table)
Available fields:
- `projectCode`, `clientName`, `projectName`, `projectAddress`
- `contactName`, `contactEmail`, `contactPhone`
- `billingContactName`, `billingContactEmail`, `billingContactPhone`
- `buildingType`, `sqft`, `scope`, `disciplines`
- `bimDeliverable`, `bimVersion`
- `timeline`, `paymentTerms`, `notes`
- `value`, `dealStage`, `probability`
- `leadSource`, `buyerPersona`

### Quote Builder (from `cpqQuotes` table + Calculator state)
Available fields:
- `quoteNumber`, `projectName`, `projectAddress`, `typeOfBuilding`
- `areas` (array): Building areas with sqft, scope, disciplines, LoD levels
- `services`: Matterport, photography, etc.
- `totalPrice`, `pricingBreakdown`
- `dispatchLocation`, `distance`, `customTravelCost`
- `paymentTerms`, `notes`
- Scoping data: deliverables, custom templates, assumptions, contacts

---

## Proposal PDF Structure Mapping

### **Page 1: Cover Page**
**Content:**
- Scan2Plan logo (large, centered)
- "Scan2Plan Proposal" heading
- Project title
- Client name
- Date
- Location

**Data Mapping:**
```javascript
{
  logo: "/logo-cover.png",
  title: "Scan2Plan Proposal",
  projectTitle: quote.projectName || lead.projectName,
  clientName: quote.clientName || lead.clientName,
  date: new Date().toLocaleDateString(),
  location: quote.projectAddress || lead.projectAddress || "New York"
}
```

---

### **Page 2: About Scan2Plan + Why Scan2Plan?**

#### Section: About Scan2Plan
**Content:** (Boilerplate)
- Company overview
- "Focus on design" tagline
- Mission statement

**Data Mapping:**
```javascript
// Static template content - no dynamic fields
```

#### Section: Why Scan2Plan?
**Content:** (Boilerplate with optional customization)
- Bullet points of benefits
- Value propositions

**Data Mapping:**
```javascript
// Static template content
// Can be customized per-proposal in editor
```

---

### **Page 3: The Project**

#### Overview
**Data Mapping:**
```javascript
{
  clientName: quote.clientName || lead.clientName,
  projectName: quote.projectName || lead.projectName,
  address: quote.projectAddress || lead.projectAddress,
  buildingType: quote.typeOfBuilding || lead.buildingType,
  sqft: calculateTotalSqft(quote.areas) || lead.sqft,
  projectDescription: lead.notes || quote.notes
}
```

#### Scope of Work
**Data Mapping:**
```javascript
{
  scope: extractScope(quote.areas), // "Interior + Exterior"
  disciplines: extractDisciplines(quote.areas), // "Architecture LOD 300, MEP LOD 200"
  deliverables: quote.scopingData?.bimDeliverable || lead.bimDeliverable // "Revit 2024"
}
```

#### Deliverables
**Data Mapping:**
```javascript
{
  bimPlatform: quote.scopingData?.bimDeliverable || lead.bimDeliverable,
  bimVersion: quote.scopingData?.bimVersion || lead.bimVersion,
  lodLevels: extractLodLevels(quote.areas), // ["LOD 200", "LOD 300"]
  additionalServices: formatServices(quote.services) // "Matterport 3D Tour, Site Photography"
}
```

#### Timeline
**Data Mapping:**
```javascript
{
  estimatedDuration: lead.timeline || "4-6 weeks",
  milestones: generateMilestones(lead.timeline) // Default milestones if not specified
}
```

---

### **Pages 5-6: Estimate**

**Table Structure:**
| ITEM | DESCRIPTION | QTY | RATE | AMOUNT |
|------|-------------|-----|------|--------|

**Data Mapping:**
```javascript
// Extract from quote.pricingBreakdown
const lineItems = [];

// 1. Scanning Services
quote.areas.forEach(area => {
  lineItems.push({
    item: `${area.buildingType} - Scanning`,
    description: `${area.sqft} sqft, ${area.scope}`,
    qty: area.sqft,
    rate: calculateScanningRate(area),
    amount: area.scanningCost
  });
});

// 2. Modeling Services
quote.areas.forEach(area => {
  lineItems.push({
    item: `${area.buildingType} - ${area.discipline} Modeling`,
    description: `LOD ${area.lodLevel}`,
    qty: area.sqft,
    rate: calculateModelingRate(area),
    amount: area.modelingCost
  });
});

// 3. Travel
if (quote.distance || quote.customTravelCost) {
  lineItems.push({
    item: "Travel",
    description: `${quote.distance} miles from ${quote.dispatchLocation}`,
    qty: quote.distance,
    rate: calculateTravelRate(),
    amount: quote.customTravelCost || (quote.distance * travelRate)
  });
}

// 4. Additional Services
if (quote.services.matterport > 0) {
  lineItems.push({
    item: "Matterport 3D Tour",
    description: "Virtual walkthrough",
    qty: quote.services.matterport,
    rate: MATTERPORT_RATE,
    amount: quote.services.matterport * MATTERPORT_RATE
  });
}

// 5. Total
const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
const total = quote.totalPrice || subtotal;
```

---

### **Page 7: Payment Terms**

**Data Mapping:**
```javascript
{
  paymentStructure: "50% upfront, 50% upon delivery",
  upfrontAmount: quote.totalPrice * 0.5,
  totalAmount: quote.totalPrice,
  paymentMethods: ["Check", "Wire Transfer", "Credit Card"],
  terms: lead.paymentTerms || quote.paymentTerms || "Net 30",

  // Square Footage Audit Clause
  estimatedSqft: calculateTotalSqft(quote.areas) || lead.sqft,
  sqftAuditNote: "Final square footage will be verified during scanning. Pricing will be adjusted if actual square footage differs by more than 10%.",

  // Contact for Questions
  contactEmail: "admin@scan2plan.io",
  contactPhone: "(518) 362-2403"
}
```

---

### **Page 8: Scan2Plan Capabilities**

**Content:** (Boilerplate)
- List of services offered
- Technology stack
- Industries served

**Data Mapping:**
```javascript
// Static template content - no dynamic fields
```

---

### **Page 9: The Scan2Plan Difference**

**Content:** (Boilerplate)
- Competitive advantages
- Quality guarantees
- Client testimonials

**Data Mapping:**
```javascript
// Static template content - no dynamic fields
```

---

### **Pages 10-11: BIM Modeling Standards**

**Table Structure:**
| LoD Level | Description | Elements Included | Use Cases |
|-----------|-------------|-------------------|-----------|

**Data Mapping:**
```javascript
// Static table with standard LoD definitions
const lodLevelsUsed = extractLodLevels(quote.areas); // ["200", "300", "350"]

// Highlight relevant LoD rows based on quote
const lodStandards = [
  {
    level: "LOD 200",
    description: "Approximate geometry",
    elements: "Walls, floors, roofs, major systems",
    useCases: "Early design, feasibility",
    highlight: lodLevelsUsed.includes("200")
  },
  {
    level: "LOD 300",
    description: "Precise geometry",
    elements: "Detailed architectural and MEP elements",
    useCases: "Construction documents, coordination",
    highlight: lodLevelsUsed.includes("300")
  },
  {
    level: "LOD 350",
    description: "Coordination model",
    elements: "All systems with connections and clearances",
    useCases: "Clash detection, fabrication prep",
    highlight: lodLevelsUsed.includes("350")
  },
  {
    level: "LOD 350+",
    description: "Enhanced detail",
    elements: "Shop drawings level detail",
    useCases: "Fabrication, as-built documentation",
    highlight: lodLevelsUsed.includes("350+")
  }
];
```

---

## Helper Functions Needed

### 1. Calculate Total Square Footage
```javascript
function calculateTotalSqft(areas: CpqArea[]): number {
  return areas.reduce((total, area) => total + (area.sqft || 0), 0);
}
```

### 2. Extract Scope Summary
```javascript
function extractScope(areas: CpqArea[]): string {
  const scopes = new Set(areas.map(a => a.scope));
  return Array.from(scopes).join(" + ");
}
```

### 3. Extract Disciplines
```javascript
function extractDisciplines(areas: CpqArea[]): string {
  const disciplines = areas.map(area =>
    `${area.discipline} LOD ${area.lodLevel}`
  );
  return [...new Set(disciplines)].join(", ");
}
```

### 4. Extract LoD Levels
```javascript
function extractLodLevels(areas: CpqArea[]): string[] {
  return [...new Set(areas.map(a => a.lodLevel))];
}
```

### 5. Format Services
```javascript
function formatServices(services: any): string {
  const serviceList = [];
  if (services.matterport > 0) serviceList.push(`Matterport 3D Tour (${services.matterport})`);
  if (services.photography > 0) serviceList.push(`Site Photography (${services.photography})`);
  return serviceList.join(", ") || "None";
}
```

### 6. Generate Line Items from Pricing Breakdown
```javascript
function generateLineItems(quote: CpqQuote): LineItem[] {
  // Parse quote.pricingBreakdown
  // Extract scanning, modeling, travel, services
  // Format as table rows
  return lineItems;
}
```

---

## Variable Substitution in Templates

Templates use `{{variable}}` syntax for dynamic content:

**Example Template:**
```markdown
# The Project

## Overview
{{clientName}} has engaged Scan2Plan to provide professional 3D laser scanning and BIM modeling services for {{projectName}}, located at {{projectAddress}}.

The project encompasses {{totalSqft}} square feet of {{buildingType}} space.

## Scope of Work
- **Scope:** {{scope}}
- **Disciplines:** {{disciplines}}
- **Deliverables:** {{bimDeliverable}} ({{bimVersion}})
```

**Substitution Function:**
```javascript
function substituteVariables(template: string, context: { lead: Lead; quote: CpqQuote | null }): string {
  const variables = {
    clientName: context.quote?.clientName || context.lead.clientName,
    projectName: context.quote?.projectName || context.lead.projectName,
    projectAddress: context.quote?.projectAddress || context.lead.projectAddress,
    totalSqft: calculateTotalSqft(context.quote?.areas || []) || context.lead.sqft || "TBD",
    buildingType: context.quote?.typeOfBuilding || context.lead.buildingType,
    scope: extractScope(context.quote?.areas || []),
    disciplines: extractDisciplines(context.quote?.areas || []),
    bimDeliverable: context.quote?.scopingData?.bimDeliverable || context.lead.bimDeliverable,
    bimVersion: context.quote?.scopingData?.bimVersion || context.lead.bimVersion,
    // ... add all variables
  };

  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] || match;
  });
}
```

---

## Implementation Priority

1. **Phase 1:** Build PDF generator with static boilerplate sections
2. **Phase 2:** Implement dynamic data mapping for cover page + project details
3. **Phase 3:** Build line item generation from pricing breakdown
4. **Phase 4:** Implement variable substitution in all templates
5. **Phase 5:** Add per-proposal customization (edit sections before generating)

---

## Notes

- Prefer **Quote Builder** data when available (more recent, more detailed)
- Fall back to **Lead Details** for missing fields
- Some fields are boilerplate and never change (About Us, Capabilities)
- Payment terms have default values but can be overridden per-deal
- Square footage audit clause is standard for all proposals
