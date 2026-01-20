import { aiClient } from "./aiClient";
import { log } from "../../lib/logger";

export interface ExtractedRequirement {
  category: string;
  requirement: string;
  priority: "must-have" | "nice-to-have" | "optional";
  source: string;
}

export interface RiskFlag {
  type: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  recommendation: string;
}

export interface ContactInfo {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string;
}

export interface DocumentExtractionResult {
  projectName: string | null;
  clientName: string | null;
  projectAddress: string | null;
  estimatedValue: number | null;
  contacts: ContactInfo[];
  timeline: {
    dueDate?: string;
    milestones?: string[];
  };
  deliverables: string[];
  requirements: ExtractedRequirement[];
  riskFlags: RiskFlag[];
  insuranceRequirements: string[];
  specialConditions: string[];
  budgetConstraints: string | null;
  buildingType: string | null;
  estimatedSqft: number | null;
  scope: string | null;
  analysisTime: number;
  error?: string;
}

const DOCUMENT_EXTRACTION_PROMPT = `You are an expert at extracting project information from RFPs, SOWs, and construction documents for a laser scanning and BIM services company.

Extract all relevant information including:
1. Project details (name, address, building type, estimated square footage)
2. Client/contact information
3. Timeline and deadline requirements
4. Deliverable specifications
5. Insurance/bonding requirements
6. Special conditions or constraints
7. Budget information if mentioned

Also identify any unusual or high-risk requirements that need attention:
- Tight timelines
- Unusual insurance requirements
- Complex access requirements
- Historic preservation constraints
- Active construction site work
- After-hours or weekend work requirements
- Multi-site or phased projects`;

export async function extractFromDocument(
  content: string,
  documentType: "rfp" | "sow" | "specification" | "drawing" | "other"
): Promise<DocumentExtractionResult> {
  const startTime = Date.now();

  if (!aiClient.isConfigured()) {
    return {
      projectName: null,
      clientName: null,
      projectAddress: null,
      estimatedValue: null,
      contacts: [],
      timeline: {},
      deliverables: [],
      requirements: [],
      riskFlags: [],
      insuranceRequirements: [],
      specialConditions: [],
      budgetConstraints: null,
      buildingType: null,
      estimatedSqft: null,
      scope: null,
      analysisTime: 0,
      error: "AI service not configured",
    };
  }

  try {
    const truncatedContent = content.slice(0, 15000);

    const result = await aiClient.chatJSON<{
      projectName: string | null;
      clientName: string | null;
      projectAddress: string | null;
      estimatedValue: number | null;
      contacts: { name: string; role?: string; email?: string; phone?: string; company?: string }[];
      timeline: { dueDate?: string; milestones?: string[] };
      deliverables: string[];
      requirements: { category: string; requirement: string; priority: string; source: string }[];
      riskFlags: { type: string; description: string; severity: string; recommendation: string }[];
      insuranceRequirements: string[];
      specialConditions: string[];
      budgetConstraints: string | null;
      buildingType: string | null;
      estimatedSqft: number | null;
      scope: string | null;
    }>({
      messages: [
        { role: "system", content: DOCUMENT_EXTRACTION_PROMPT },
        {
          role: "user",
          content: `Extract project information from this ${documentType.toUpperCase()} document:

${truncatedContent}

Return JSON with this structure:
{
  "projectName": "Project Name",
  "clientName": "Client Company",
  "projectAddress": "123 Main St, City, State",
  "estimatedValue": 25000,
  "contacts": [{ "name": "John Smith", "role": "Project Manager", "email": "john@client.com", "phone": "555-1234", "company": "Client Co" }],
  "timeline": { "dueDate": "2026-03-15", "milestones": ["Site survey by Jan 30", "Final deliverables by Mar 15"] },
  "deliverables": ["As-built BIM model", "Point cloud data", "2D drawings"],
  "requirements": [{ "category": "Technical", "requirement": "LOD 300 Revit model", "priority": "must-have", "source": "Section 3.2" }],
  "riskFlags": [{ "type": "Timeline", "description": "Very tight 2-week deadline", "severity": "high", "recommendation": "Negotiate extended timeline or additional resources" }],
  "insuranceRequirements": ["$2M general liability", "Professional E&O required"],
  "specialConditions": ["Overnight work only", "Security clearance required"],
  "budgetConstraints": "Not to exceed $30,000",
  "buildingType": "office",
  "estimatedSqft": 50000,
  "scope": "full"
}`,
        },
      ],
      temperature: 0.2,
      maxTokens: 4000,
    });

    if (!result) {
      return {
        projectName: null,
        clientName: null,
        projectAddress: null,
        estimatedValue: null,
        contacts: [],
        timeline: {},
        deliverables: [],
        requirements: [],
        riskFlags: [],
        insuranceRequirements: [],
        specialConditions: [],
        budgetConstraints: null,
        buildingType: null,
        estimatedSqft: null,
        scope: null,
        analysisTime: Date.now() - startTime,
        error: "AI returned no results",
      };
    }

    log(`[AI Document] Extraction complete: ${result.contacts.length} contacts, ${result.riskFlags.length} risk flags`);

    return {
      ...result,
      requirements: result.requirements.map((r) => ({
        ...r,
        priority: r.priority as "must-have" | "nice-to-have" | "optional",
      })),
      riskFlags: result.riskFlags.map((r) => ({
        ...r,
        severity: r.severity as "low" | "medium" | "high" | "critical",
      })),
      analysisTime: Date.now() - startTime,
    };
  } catch (error: any) {
    log(`ERROR: [AI Document] Extraction failed: ${error?.message || error}`);
    return {
      projectName: null,
      clientName: null,
      projectAddress: null,
      estimatedValue: null,
      contacts: [],
      timeline: {},
      deliverables: [],
      requirements: [],
      riskFlags: [],
      insuranceRequirements: [],
      specialConditions: [],
      budgetConstraints: null,
      buildingType: null,
      estimatedSqft: null,
      scope: null,
      analysisTime: Date.now() - startTime,
      error: error?.message || "Extraction failed",
    };
  }
}
