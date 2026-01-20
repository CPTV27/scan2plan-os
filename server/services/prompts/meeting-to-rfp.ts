/**
 * Meeting Transcript to RFP Converter
 * 
 * Converts a Google Gemini/Meet meeting transcript into
 * a structured RFP document for the Scan2Plan OS pipeline
 */

export const MEETING_TO_RFP_PROMPT = `
**Role:** You are the **Scout Agent** for the Scan2Plan OS. Your goal is to parse the attached meeting transcript between a salesperson and a client to generate a formal, structured **Request for Proposal (RFP)** document.

**Task:** Extract and organize the following information into the standard **Scan2Plan RFP Format** so it can be ingested into the automated proposal workflow.

**Required Data Structure:**

1.  **Project Identity:**
    *   **Project Name:** (e.g., PS 115 School Renovation).
    *   **Project Address:** (Essential for travel and logistics calculations).
    *   **Client Contact:** Name, Email, and Phone number.
    *   **Buyer Persona:** Identify if the client is an Engineer (BP1), Architect (BP5), Developer (BP6), etc.

2.  **Building Specifications:**
    *   **Building Type:** Categorize into one of the 16 platform options (e.g., Warehouse, Hospital, Historical/Renovation, Office).
    *   **Estimated Square Footage:** (Gross Square Footage/GSF).
    *   **Number of Floors/Areas:** Defined as individual "Project Areas".

3.  **Scope of Work (Disciplines & LOD):**
    *   **Disciplines Required:** Specify Architecture, Structure, MEPF (Mechanical, Electrical, Plumbing, Fire), or Site/Landscape.
    *   **Level of Development (LOD):** Select LOD 200 (Basic), 300 (Standard), 350 (Detailed), or 400 (Fabrication) for each discipline.
    *   **Deliverables:** Note required file formats (e.g., Revit 2024, AutoCAD DWG, IFC).

4.  **Risk Factors & Logistics:**
    *   **Site Conditions:** Note if the building is Occupied (+15%), Hazardous (+25%), has No Power (+20%), or is a High-Security site.
    *   **Timeline:** Specific deadlines or turnaround requirements (e.g., 2-week turnaround).

5.  **Strategic Intelligence (For FitScore):**
    *   **Budget:** Mentioned range or constraints.
    *   **Decision Threshold Factors:** Any notes on project "comfort level" or known risks that would impact the 100-point **FitScore**.

**Output Format:** Return as structured JSON matching the RFP_FOR_INGESTION schema below.

\`\`\`json
{
  "RFP_FOR_INGESTION": {
    "projectIdentity": {
      "projectName": "",
      "projectAddress": "",
      "clientContact": {
        "name": "",
        "email": "",
        "phone": ""
      },
      "buyerPersona": ""
    },
    "buildingSpecs": {
      "buildingType": "",
      "estimatedSqft": 0,
      "numberOfFloors": 0,
      "projectAreas": []
    },
    "scopeOfWork": {
      "disciplines": [],
      "lodByDiscipline": {},
      "deliverables": []
    },
    "riskFactors": {
      "siteConditions": [],
      "timeline": "",
      "deadlineDate": null
    },
    "strategicIntel": {
      "budgetRange": "",
      "budgetMin": null,
      "budgetMax": null,
      "comfortLevel": "",
      "knownRisks": [],
      "fitScoreNotes": ""
    }
  }
}
\`\`\`
`;

export interface RFPFromTranscript {
    RFP_FOR_INGESTION: {
        projectIdentity: {
            projectName: string;
            projectAddress: string;
            clientContact: {
                name: string;
                email: string;
                phone: string;
            };
            buyerPersona: string;
        };
        buildingSpecs: {
            buildingType: string;
            estimatedSqft: number;
            numberOfFloors: number;
            projectAreas: string[];
        };
        scopeOfWork: {
            disciplines: string[];
            lodByDiscipline: Record<string, string>;
            deliverables: string[];
        };
        riskFactors: {
            siteConditions: string[];
            timeline: string;
            deadlineDate: string | null;
        };
        strategicIntel: {
            budgetRange: string;
            budgetMin: number | null;
            budgetMax: number | null;
            comfortLevel: string;
            knownRisks: string[];
            fitScoreNotes: string;
        };
    };
}

/**
 * Building types supported by the platform
 */
export const BUILDING_TYPES = [
    "Warehouse",
    "Hospital",
    "Historical/Renovation",
    "Office",
    "Retail",
    "Residential - Single Family",
    "Residential - Multi Family",
    "K-12 School",
    "Higher Education",
    "Government",
    "Data Center",
    "Industrial",
    "Hotel/Hospitality",
    "Mixed Use",
    "Religious",
    "Sports/Entertainment"
] as const;

/**
 * Buyer personas mapped to codes
 */
export const BUYER_PERSONAS = {
    "Engineer": "BP1",
    "GC/CM": "BP2",
    "Owner": "BP3",
    "Facility Manager": "BP4",
    "Architect": "BP5",
    "Developer": "BP6",
    "Trade Contractor": "BP7",
    "Surveyor": "BP8"
} as const;

/**
 * LOD levels
 */
export const LOD_LEVELS = ["200", "300", "350", "400"] as const;

/**
 * Disciplines
 */
export const DISCIPLINES = [
    "Architecture",
    "Structure",
    "Mechanical",
    "Electrical",
    "Plumbing",
    "Fire Protection",
    "Site/Landscape"
] as const;

/**
 * Site condition risk multipliers
 */
export const SITE_CONDITIONS = {
    "Occupied": 0.15,
    "Hazardous": 0.25,
    "No Power": 0.20,
    "High Security": 0.10,
    "Night Work Required": 0.20,
    "Weather Sensitive": 0.10
} as const;
