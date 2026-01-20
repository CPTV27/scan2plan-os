import { z } from "zod";
import { log } from "../lib/logger";

/**
 * Environment Configuration Schema
 * 
 * This centralizes all environment variable validation and provides type-safe access.
 * The application will fail fast on startup if required variables are missing.
 */

const envSchema = z.object({
    // Node Environment
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.string().default("5000"),

    // Database
    DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL connection string"),

    // Session & Auth
    SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
    ISSUER_URL: z.string().url().optional(),
    REPL_ID: z.string().optional(),

    // Replit Environment Detection
    REPLIT_DEPLOYMENT: z.string().optional(),
    REPLIT_DOMAINS: z.string().optional(),
    REPLIT_DEV_DOMAIN: z.string().optional(),
    REPLIT_DEPLOYMENT_URL: z.string().optional(),
    REPL_SLUG: z.string().optional(),
    REPL_OWNER: z.string().optional(),

    // Replit Connectors
    REPLIT_CONNECTORS_HOSTNAME: z.string().optional(),
    REPL_IDENTITY: z.string().optional(),
    WEB_REPL_RENEWAL: z.string().optional(),

    // AI Services (Optional - features disabled if not provided)
    AI_INTEGRATIONS_OPENAI_API_KEY: z.string().optional(),
    AI_INTEGRATIONS_OPENAI_BASE_URL: z.string().url().optional(),
    AI_DEFAULT_MODEL: z.string().default("gpt-4o"),
    AI_EMBEDDINGS_MODEL: z.string().default("text-embedding-3-small"),
    OPENAI_API_KEY: z.string().optional(), // Legacy support

    // Google Services (Optional)
    GOOGLE_MAPS_API_KEY: z.string().optional(),
    GOOGLE_APPLICATION_CREDENTIALS_JSON: z.string().optional(),
    GCS_DELIVERY_BUCKET: z.string().default("scan2plan-deliverables"),
    GOOGLE_CHAT_WEBHOOK_SALES: z.string().url().optional(),
    GOOGLE_CHAT_WEBHOOK_OPS: z.string().url().optional(),

    // Third-Party Integrations (Optional)
    PANDADOC_API_KEY: z.string().optional(),
    HUBSPOT_API_KEY: z.string().optional(),
    AIRTABLE_API_KEY: z.string().optional(),
    AIRTABLE_BASE_ID: z.string().optional(),

    // Testing
    PLAYWRIGHT_TEST: z.string().optional(),

    // App Configuration
    APP_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

/**
 * Validates and returns the environment configuration.
 * Throws an error if validation fails.
 */
export function getEnv(): Env {
    if (_env) return _env;

    try {
        _env = envSchema.parse(process.env);
        log("✅ Environment configuration validated successfully");
        return _env;
    } catch (error) {
        if (error instanceof z.ZodError) {
            log("❌ Environment validation failed:");
            error.errors.forEach((err) => {
                log(`  - ${err.path.join(".")}: ${err.message}`);
            });
            throw new Error("Invalid environment configuration. Check logs for details.");
        }
        throw error;
    }
}

/**
 * Typed environment variable access.
 * Use this instead of process.env for type safety.
 */
export const env = new Proxy({} as Env, {
    get(_target, prop: string) {
        const config = getEnv();
        return config[prop as keyof Env];
    },
});

/**
 * Check if a feature is enabled based on environment configuration
 */
export const features = {
    hasOpenAI: () => {
        const config = getEnv();
        return !!(config.AI_INTEGRATIONS_OPENAI_API_KEY || config.OPENAI_API_KEY);
    },
    hasPandaDoc: () => {
        const config = getEnv();
        return !!config.PANDADOC_API_KEY;
    },
    hasGoogleMaps: () => {
        const config = getEnv();
        return !!config.GOOGLE_MAPS_API_KEY;
    },
    hasHubSpot: () => {
        const config = getEnv();
        return !!config.HUBSPOT_API_KEY;
    },
    hasAirtable: () => {
        const config = getEnv();
        return !!(config.AIRTABLE_API_KEY && config.AIRTABLE_BASE_ID);
    },
    hasGCS: () => {
        const config = getEnv();
        // Support both env var names for backward compatibility
        return !!(config.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GCS_SERVICE_ACCOUNT_JSON);
    },
    isProduction: () => {
        const config = getEnv();
        return config.NODE_ENV === "production";
    },
    isTest: () => {
        const config = getEnv();
        return config.NODE_ENV === "test";
    },
};
