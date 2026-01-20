# Scan2Plan CPQ Integration Instructions

## Overview

This document provides technical instructions for integrating the Scan2Plan-OS CRM with the CPQ (Configure, Price, Quote) calculator. The CRM will host the scoping form and send a complete JSON payload to the CPQ for pricing calculations.

## Architecture

```
┌─────────────────────────┐     postMessage      ┌─────────────────────────┐
│   Scan2Plan-OS (CRM)    │ ──────────────────→  │      CPQ Calculator     │
│   - Hosts scoping form  │                      │   - Receives payload    │
│   - Collects all data   │                      │   - Runs calculations   │
│   - Embeds CPQ iframe   │ ←────────────────── │   - Creates quotes      │
│   - Stores quote refs   │     CPQ_QUOTE_SAVED  │   - Exports documents   │
└─────────────────────────┘                      └─────────────────────────┘
```

## Communication Flow

1. **CRM loads CPQ** in an iframe: `https://[cpq-url]/?leadId={leadId}`
2. **CPQ sends** `CPQ_READY` message when loaded
3. **CRM sends** `CPQ_SCOPING_PAYLOAD` with complete form data
4. **CPQ hydrates** state and displays pricing
5. **User saves quote** in CPQ
6. **CPQ sends** `CPQ_QUOTE_SAVED` with quote details back to CRM

## JSON Payload Schema

Send this payload via postMessage with type `CPQ_SCOPING_PAYLOAD`:

```typescript
interface CPQScopingPayload {
  type: "CPQ_SCOPING_PAYLOAD";
  
  // Lead/CRM Reference
  leadId: number;
  
  // Project Details
  projectDetails: {
    clientName: string;
    projectName: string;
    projectAddress: string;
    specificBuilding?: string;
    typeOfBuilding?: string;
    hasBasement?: boolean;
    hasAttic?: boolean;
    notes?: string;
  };
  
  // Areas (supports multiple buildings/areas)
  areas: Array<{
    id: string;                              // Unique ID, e.g., "1", "2", or UUID
    name: string;                            // Area name/label
    buildingType: string;                    // Building type ID (see reference below)
    squareFeet: string;                      // Square footage as string
    scope: "full" | "interior" | "exterior"; // Scope of work
    disciplines: string[];                   // Array: ["arch", "struct", "mech", "elec", "plumb", "site"]
    disciplineLods: Record<string, string>;  // LoD per discipline: {"arch": "300", "struct": "200"}
    mixedInteriorLod?: string;               // Default: "300"
    mixedExteriorLod?: string;               // Default: "300"
    numberOfRoofs?: number;                  // For exterior scope
    facades?: Array<{id: string, label: string}>; // Facade definitions
    gradeAroundBuilding?: boolean;           // Include grade/site
    gradeLod?: string;                       // Grade LoD: "200", "300", "350"
    includeCad?: boolean;                    // Include CAD deliverables
    additionalElevations?: number;           // Extra elevation drawings
  }>;
  
  // Risk Factors (array of risk IDs)
  risks: string[];
  // Available: "remote", "fastTrack", "revisions", "coordination", "incomplete", 
  //           "difficult", "multiPhase", "unionSite", "security"
  
  // Travel Configuration
  travel: {
    dispatchLocation: "troy" | "boise" | "denver" | "remote";
    distance?: number;              // Miles from dispatch (if known)
    customTravelCost?: number;      // Override calculated travel cost
  };
  
  // Additional Services (key = service ID, value = quantity or 1 for boolean services)
  services?: Record<string, number>;
  // Available: "matterport", "sitePhotography", "aerialPhotography", "progressMonitoring"
  
  // Scoping Details
  scopingData: {
    // ACT (Acoustic Ceiling Tile) Options
    aboveBelowACT?: "" | "above" | "below" | "both" | "other";
    aboveBelowACTOther?: string;
    actSqft?: string;
    
    // Deliverables
    bimDeliverable?: string[];      // ["revit", "navisworks", "autocad", "pointCloud", "other"]
    bimDeliverableOther?: string;
    bimVersion?: string;            // e.g., "2024", "2023"
    
    // Template
    customTemplate?: "" | "yes" | "no" | "other";
    customTemplateOther?: string;
    
    // Sqft Assumptions
    sqftAssumptions?: string;
    
    // Financial Notes
    assumedGrossMargin?: string;
    caveatsProfitability?: string;
    projectNotes?: string;
    mixedScope?: string;
    insuranceRequirements?: string;
    
    // Tier A Pricing (for internal tracking)
    tierAScanningCost?: "" | "included" | "excluded" | "other";
    tierAScanningCostOther?: string;
    tierAModelingCost?: string;
    tierAMargin?: string;
    
    // Timeline
    estimatedTimeline?: "" | "1week" | "2weeks" | "3weeks" | "4weeks" | "6weeks" | "8weeks" | "other";
    timelineOther?: string;
    timelineNotes?: string;
    
    // Payment Terms
    paymentTerms?: "" | "net30" | "net15" | "dueOnReceipt" | "50/50" | "milestone" | "other";
    paymentTermsOther?: string;
    paymentNotes?: string;
    
    // Contact Information
    accountContact?: string;        // Account contact name
    accountContactEmail?: string;   // Account contact email
    accountContactPhone?: string;   // Account contact phone
    phoneNumber?: string;           // Alternative phone
    designProContact?: string;
    designProCompanyContact?: string;
    otherContact?: string;
    
    // Documentation
    proofLinks?: string;            // URLs to reference materials
    
    // Lead Source
    source?: "" | "referral" | "website" | "linkedin" | "coldOutreach" | "repeat" | "partner" | "other";
    sourceNote?: string;
    
    // Sales Pipeline
    assist?: string;
    probabilityOfClosing?: string;  // "25", "50", "75", "90"
    projectStatus?: "" | "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost" | "other";
    projectStatusOther?: string;
  };
}
```

## Building Type Reference

| ID | Label |
|----|-------|
| 1 | Residential - Single Family |
| 2 | Residential - Multi Family |
| 3 | Residential - Luxury |
| 4 | Commercial / Office |
| 5 | Retail / Restaurants |
| 6 | Kitchen / Catering Facilities |
| 7 | Education |
| 8 | Hotel / Theatre / Museum |
| 9 | Hospitals / Mixed Use |
| 10 | Mechanical / Utility Rooms |
| 11 | Warehouse / Storage |
| 12 | Religious Buildings |
| 13 | Infrastructure / Roads / Bridges |
| 14 | Built Landscape (uses per-acre pricing) |
| 15 | Natural Landscape (uses per-acre pricing) |
| 16 | ACT (Above/Below Acoustic Ceiling Tiles) |

## Discipline Reference

| ID | Label |
|----|-------|
| arch | Architecture |
| struct | Structure |
| mech | Mechanical |
| elec | Electrical |
| plumb | Plumbing |
| site | Site/Topography |

## Level of Detail (LoD) Reference

| Value | Description |
|-------|-------------|
| 200 | Basic/Conceptual |
| 300 | Standard (default) |
| 350 | Detailed/Construction |

## Implementation in CRM

### 1. Create the Scoping Form Component

Build a form that collects all the data defined in the payload schema above. Key sections:
- Project Details (client, project name, address)
- Building/Area Configuration (building type, sqft, scope, disciplines with LoD selection)
- Risk Factors (checkboxes for applicable risks)
- Travel Configuration (dispatch location selection, optional distance input)
- Additional Services (optional add-ons)
- Scoping Details (deliverables, timeline, payment terms, contacts)

### 2. Embed CPQ iframe

```tsx
// React example
const [cpqReady, setCpqReady] = useState(false);
const iframeRef = useRef<HTMLIFrameElement>(null);

// CPQ URL - use your deployed CPQ URL
const cpqUrl = `https://[your-cpq-url]/?leadId=${leadId}`;

useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === "CPQ_READY") {
      console.log("CPQ is ready to receive data");
      setCpqReady(true);
    }
    
    if (event.data?.type === "CPQ_QUOTE_SAVED") {
      console.log("Quote saved:", event.data);
      // Store quote reference in CRM
      // event.data contains: quoteId, quoteNumber, totalPrice, leadId
    }
  };
  
  window.addEventListener("message", handleMessage);
  return () => window.removeEventListener("message", handleMessage);
}, []);

return (
  <iframe
    ref={iframeRef}
    src={cpqUrl}
    style={{ width: "100%", height: "800px", border: "none" }}
  />
);
```

### 3. Send Scoping Data to CPQ

```typescript
const sendScopingData = () => {
  if (!cpqReady || !iframeRef.current?.contentWindow) {
    console.warn("CPQ not ready");
    return;
  }
  
  const payload: CPQScopingPayload = {
    type: "CPQ_SCOPING_PAYLOAD",
    leadId: currentLeadId,
    projectDetails: {
      clientName: formData.clientName,
      projectName: formData.projectName,
      projectAddress: formData.projectAddress,
      // ... other fields
    },
    areas: [{
      id: "1",
      name: "Main Building",
      buildingType: formData.buildingType,  // e.g., "4" for Commercial/Office
      squareFeet: formData.sqft,
      scope: formData.scope,                // "full", "interior", or "exterior"
      disciplines: formData.selectedDisciplines,  // ["arch", "struct", "mech"]
      disciplineLods: formData.disciplineLods,    // {"arch": "300", "struct": "200"}
      includeCad: formData.includeCad,
    }],
    risks: formData.selectedRisks,  // ["remote", "fastTrack"]
    travel: {
      dispatchLocation: formData.dispatchLocation,
      distance: formData.distanceMiles,
      customTravelCost: formData.customTravelOverride,
    },
    services: formData.additionalServices,
    scopingData: {
      accountContact: formData.contactName,
      accountContactEmail: formData.contactEmail,
      accountContactPhone: formData.contactPhone,
      estimatedTimeline: formData.timeline,
      paymentTerms: formData.paymentTerms,
      bimDeliverable: formData.deliverables,
      bimVersion: formData.revitVersion,
      probabilityOfClosing: formData.probability,
      projectStatus: formData.status,
      // ... other scoping fields
    },
  };
  
  iframeRef.current.contentWindow.postMessage(payload, "*");
};

// Call when form is complete or on "Calculate Pricing" button click
```

### 4. Handle Quote Saved Response

When a quote is saved in CPQ, it sends back:

```typescript
interface CPQQuoteSavedMessage {
  type: "CPQ_QUOTE_SAVED";
  quoteId: string;
  quoteNumber: string;
  totalPrice: number;
  leadId: number;
}
```

Store this in your CRM lead/opportunity record.

## Authentication

Both systems use the same `CPQ_API_KEY` secret for API authentication. The CRM should include this in API calls to the CPQ backend:

```typescript
// For direct API calls (if needed)
fetch(`${CPQ_BASE_URL}/api/quotes`, {
  headers: {
    "X-API-Key": process.env.CPQ_API_KEY,
    "Content-Type": "application/json"
  },
  // ...
});
```

For postMessage communication (iframe), authentication is handled by origin checking and the shared leadId reference.

## Example: Minimal Payload

For quick testing, send a minimal payload:

```json
{
  "type": "CPQ_SCOPING_PAYLOAD",
  "leadId": 123,
  "projectDetails": {
    "clientName": "Acme Corp",
    "projectName": "Office Renovation",
    "projectAddress": "123 Main St, Detroit, MI 48226"
  },
  "areas": [{
    "id": "1",
    "name": "Main Building",
    "buildingType": "4",
    "squareFeet": "50000",
    "scope": "full",
    "disciplines": ["arch", "mech", "elec", "plumb"],
    "disciplineLods": {"arch": "300", "mech": "300", "elec": "300", "plumb": "300"}
  }],
  "risks": [],
  "travel": {
    "dispatchLocation": "troy"
  },
  "scopingData": {}
}
```

## Next Steps for CRM Implementation

1. Create a scoping form UI with all the fields documented above
2. Add an iframe to embed the CPQ calculator
3. Listen for `CPQ_READY` message before sending data
4. Send `CPQ_SCOPING_PAYLOAD` when user clicks "Calculate Pricing"
5. Handle `CPQ_QUOTE_SAVED` to store quote references in the lead record
6. Optionally add a "View Quote" link that opens CPQ with the saved quoteId

## Questions?

The CPQ is ready to receive this payload format. Test with the minimal example first, then expand to include all scoping fields.
