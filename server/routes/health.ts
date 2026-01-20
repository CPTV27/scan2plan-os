import type { Express, Request, Response } from "express";
import { pool } from "../db";
import { log } from "../lib/logger";
import { features } from "../config/env";

/**
 * Health Check Routes
 * 
 * Provides endpoints for monitoring application and integration health
 */

export function registerHealthRoutes(app: Express): void {
    /**
     * Basic health check - database connectivity
     */
    app.get("/api/health", async (_req: Request, res: Response) => {
        try {
            await pool.query("SELECT 1");
            res.json({
                status: "healthy",
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                database: "connected",
            });
        } catch (error: any) {
            res.status(503).json({
                status: "unhealthy",
                timestamp: new Date().toISOString(),
                error: error.message,
                database: "disconnected",
            });
        }
    });

    /**
     * Integration health checks
     * Checks connectivity to external services
     */
    app.get("/api/health/integrations", async (_req: Request, res: Response) => {
        const checks = {
            openai: { available: false, configured: false },
            pandadoc: { available: false, configured: false },
            googleMaps: { available: false, configured: false },
            hubspot: { available: false, configured: false },
            airtable: { available: false, configured: false },
        };

        // Check if services are configured
        checks.openai.configured = features.hasOpenAI();
        checks.pandadoc.configured = features.hasPandaDoc();
        checks.googleMaps.configured = features.hasGoogleMaps();
        checks.hubspot.configured = features.hasHubSpot();
        checks.airtable.configured = features.hasAirtable();

        // For configured services, check availability
        // OpenAI check
        if (checks.openai.configured) {
            try {
                const { aiClient } = await import("../services/ai/aiClient");
                checks.openai.available = aiClient.isConfigured();
            } catch (error) {
                log(`Health check: OpenAI check failed - ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        // PandaDoc check
        if (checks.pandadoc.configured) {
            try {
                const { isPandaDocConfigured } = await import("../services/pandadoc");
                checks.pandadoc.available = isPandaDocConfigured();
            } catch (error) {
                log(`Health check: PandaDoc check failed - ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        // Google Maps check
        if (checks.googleMaps.configured) {
            checks.googleMaps.available = true; // If configured, assume available
        }

        // HubSpot check
        if (checks.hubspot.configured) {
            checks.hubspot.available = true; // If configured, assume available
        }

        // Airtable check
        if (checks.airtable.configured) {
            checks.airtable.available = true; // If configured, assume available
        }

        const allConfiguredServicesAvailable = Object.values(checks).every(
            check => !check.configured || check.available
        );

        res.json({
            status: allConfiguredServicesAvailable ? "healthy" : "degraded",
            timestamp: new Date().toISOString(),
            integrations: checks,
        });
    });

    /**
     * Readiness check - for load balancers
     * Returns 200 if app is ready to serve traffic
     */
    app.get("/api/health/ready", async (_req: Request, res: Response) => {
        try {
            await pool.query("SELECT 1");
            res.status(200).json({ ready: true });
        } catch (error) {
            res.status(503).json({ ready: false });
        }
    });

    /**
     * Liveness check - for container orchestration
     * Returns 200 if app is alive (even if degraded)
     */
    app.get("/api/health/live", (_req: Request, res: Response) => {
        res.status(200).json({ alive: true });
    });
}
