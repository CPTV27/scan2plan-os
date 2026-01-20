import { Express } from "express";
import { Storage } from "@google-cloud/storage";
import { z } from "zod";
import { storage } from "../storage";
import { GcsStorageConfig, STORAGE_MODES } from "@shared/schema";
import { validateBody } from "../middleware/validation";
import { asyncHandler } from "../middleware/errorHandler";
import { isAuthenticated, requireRole } from "../replit_integrations/auth";

function log(message: string) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${timestamp} [storage] ${message}`);
}

const gcsTestSchema = z.object({
  projectId: z.string().min(1).max(100).regex(/^[a-z][a-z0-9-]*[a-z0-9]$/, "Invalid GCP project ID format"),
  bucket: z.string().min(3).max(222).regex(/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/, "Invalid bucket name format"),
  credentials: z.string().max(50000).optional(),
});

const gcsConfigureSchema = z.object({
  projectId: z.string().min(1).max(100).regex(/^[a-z][a-z0-9-]*[a-z0-9]$/, "Invalid GCP project ID format"),
  bucket: z.string().min(3).max(222).regex(/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/, "Invalid bucket name format"),
  defaultStorageMode: z.enum(STORAGE_MODES).optional().default("hybrid_gcs"),
  credentials: z.string().max(50000).optional(),
});

export function registerStorageRoutes(app: Express) {
  app.post("/api/storage/gcs/test", isAuthenticated, requireRole("ceo"), validateBody(gcsTestSchema), asyncHandler(async (req, res) => {
    const { projectId, bucket, credentials } = req.body;

    let storageClient: Storage;

    if (credentials) {
      const credentialsObj = typeof credentials === "string" 
        ? JSON.parse(credentials) 
        : credentials;
      
      storageClient = new Storage({
        projectId,
        credentials: credentialsObj,
      });
    } else {
      const envCredentials = process.env.GCS_SERVICE_ACCOUNT_JSON;
      if (!envCredentials) {
        return res.status(400).json({ 
          success: false, 
          error: "No credentials provided and GCS_SERVICE_ACCOUNT_JSON is not set" 
        });
      }
      
      storageClient = new Storage({
        projectId,
        credentials: JSON.parse(envCredentials),
      });
    }

    const [exists] = await storageClient.bucket(bucket).exists();
    
    if (!exists) {
      return res.status(400).json({ 
        success: false, 
        error: `Bucket "${bucket}" does not exist or is not accessible` 
      });
    }

    const [metadata] = await storageClient.bucket(bucket).getMetadata();
    
    log(`GCS connection test successful: ${projectId}/${bucket}`);
    
    res.json({ 
      success: true, 
      message: "Connection successful",
      bucketLocation: metadata.location,
      bucketStorageClass: metadata.storageClass,
    });
  }));

  app.post("/api/storage/gcs/configure", isAuthenticated, requireRole("ceo"), validateBody(gcsConfigureSchema), asyncHandler(async (req, res) => {
    const { projectId, bucket, defaultStorageMode, credentials } = req.body;

    if (credentials) {
      log("Note: Credentials provided - these should be stored as GCS_SERVICE_ACCOUNT_JSON secret");
    }

    const config: GcsStorageConfig = {
      projectId,
      defaultBucket: bucket,
      configured: true,
      defaultStorageMode: defaultStorageMode || "hybrid_gcs",
      lastTestedAt: new Date().toISOString(),
    };

    await storage.updateSetting("gcsStorage", config);
    
    log(`GCS configuration saved: ${projectId}/${bucket} (mode: ${config.defaultStorageMode})`);
    
    res.json({ 
      success: true, 
      config 
    });
  }));

  app.get("/api/storage/gcs/config", isAuthenticated, asyncHandler(async (req, res) => {
    const config = await storage.getSettingValue<GcsStorageConfig>("gcsStorage");
    const hasCredentials = !!process.env.GCS_SERVICE_ACCOUNT_JSON;
    
    res.json({ 
      config: config || null,
      hasCredentials,
    });
  }));

  app.post("/api/storage/gcs/disconnect", isAuthenticated, requireRole("ceo"), asyncHandler(async (req, res) => {
    await storage.updateSetting("gcsStorage", {
      projectId: "",
      defaultBucket: "",
      configured: false,
      defaultStorageMode: "legacy_drive",
    } as GcsStorageConfig);
    
    log("GCS configuration removed");
    
    res.json({ success: true });
  }));
}
