import OpenAI from "openai";

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
    if (!_openai) {
        _openai = new OpenAI({
            apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        });
    }
    return _openai;
}

export type EnrichedData = {
    industry?: string;
    employeeCount?: string;
    linkedinUrl?: string;
    tags?: string[];
    notes?: string;
    website?: string;
};

export async function enrichCompanyData(name: string, website?: string): Promise<EnrichedData> {
    const openai = getOpenAI();

    const prompt = `You are a business intelligence analyst. Research the company "${name}"${website ? ` (website: ${website})` : ""}.
  
  Return a JSON object with the following fields (estimate if necessary):
  - industry: A short string describing their primary industry (e.g. "Architecture", "Construction", "Real Estate").
  - employeeCount: Estimated range (e.g. "1-10", "50-200").
  - linkedinUrl: Guess the likely LinkedIn company URL if not known.
  - website: The likely website URL if not provided.
  - tags: An array of 3-5 tags relevant to their business model (e.g. "Residential", "Commercial", "BIM", "Lidar").
  - notes: A 1-sentence summary of what they do.
  
  Return ONLY valid JSON. do not include markdown formatting.`;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview", // or gpt-4o if available
            messages: [
                { role: "system", content: "You are a helpful assistant that outputs JSON." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error("No content from AI");

        const result = JSON.parse(content);
        return {
            industry: result.industry,
            employeeCount: result.employeeCount,
            linkedinUrl: result.linkedinUrl,
            tags: result.tags,
            notes: result.notes,
            website: result.website || website,
        };
    } catch (error) {
        console.error("AI Enrichment failed:", error);
        throw new Error("Failed to enrich company data via AI");
    }
}
