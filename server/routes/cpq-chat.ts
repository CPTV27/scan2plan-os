/**
 * CPQ Quote Assistant - AI Chat for Quote Builder
 * 
 * This agent understands Scan2Plan's pricing logic and can update
 * quote parameters through natural language conversation.
 */

import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { isAuthenticated } from "../replit_integrations/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { log } from "../lib/logger";

export const cpqChatRouter = Router();

// Pricing knowledge to inject into the AI
const PRICING_KNOWLEDGE = `
## Scan2Plan CPQ Pricing Knowledge

### Building Types (ID -> Label)
1: Commercial - Simple
2: Residential - Standard
3: Residential - Luxury
4: Commercial / Office
5: Retail / Restaurants
6: Kitchen / Catering Facilities
7: Education
8: Hotel / Theatre / Museum
9: Hospitals / Mixed Use
10: Mechanical / Utility Rooms
11: Warehouse / Storage
12: Religious Buildings
13: Infrastructure / Roads / Bridges
14: Built Landscape (per acre)
15: Natural Landscape (per acre)
16: ACT (Above Ceiling Tiles)

### Disciplines
- arch (Architecture)
- mepf (MEP/F - Mechanical, Electrical, Plumbing, Fire Protection)
- structure (Structure)
- site (Grade - exterior grade/terrain around building)

### LOD Options (Level of Detail)
- 200: Basic modeling
- 300: Detailed modeling (most common)
- 350: High detail modeling

### Scope Options
- full: Interior + Exterior (100%)
- interior: Interior only (65% of full)
- exterior: Exterior only (35% of full)

### Dispatch Locations
- brooklyn: NYC metro area (tiered pricing based on project size)
- woodstock: Upstate NY
- troy: Capital region
- fly_out: Requires airfare + hotel

### Risk Factors (apply to Architecture only)
- occupied: Occupied building (+15% on Arch)
- hazardous: Hazardous conditions (+25% on Arch)
- no_power: No power/HVAC (+20% on Arch)

### Payment Terms
- standard: Net 30 (no adjustment)
- prepaid: Full payment upfront (-5% discount)
- net60: Extended terms (+3% surcharge)
- net90: Extended terms (+5% surcharge)

### Volume Discounts (by total sqft)
- 0-5k sqft: No discount
- 5k-10k: 5% discount
- 10k-20k: 10% discount
- 20k-30k: 15% discount
- 30k-40k: 18% discount
- 40k-50k: 20% discount
- 50k-75k: 22% discount
- 75k-100k: 25% discount
- 100k+: 28% discount

### Landscape Pricing (per acre, tiered by acreage)
Built Landscape rates (LOD 300): $150-200/acre
Natural Landscape rates (LOD 300): $100-150/acre
Minimum charge: $300
`;

// Quote action types that the AI can return
interface QuoteAction {
    type: string;
    [key: string]: any;
}

interface ChatRequest {
    message: string;
    quoteState: {
        areas: Array<{
            id: string;
            name: string;
            buildingType: string;
            squareFeet: string;
            disciplines: string[];
        }>;
        landscapeAreas: Array<{
            id: string;
            name: string;
            type: "built" | "natural";
            acres: string;
            lod: string;
        }>;
        dispatchLocation: string;
        distance: number;
        risks: string[];
        paymentTerms: string;
        marginTarget?: number;
    };
    leadContext?: {
        projectName?: string;
        clientName?: string;
        projectAddress?: string;
    };
    conversationHistory?: Array<{
        role: "user" | "assistant";
        content: string;
    }>;
}

interface ChatResponse {
    response: string;
    actions: QuoteAction[];
}

function getGemini(): GoogleGenerativeAI | null {
    const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    return new GoogleGenerativeAI(apiKey);
}

function buildSystemPrompt(quoteState: ChatRequest["quoteState"], leadContext?: ChatRequest["leadContext"]): string {
    const areasDescription = quoteState.areas.map((a, idx) =>
        `  Area ${idx + 1} (id: "${a.id}"): ${a.name || "Unnamed"}, ${a.buildingType} type, ${a.squareFeet} sqft, disciplines: [${a.disciplines.join(", ")}]`
    ).join("\n");

    const landscapeDescription = quoteState.landscapeAreas.length > 0
        ? quoteState.landscapeAreas.map((a, idx) =>
            `  Landscape ${idx + 1} (id: "${a.id}"): ${a.name || "Unnamed"}, ${a.type}, ${a.acres} acres, LOD ${a.lod}`
        ).join("\n")
        : "  No landscape areas";

    return `You are the CPQ Assistant for Scan2Plan, a 3D laser scanning and BIM modeling company.

Your role is to help users configure quotes through natural conversation. You understand our pricing model and can update quote parameters.

${PRICING_KNOWLEDGE}

## Current Quote State

**IMPORTANT**: The project details below are ALREADY FILLED IN on the Lead Details page. You have all the information you need about the project. Do NOT ask for the project name, client name, or address - you already know them.

**Project**: ${leadContext?.projectName || "New Quote"}
**Client**: ${leadContext?.clientName || "Unknown"}
**Address**: ${leadContext?.projectAddress || "Not specified"}

**Building Areas**:
${areasDescription || "  No areas configured"}

**Landscape Areas**:
${landscapeDescription}

**Configuration**:
- Dispatch: ${quoteState.dispatchLocation}
- Distance: ${quoteState.distance} miles
- Risks: ${quoteState.risks.length > 0 ? quoteState.risks.join(", ") : "None"}
- Payment Terms: ${quoteState.paymentTerms}
${quoteState.marginTarget ? `- Margin Target: ${(quoteState.marginTarget * 100).toFixed(0)}%` : ""}

## Your Capabilities

You can return actions to modify the quote. Respond with a JSON object containing:
- "response": A friendly, conversational response explaining what you did
- "actions": An array of actions to apply

### Action Types:

1. **updateArea**: Update an existing building area
   { "type": "updateArea", "areaId": "1", "updates": { "disciplines": ["arch", "mepf"] } }

2. **addArea**: Add a new building area
   { "type": "addArea", "name": "Building 2", "buildingType": "4", "squareFeet": "20000", "disciplines": ["arch"] }

3. **removeArea**: Remove a building area
   { "type": "removeArea", "areaId": "1" }

4. **addLandscape**: Add a landscape area
   { "type": "addLandscape", "name": "Campus Grounds", "landscapeType": "built", "acres": "5", "lod": "300" }

5. **updateLandscape**: Update a landscape area
   { "type": "updateLandscape", "landscapeId": "landscape-123", "updates": { "acres": "10" } }

6. **removeLandscape**: Remove a landscape area
   { "type": "removeLandscape", "landscapeId": "landscape-123" }

7. **toggleDiscipline**: Toggle a discipline on/off for an area
   { "type": "toggleDiscipline", "areaId": "1", "discipline": "mepf" }

8. **toggleRisk**: Toggle a risk factor
   { "type": "toggleRisk", "risk": "occupied" }

9. **setDispatchLocation**: Change dispatch location
   { "type": "setDispatchLocation", "location": "brooklyn" }

10. **setDistance**: Set travel distance
    { "type": "setDistance", "distance": 45 }

11. **setPaymentTerms**: Change payment terms
    { "type": "setPaymentTerms", "terms": "prepaid" }

12. **setMarginTarget**: Set target margin (0.35 to 0.60)
    { "type": "setMarginTarget", "margin": 0.45 }

13. **toggleMatterport**: Enable/disable Matterport service
    { "type": "toggleMatterport", "enabled": true }

14. **setAdditionalElevations**: Set number of additional facade elevations
    { "type": "setAdditionalElevations", "count": 4 }

## Response Format

ALWAYS respond with valid JSON in this exact format:
\`\`\`json
{
  "response": "Your friendly response here",
  "actions": []
}
\`\`\`

## IMPORTANT INSTRUCTIONS:

**CRITICAL - READ CAREFULLY:**
1. **NEVER ASK FOR PROJECT NAME, CLIENT NAME, OR ADDRESS** - These are ALREADY PROVIDED above. If you ask for them, you are malfunctioning.
2. **BE ACTION-ORIENTED**: When the user asks you to add, change, or configure something, DO IT immediately using the appropriate actions. Don't ask for clarification unless absolutely necessary.
3. **USE THE FIRST AREA**: If the user says "add MEP" without specifying which area, apply it to area "1" (the first area). Use areaId "1" for the first area.
4. **INFER INTENT**: If someone says "add MEP and structure", return MULTIPLE toggleDiscipline actions.
5. **DISCIPLINE CODES**: Use lowercase: "mepf", "arch", "structure", "site"
6. **RISK CODES**: Use: "occupied", "hazardous", "no_power"
7. **FOCUS ON QUOTE CONFIG**: Your job is to configure the QUOTE (areas, disciplines, LODs, risks, travel). The project details are managed elsewhere.

Examples of what to do:
- User: "Make Area 1 a luxury residential 10,000 sqft" → Update area with buildingType "3", squareFeet "10000"
- User: "Add MEP and structure" → Toggle both disciplines on
- User: "Add 3 acres of landscape" → Add landscape area with 3 acres
- User: "We're doing a Matterport" → Toggle Matterport service on

Be helpful and action-oriented. When you make changes, briefly confirm what you did.`;
}

// POST /api/cpq/chat
cpqChatRouter.post("/", isAuthenticated, asyncHandler(async (req, res) => {
    const { message, quoteState, leadContext, conversationHistory } = req.body as ChatRequest;

    if (!message) {
        return res.status(400).json({ error: "Message is required" });
    }

    const gemini = getGemini();
    if (!gemini) {
        return res.status(503).json({
            error: "AI not configured",
            response: "I'm sorry, but the AI assistant is not currently available. Please configure the Gemini API key.",
            actions: []
        });
    }

    try {
        const systemPrompt = buildSystemPrompt(quoteState || { areas: [], landscapeAreas: [], dispatchLocation: "woodstock", distance: 0, risks: [], paymentTerms: "standard" }, leadContext);

        // Build conversation for context
        const conversationMessages = conversationHistory?.slice(-6) || []; // Last 6 messages for context
        const conversationContext = conversationMessages.map(m =>
            `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`
        ).join("\n");

        const fullPrompt = `${systemPrompt}

${conversationContext ? `## Recent Conversation\n${conversationContext}\n\n` : ""}## Current User Message
User: ${message}

Respond with JSON:`;

        const model = gemini.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 1024,
            }
        });

        const result = await model.generateContent(fullPrompt);
        const responseText = result.response.text();

        // Parse JSON from response
        let parsed: ChatResponse;
        try {
            // Extract JSON from markdown code blocks if present
            const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                responseText.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText;
            parsed = JSON.parse(jsonStr.trim());
        } catch (parseError) {
            log(`WARN: [CPQ Chat] Failed to parse AI response: ${responseText}`);
            parsed = {
                response: responseText.replace(/```json|```/g, "").trim(),
                actions: []
            };
        }

        log(`[CPQ Chat] User: "${message}" -> ${parsed.actions.length} actions`);

        res.json(parsed);

    } catch (error) {
        log(`ERROR: [CPQ Chat] ${error}`);
        res.status(500).json({
            error: "Failed to process chat message",
            response: "I encountered an error processing your request. Please try again.",
            actions: []
        });
    }
}));

export default cpqChatRouter;
