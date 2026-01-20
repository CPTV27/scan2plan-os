import { Storage } from "@google-cloud/storage";
import { storage as dbStorage } from "../storage";
import { GcsStorageConfig } from "@shared/schema";

const DELIVERABLES_BUCKET = "scan2plan-deliverables";
const SIGNED_URL_EXPIRY_MINUTES = 60;

function log(message: string) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${timestamp} [gcs] ${message}`);
}

let storageClient: Storage | null = null;

export async function getGcsClient(): Promise<Storage | null> {
  if (storageClient) return storageClient;

  try {
    const config = await dbStorage.getSettingValue<GcsStorageConfig>("gcsStorage");
    // Support both env var names for backward compatibility
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GCS_SERVICE_ACCOUNT_JSON;

    if (!credentials) {
      log("No GCS credentials found in environment (expected GOOGLE_APPLICATION_CREDENTIALS_JSON)");
      return null;
    }

    storageClient = new Storage({
      projectId: config?.projectId || JSON.parse(credentials).project_id,
      credentials: JSON.parse(credentials),
    });

    return storageClient;
  } catch (error) {
    log(`ERROR: Failed to initialize GCS client - ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export async function getBucket(bucketName?: string) {
  const client = await getGcsClient();
  if (!client) return null;

  const config = await dbStorage.getSettingValue<GcsStorageConfig>("gcsStorage");
  const bucket = bucketName || config?.defaultBucket || DELIVERABLES_BUCKET;

  return client.bucket(bucket);
}

export async function generateSignedUploadUrl(
  filePath: string,
  contentType: string = "application/octet-stream",
  bucketName?: string
): Promise<string | null> {
  try {
    const bucket = await getBucket(bucketName);
    if (!bucket) return null;

    const file = bucket.file(filePath);
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + SIGNED_URL_EXPIRY_MINUTES * 60 * 1000,
      contentType,
    });

    log(`Generated signed upload URL for ${filePath}`);
    return url;
  } catch (error) {
    log(`ERROR: Failed to generate signed upload URL - ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export async function generateSignedReadUrl(
  filePath: string,
  bucketName?: string,
  expiryMinutes: number = SIGNED_URL_EXPIRY_MINUTES
): Promise<string | null> {
  try {
    const bucket = await getBucket(bucketName);
    if (!bucket) return null;

    const file = bucket.file(filePath);
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + expiryMinutes * 60 * 1000,
    });

    log(`Generated signed read URL for ${filePath}`);
    return url;
  } catch (error) {
    log(`ERROR: Failed to generate signed read URL - ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export async function listProjectFiles(
  projectPath: string,
  bucketName?: string
): Promise<string[]> {
  try {
    const bucket = await getBucket(bucketName);
    if (!bucket) return [];

    const [files] = await bucket.getFiles({
      prefix: projectPath,
      delimiter: "/",
    });

    const fileNames = files
      .map(file => file.name)
      .filter(name => !name.endsWith("/"));

    log(`Listed ${fileNames.length} files in ${projectPath}`);
    return fileNames;
  } catch (error) {
    log(`ERROR: Failed to list files - ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

export async function checkFileExists(
  filePath: string,
  bucketName?: string
): Promise<boolean> {
  try {
    const bucket = await getBucket(bucketName);
    if (!bucket) return false;

    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    return exists;
  } catch (error) {
    log(`ERROR: Failed to check file existence - ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

export async function generatePotreeViewerUrl(
  potreePath: string,
  bucketName?: string
): Promise<string | null> {
  try {
    const bucket = await getBucket(bucketName);
    if (!bucket) return null;

    const config = await dbStorage.getSettingValue<GcsStorageConfig>("gcsStorage");
    const actualBucket = bucketName || config?.defaultBucket || DELIVERABLES_BUCKET;
    
    return `https://storage.googleapis.com/${actualBucket}/${potreePath}`;
  } catch (error) {
    log(`ERROR: Failed to generate Potree viewer URL - ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export function getPublicGcsUrl(bucketName: string, path: string): string {
  return `https://storage.googleapis.com/${bucketName}/${path}`;
}

export async function streamGcsFile(
  filePath: string,
  bucketName?: string
): Promise<NodeJS.ReadableStream | null> {
  try {
    const bucket = await getBucket(bucketName);
    if (!bucket) return null;

    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    if (!exists) {
      log(`File not found for streaming: ${filePath}`);
      return null;
    }

    return file.createReadStream();
  } catch (error) {
    log(`ERROR: Failed to stream GCS file - ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
