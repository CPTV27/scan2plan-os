// server/services/ai/aiClient.ts
/**
 * Unified AI Client for Scan2Plan OS
 * Handles all interactions with OpenAI API
 */

import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: "text" | "image_url"; text?: string; image_url?: { url: string } }>;
}

export interface AIChatOptions {
  messages: AIMessage[];
  model?: string;
  temperature?: number;
  responseFormat?: "json_object" | "text";
  maxTokens?: number;
}

export class AIClient {
  private openai: OpenAI;
  private defaultModel: string;
  private maxRetries: number;
  private requestTimeout: number;

  constructor() {
    if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
      throw new Error("AI_INTEGRATIONS_OPENAI_API_KEY is required");
    }

    this.openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      timeout: parseInt(process.env.AI_REQUEST_TIMEOUT || "30000"),
      maxRetries: parseInt(process.env.AI_MAX_RETRIES || "3"),
    });

    this.defaultModel = process.env.AI_DEFAULT_MODEL || "gpt-4o";
    this.maxRetries = parseInt(process.env.AI_MAX_RETRIES || "3");
    this.requestTimeout = parseInt(process.env.AI_REQUEST_TIMEOUT || "30000");
  }

  /**
   * Send a chat completion request to OpenAI
   */
  async chat(options: AIChatOptions): Promise<string> {
    const startTime = Date.now();
    
    try {
      const response = await this.openai.chat.completions.create({
        model: options.model || this.defaultModel,
        messages: options.messages as ChatCompletionMessageParam[],
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens,
        ...(options.responseFormat === "json_object" && {
          response_format: { type: "json_object" },
        }),
      });

      const duration = Date.now() - startTime;
      console.log(`[AI] Chat completion took ${duration}ms, model: ${options.model || this.defaultModel}`);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response content from AI");
      }

      return content;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[AI] Error after ${duration}ms:`, error.message);

      if (error.status === 429) {
        throw new Error("AI rate limit exceeded. Please try again in a moment.");
      } else if (error.status === 400) {
        throw new Error("Invalid AI request. Please check your input.");
      } else if (error.code === "ECONNABORTED" || duration > this.requestTimeout) {
        throw new Error("AI request timed out. Please try again.");
      }

      throw new Error(`AI processing failed: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for text (for semantic search)
   */
  async embed(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: process.env.AI_EMBEDDINGS_MODEL || "text-embedding-3-small",
        input: text.substring(0, 8000), // Limit to 8k chars
      });

      return response.data[0].embedding;
    } catch (error: any) {
      console.error("[AI] Embedding error:", error.message);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Parse JSON response with error handling
   */
  parseJSON<T>(content: string): T {
    try {
      return JSON.parse(content) as T;
    } catch (error) {
      console.error("[AI] JSON parse error:", content.substring(0, 200));
      throw new Error("AI returned invalid JSON response");
    }
  }

  /**
   * Chat with automatic JSON parsing
   */
  async chatJSON<T>(options: Omit<AIChatOptions, "responseFormat">): Promise<T> {
    const content = await this.chat({
      ...options,
      responseFormat: "json_object",
    });

    return this.parseJSON<T>(content);
  }

  /**
   * Get token count estimate (rough approximation)
   */
  estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

// Singleton instance
export const aiClient = new AIClient();
