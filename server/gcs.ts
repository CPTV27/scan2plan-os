import { Storage } from "@google-cloud/storage";
import { log } from "./lib/logger";

let storage: Storage | null = null;
const BUCKET_NAME = process.env.GCS_DELIVERY_BUCKET || "scan2plan-deliverables";

function getStorageClient(): Storage {
    if (!storage) {
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
            // Parse credentials from environment variable if provided as JSON string
            const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
            storage = new Storage({ credentials });
        } else {
            // Fallback to default auth or other env vars
            storage = new Storage();
        }
    }
    return storage;
}

export async function generateUploadUrl(
    filePath: string,
    contentType: string
): Promise<{ url: string; publicUrl: string }> {
    try {
        const storage = getStorageClient();
        const bucket = storage.bucket(BUCKET_NAME);
        const file = bucket.file(filePath);

        // Get a v4 signed URL for uploading file
        const [url] = await file.getSignedUrl({
            version: "v4",
            action: "write",
            expires: Date.now() + 15 * 60 * 1000, // 15 minutes
            contentType,
        });

        // Public URL (assuming bucket is public or we use signed read URLs later)
        // For Potree, we ideally want public readability or we act as proxy.
        // Assuming signed URL for read is safer for now if bucket is private.
        const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${filePath}`;

        return { url, publicUrl };
    } catch (error) {
        log(`ERROR: GCS Upload URL generation failed - ${error}`);
        throw new Error("Failed to generate upload URL");
    }
}

export async function generateReadUrl(filePath: string): Promise<string> {
    try {
        const storage = getStorageClient();
        const bucket = storage.bucket(BUCKET_NAME);
        const file = bucket.file(filePath);

        // Get a v4 signed URL for reading file
        const [url] = await file.getSignedUrl({
            version: "v4",
            action: "read",
            expires: Date.now() + 60 * 60 * 1000, // 1 hour
        });
        return url;
    } catch (error) {
        log(`ERROR: GCS Read URL generation failed - ${error}`);
        throw new Error("Failed to generate read URL");
    }
}

export async function listFiles(prefix: string): Promise<string[]> {
    try {
        const storage = getStorageClient();
        const bucket = storage.bucket(BUCKET_NAME);
        const [files] = await bucket.getFiles({ prefix });
        return files.map(f => f.name);
    } catch (error) {
        log(`ERROR: GCS List Files failed - ${error}`);
        return [];
    }
}
