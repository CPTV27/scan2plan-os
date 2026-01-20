import { Request, Response, Express } from "express";
import { isAuthenticated, requireRole } from "../replit_integrations/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { testGHLConnection, syncGHLOpportunities } from "../gohighlevel";
import { log } from "../lib/logger";

export function registerGHLRoutes(app: Express): void {
  app.get("/api/ghl/status", isAuthenticated, requireRole("ceo"), asyncHandler(async (req: Request, res: Response) => {
    const hasApiKey = !!process.env.GHL_API_KEY;
    const hasLocationId = !!process.env.GHL_LOCATION_ID;
    
    res.json({
      configured: hasApiKey && hasLocationId,
      hasApiKey,
      hasLocationId,
    });
  }));

  app.post("/api/ghl/test", isAuthenticated, requireRole("ceo"), asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await testGHLConnection();
      res.json(result);
    } catch (error: any) {
      log("ERROR: GHL test connection failed - " + (error?.message || error));
      res.json({
        connected: false,
        message: error?.message || "Connection test failed",
      });
    }
  }));

  app.post("/api/ghl/sync", isAuthenticated, requireRole("ceo"), asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await syncGHLOpportunities();
      
      log(`GHL Sync completed: ${result.synced} opportunities synced`);
      if (result.errors.length > 0) {
        log(`GHL Sync errors: ${result.errors.join(", ")}`);
      }
      
      res.json({
        success: result.errors.length === 0,
        synced: result.synced,
        errors: result.errors,
        opportunities: result.opportunities,
      });
    } catch (error: any) {
      log("ERROR: GHL sync failed - " + (error?.message || error));
      res.status(500).json({
        success: false,
        synced: 0,
        errors: [error?.message || "Sync failed"],
        opportunities: [],
      });
    }
  }));
}
