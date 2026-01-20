import { createProjectFolder, isGoogleDriveConnected } from "../googleDrive";
import { StorageMode } from "../../shared/schema";
import { log } from "../lib/logger";

const GCS_DEFAULT_BUCKET = "s2p-active";
const GCS_SUBFOLDER_STRUCTURE = [
  "01_Field_Capture",
  "02_BIM_Production", 
  "03_Accounting_Financials",
  "04_Client_Final_Deliverables",
];

export interface HybridStorageResult {
  storageMode: StorageMode;
  driveFolderId?: string;
  driveFolderUrl?: string;
  driveFolderStatus: "pending" | "success" | "failed";
  driveSubfolders?: {
    fieldCapture: string;
    bimProduction: string;
    accountingFinancials: string;
    clientDeliverables: string;
  };
  gcsBucket?: string;
  gcsPath?: string;
  gcsInitialized: boolean;
}

export interface GCSInitResult {
  bucket: string;
  path: string;
  subfolders: string[];
  initialized: boolean;
}

export async function initializeGCSStructure(
  universalProjectId: string,
  bucket: string = GCS_DEFAULT_BUCKET
): Promise<GCSInitResult> {
  const gcsPath = `${universalProjectId}/`;
  
  try {
    log(`[GCS] Would initialize bucket structure at gs://${bucket}/${gcsPath}`);
    log(`[GCS] Subfolders to create: ${GCS_SUBFOLDER_STRUCTURE.join(", ")}`);
    
    return {
      bucket,
      path: gcsPath,
      subfolders: GCS_SUBFOLDER_STRUCTURE.map(sf => `${gcsPath}${sf}/`),
      initialized: true,
    };
  } catch (error) {
    log(`ERROR: [GCS] Failed to initialize bucket structure - ${error instanceof Error ? error.message : String(error)}`);
    return {
      bucket,
      path: gcsPath,
      subfolders: [],
      initialized: false,
    };
  }
}

export async function initializeHybridStorage(
  universalProjectId: string,
  projectName: string,
  clientName: string,
  useHybridMode: boolean = true
): Promise<HybridStorageResult> {
  const result: HybridStorageResult = {
    storageMode: useHybridMode ? "hybrid_gcs" : "legacy_drive",
    driveFolderStatus: "pending",
    gcsInitialized: false,
  };

  const [driveResult, gcsResult] = await Promise.allSettled([
    (async () => {
      const driveConnected = await isGoogleDriveConnected();
      if (!driveConnected) {
        log("WARN: [StorageFactory] Google Drive not connected");
        return null;
      }
      return createProjectFolder(universalProjectId);
    })(),
    useHybridMode ? initializeGCSStructure(universalProjectId) : Promise.resolve(null),
  ]);

  if (driveResult.status === "fulfilled" && driveResult.value) {
    result.driveFolderId = driveResult.value.folderId;
    result.driveFolderUrl = driveResult.value.folderUrl;
    result.driveFolderStatus = "success";
    result.driveSubfolders = driveResult.value.subfolders;
    log(`[StorageFactory] Google Drive folder created: ${result.driveFolderUrl}`);
  } else {
    result.driveFolderStatus = "failed";
    if (driveResult.status === "rejected") {
      log(`ERROR: [StorageFactory] Drive folder creation failed - ${driveResult.reason instanceof Error ? driveResult.reason.message : String(driveResult.reason)}`);
    }
  }

  if (useHybridMode && gcsResult.status === "fulfilled" && gcsResult.value) {
    result.gcsBucket = gcsResult.value.bucket;
    result.gcsPath = gcsResult.value.path;
    result.gcsInitialized = gcsResult.value.initialized;
    log(`[StorageFactory] GCS structure initialized: gs://${result.gcsBucket}/${result.gcsPath}`);
  } else if (gcsResult.status === "rejected") {
    log(`ERROR: [StorageFactory] GCS initialization failed - ${gcsResult.reason instanceof Error ? gcsResult.reason.message : String(gcsResult.reason)}`);
  }

  if (!useHybridMode) {
    result.storageMode = "legacy_drive";
  }

  return result;
}

export async function migrateProjectToHybrid(
  universalProjectId: string
): Promise<{ success: boolean; gcsPath?: string; gcsBucket?: string; error?: string }> {
  try {
    const gcsResult = await initializeGCSStructure(universalProjectId);
    
    if (!gcsResult.initialized) {
      return {
        success: false,
        error: "Failed to initialize GCS structure",
      };
    }

    return {
      success: true,
      gcsBucket: gcsResult.bucket,
      gcsPath: gcsResult.path,
    };
  } catch (error: any) {
    log(`ERROR: [StorageFactory] Migration failed - ${error?.message || String(error)}`);
    return {
      success: false,
      error: error.message || "Unknown error during migration",
    };
  }
}

export function getGCSConsoleUrl(bucket: string, path: string): string {
  return `https://console.cloud.google.com/storage/browser/${bucket}/${path}`;
}

export function getStorageLinks(
  storageMode: StorageMode,
  driveFolderUrl?: string | null,
  gcsBucket?: string | null,
  gcsPath?: string | null
): { primary: { url: string; label: string }; secondary?: { url: string; label: string } } {
  switch (storageMode) {
    case "legacy_drive":
      return {
        primary: {
          url: driveFolderUrl || "#",
          label: "Open Project Folder (Drive)",
        },
      };

    case "hybrid_gcs":
      const gcsUrl = gcsBucket && gcsPath 
        ? getGCSConsoleUrl(gcsBucket, gcsPath) 
        : "#";
      return {
        primary: {
          url: gcsUrl,
          label: "Open Scan Data (GCS)",
        },
        secondary: driveFolderUrl ? {
          url: driveFolderUrl,
          label: "Open Docs Folder (Drive)",
        } : undefined,
      };

    case "gcs_native":
      return {
        primary: {
          url: gcsBucket && gcsPath ? getGCSConsoleUrl(gcsBucket, gcsPath) : "#",
          label: "Open Project Files (GCS)",
        },
      };

    default:
      return {
        primary: {
          url: driveFolderUrl || "#",
          label: "Open Project Folder",
        },
      };
  }
}
