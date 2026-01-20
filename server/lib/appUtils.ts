import crypto from "crypto";

/**
 * App Utilities
 * 
 * General utilities for the application - URL handling, webhook verification, etc.
 */

/**
 * Gets the base URL for the application
 */
export function getBaseUrl(): string {
    // Custom app URL (recommended)
    if (process.env.APP_URL) {
        return process.env.APP_URL;
    }

    // Production with custom domain
    if (process.env.NODE_ENV === 'production' && process.env.PUBLIC_URL) {
        return process.env.PUBLIC_URL;
    }

    // Fallback to localhost with port
    const port = process.env.PORT || '5000';
    return `http://localhost:${port}`;
}

/**
 * Generates a webhook signature for verification
 */
export function generateWebhookSignature(payload: string, secret: string): string {
    return crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
}

/**
 * Verifies a webhook signature using timing-safe comparison
 */
export function verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
): boolean {
    const expectedSignature = generateWebhookSignature(payload, secret);

    // Timing-safe comparison to prevent timing attacks
    if (signature.length !== expectedSignature.length) {
        return false;
    }

    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    } catch {
        return false;
    }
}
