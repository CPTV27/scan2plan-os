import { aiClient } from "./aiClient";
import { log } from "../../lib/logger";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export interface ExtractedCPQData {
  projectName?: string;
  clientName?: string;
  projectAddress?: string;
  buildingType?: string;
  squareFeet?: number;
  lod?: string;
  scope?: string;
  disciplines?: string[];
  dispatchLocation?: string;
  notes?: string;
}

export interface CPQChatResult {
  response: string;
  extractedData: ExtractedCPQData;
  readyToCreate: boolean;
  missingFields: string[];
  confidence: number;
  error?: string;
}

const CPQ_SYSTEM_PROMPT = `You are a friendly and efficient sales assistant for Scan2Plan, a laser scanning and BIM services company.

Your job is to help users create quotes by having a natural conversation. Gather the following information:
1. Project name and client name
2. Project address/location
3. Building type (office, warehouse, industrial, retail, healthcare, education, etc.)
4. Approximate square footage
5. Level of Development (LOD 200, 300, or 350)
6. Scope (full interior+exterior, interior only, exterior only)
7. Disciplines needed (architecture, MEP/F, structure, site)
8. Dispatch location (Brooklyn or Woodstock NY)

Be conversational and helpful. Ask clarifying questions when needed. When you have enough information, let the user know you're ready to create the quote.

Laser scanning pricing context:
- Standard rates: ~$0.08-0.12/sqft for scanning, varies by LOD
- Brooklyn dispatch: $0 base fee for large projects (50k+ sqft), tiered fees for smaller
- Woodstock dispatch: $3/mile flat rate
- Additional disciplines add to modeling complexity`;

const REQUIRED_FIELDS = [
  "projectName",
  "buildingType",
  "squareFeet",
  "lod",
  "scope",
  "disciplines",
];

export async function processCPQChat(
  userMessage: string,
  conversationHistory: ChatMessage[],
  currentData: ExtractedCPQData
): Promise<CPQChatResult> {
  if (!aiClient.isConfigured()) {
    return {
      response: "I'm sorry, but the AI assistant is not currently available. Please use the quote builder form directly.",
      extractedData: currentData,
      readyToCreate: false,
      missingFields: REQUIRED_FIELDS,
      confidence: 0,
      error: "AI service not configured",
    };
  }

  try {
    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: CPQ_SYSTEM_PROMPT },
    ];

    for (const msg of conversationHistory.slice(-10)) {
      messages.push({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      });
    }

    messages.push({
      role: "user",
      content: `Current extracted data: ${JSON.stringify(currentData)}

User says: "${userMessage}"

Respond naturally AND extract any new project information mentioned. Return JSON:
{
  "response": "Your conversational response to the user",
  "extractedData": {
    "projectName": "extracted or null",
    "clientName": "extracted or null",
    "projectAddress": "extracted or null",
    "buildingType": "extracted or null",
    "squareFeet": 0 or null,
    "lod": "200/300/350 or null",
    "scope": "full/interior/exterior or null",
    "disciplines": ["architecture", "mepf"] or null,
    "dispatchLocation": "BROOKLYN/WOODSTOCK or null",
    "notes": "any additional notes or null"
  },
  "readyToCreate": false,
  "confidence": 0-100
}`,
    });

    const result = await aiClient.chatJSON<{
      response: string;
      extractedData: ExtractedCPQData;
      readyToCreate: boolean;
      confidence: number;
    }>({
      messages,
      temperature: 0.7,
    });

    if (!result) {
      return {
        response: "I'm having trouble processing that. Could you please rephrase?",
        extractedData: currentData,
        readyToCreate: false,
        missingFields: REQUIRED_FIELDS,
        confidence: 0,
        error: "AI returned no results",
      };
    }

    const mergedData: ExtractedCPQData = {
      ...currentData,
      ...Object.fromEntries(
        Object.entries(result.extractedData).filter(([_, v]) => v !== null && v !== undefined)
      ),
    };

    const missingFields = REQUIRED_FIELDS.filter((field) => {
      const value = mergedData[field as keyof ExtractedCPQData];
      return value === undefined || value === null || value === "" || 
        (Array.isArray(value) && value.length === 0);
    });

    log(`[AI CPQ Chat] Processed message, ${missingFields.length} fields missing`);

    return {
      response: result.response,
      extractedData: mergedData,
      readyToCreate: missingFields.length === 0 || result.readyToCreate,
      missingFields,
      confidence: result.confidence,
    };
  } catch (error: any) {
    log(`ERROR: [AI CPQ Chat] Processing failed: ${error?.message || error}`);
    return {
      response: "I encountered an error processing your request. Please try again.",
      extractedData: currentData,
      readyToCreate: false,
      missingFields: REQUIRED_FIELDS,
      confidence: 0,
      error: error?.message || "Processing failed",
    };
  }
}
