import OpenAI from "openai";
import { log } from "../../lib/logger";
import crypto from "crypto";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// LRU Cache for AI responses - reduces redundant API calls
const CACHE_MAX_SIZE = 500;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private ttlMs: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize: number, ttlMs: number) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;
    return entry.value;
  }

  set(key: string, value: T): void {
    // Delete if exists to update position
    this.cache.delete(key);

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, { value, timestamp: Date.now() });
  }

  getStats(): { hits: number; misses: number; size: number; hitRate: string } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      hitRate: total > 0 ? `${((this.hits / total) * 100).toFixed(1)}%` : "0%",
    };
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

interface ChatParams {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  responseFormat?: "json_object" | "text";
  maxTokens?: number;
  skipCache?: boolean; // Force fresh response
}

interface EmbeddingResult {
  embedding: number[];
  tokensUsed: number;
}

// Singleton caches
const chatCache = new LRUCache<string>(CACHE_MAX_SIZE, CACHE_TTL_MS);
const embeddingCache = new LRUCache<EmbeddingResult>(CACHE_MAX_SIZE, CACHE_TTL_MS);

function generateCacheKey(data: unknown): string {
  const hash = crypto.createHash("sha256");
  hash.update(JSON.stringify(data));
  return hash.digest("hex").slice(0, 16);
}

export class AIClient {
  private openai: OpenAI;
  private defaultModel: string;
  private embeddingsModel: string;

  constructor() {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

    if (!apiKey) {
      log("WARN: [AIClient] OpenAI API key not configured");
    }

    this.openai = new OpenAI({
      apiKey: apiKey || "",
      baseURL: baseURL || undefined,
    });

    this.defaultModel = process.env.AI_DEFAULT_MODEL || "gpt-4o";
    this.embeddingsModel = process.env.AI_EMBEDDINGS_MODEL || "text-embedding-3-small";
  }

  async chat(params: ChatParams): Promise<string | null> {
    const { messages, model, temperature, responseFormat, maxTokens, skipCache } = params;

    // Generate cache key from deterministic params (temperature affects output)
    const cacheKey = generateCacheKey({
      messages,
      model: model || this.defaultModel,
      temperature: temperature ?? 0.3,
      responseFormat,
    });

    // Check cache first (unless skipCache is set)
    if (!skipCache) {
      const cached = chatCache.get(cacheKey);
      if (cached) {
        log(`[AIClient] Cache hit for chat request`);
        return cached;
      }
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.openai.chat.completions.create({
          model: model || this.defaultModel,
          messages: messages as any,
          temperature: temperature ?? 0.3,
          max_tokens: maxTokens,
          ...(responseFormat === "json_object" && {
            response_format: { type: "json_object" },
          }),
        });

        const result = response.choices[0]?.message?.content || null;

        // Cache the result
        if (result) {
          chatCache.set(cacheKey, result);
        }

        return result;
      } catch (error: any) {
        const isRateLimit = error?.status === 429;
        const isRetryable = isRateLimit || error?.status >= 500;

        if (isRateLimit) {
          log(`WARN: [AIClient] Rate limit hit, attempt ${attempt}/${MAX_RETRIES}`);
        } else {
          log(`ERROR: [AIClient] Chat error: ${error?.message || error}`);
        }

        if (isRetryable && attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        throw error;
      }
    }

    return null;
  }

  async chatJSON<T>(params: ChatParams): Promise<T | null> {
    const result = await this.chat({
      ...params,
      responseFormat: "json_object",
    });

    if (!result) return null;

    try {
      return JSON.parse(result) as T;
    } catch (error) {
      log(`ERROR: [AIClient] Failed to parse JSON response: ${error}`);
      return null;
    }
  }

  async embed(text: string, skipCache = false): Promise<EmbeddingResult | null> {
    const cacheKey = generateCacheKey({ text, model: this.embeddingsModel });

    // Check cache first
    if (!skipCache) {
      const cached = embeddingCache.get(cacheKey);
      if (cached) {
        log(`[AIClient] Cache hit for embedding request`);
        return cached;
      }
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingsModel,
        input: text,
      });

      const result = {
        embedding: response.data[0].embedding,
        tokensUsed: response.usage?.total_tokens || 0,
      };

      // Cache the result
      embeddingCache.set(cacheKey, result);

      return result;
    } catch (error: any) {
      log(`ERROR: [AIClient] Embedding error: ${error?.message || error}`);
      return null;
    }
  }

  async embedBatch(texts: string[]): Promise<(EmbeddingResult | null)[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingsModel,
        input: texts,
      });

      return response.data.map((item) => ({
        embedding: item.embedding,
        tokensUsed: Math.floor((response.usage?.total_tokens || 0) / texts.length),
      }));
    } catch (error: any) {
      log(`ERROR: [AIClient] Batch embedding error: ${error?.message || error}`);
      return texts.map(() => null);
    }
  }

  isConfigured(): boolean {
    return !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  }

  async generateText(systemPrompt: string, userMessage: string, options?: { maxTokens?: number; temperature?: number }): Promise<string | null> {
    return this.chat({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      maxTokens: options?.maxTokens,
      temperature: options?.temperature,
    });
  }

  getCacheStats(): { chat: ReturnType<typeof chatCache.getStats>; embedding: ReturnType<typeof embeddingCache.getStats> } {
    return {
      chat: chatCache.getStats(),
      embedding: embeddingCache.getStats(),
    };
  }

  clearCache(): void {
    chatCache.clear();
    embeddingCache.clear();
    log("[AIClient] Cache cleared");
  }

  async transcribe(file: any, prompt?: string): Promise<string | null> {
    try {
      const response = await this.openai.audio.transcriptions.create({
        file,
        model: "whisper-1",
        prompt,
      });
      return response.text;
    } catch (error: any) {
      log(`ERROR: [AIClient] Transcription error: ${error?.message || error}`);
      return null;
    }
  }

  async chatStream(params: Omit<ChatParams, "responseFormat">): Promise<AsyncIterable<string>> {
    const { messages, model, temperature, maxTokens } = params;

    const stream = await this.openai.chat.completions.create({
      model: model || this.defaultModel,
      messages: messages as any,
      temperature: temperature ?? 0.3,
      max_tokens: maxTokens,
      stream: true,
    });

    return {
      async *[Symbol.asyncIterator]() {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            yield content;
          }
        }
      },
    };
  }
}

export const aiClient = new AIClient();

export function getAICacheStats() {
  return aiClient.getCacheStats();
}
