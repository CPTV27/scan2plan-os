import { Request, Response, NextFunction } from "express";
import { verifyWebhookSignature } from "../lib/appUtils";
import { logSecurityEvent } from "./securityLogger";

/**
 * Webhook Security Middleware
 * 
 * Verifies webhook signatures to ensure requests are from trusted sources
 */

export interface WebhookSecurityOptions {
    /** Secret key for signature verification */
    secret: string;
    /** Header name containing the signature */
    signatureHeader?: string;
    /** Whether to log failed verifications */
    logFailures?: boolean;
}

/**
 * Creates middleware to verify webhook signatures
 * 
 * @example
 * app.post("/api/webhooks/hubspot", 
 *   verifyWebhookSignature({ secret: process.env.HUBSPOT_WEBHOOK_SECRET }),
 *   handleHubspotWebhook
 * );
 */
export function createWebhookVerification(options: WebhookSecurityOptions) {
    const {
        secret,
        signatureHeader = "x-webhook-signature",
        logFailures = true,
    } = options;

    return (req: Request, res: Response, next: NextFunction) => {
        const signature = req.headers[signatureHeader.toLowerCase()] as string;

        if (!signature) {
            if (logFailures) {
                logSecurityEvent({
                    type: "webhook_verification_failed",
                    subtype: "missing_signature",
                    ip: req.ip || req.socket.remoteAddress || "unknown",
                    path: req.path,
                    method: req.method,
                });
            }

            return res.status(401).json({
                error: "Webhook signature missing",
                code: "WEBHOOK_SIGNATURE_MISSING",
            });
        }

        // Get raw body for signature verification
        const rawBody = (req as any).rawBody;
        if (!rawBody) {
            return res.status(500).json({
                error: "Raw body not available for signature verification",
                code: "RAW_BODY_MISSING",
            });
        }

        const payload = rawBody.toString();
        const isValid = verifyWebhookSignature(payload, signature, secret);

        if (!isValid) {
            if (logFailures) {
                logSecurityEvent({
                    type: "webhook_verification_failed",
                    subtype: "invalid_signature",
                    ip: req.ip || req.socket.remoteAddress || "unknown",
                    path: req.path,
                    method: req.method,
                });
            }

            return res.status(401).json({
                error: "Webhook signature invalid",
                code: "WEBHOOK_SIGNATURE_INVALID",
            });
        }

        // Signature valid, proceed
        next();
    };
}

/**
 * Middleware to require webhook signature verification for specific paths
 * 
 * @example
 * app.use("/api/webhooks/", requireWebhookSignature({
 *   "/hubspot": process.env.HUBSPOT_WEBHOOK_SECRET,
 *   "/stripe": process.env.STRIPE_WEBHOOK_SECRET,
 * }));
 */
export function requireWebhookSignature(
    pathSecrets: Record<string, string | undefined>
) {
    return (req: Request, res: Response, next: NextFunction) => {
        // Find matching path
        const matchingPath = Object.keys(pathSecrets).find(path =>
            req.path.startsWith(path)
        );

        if (!matchingPath) {
            // No signature required for this path
            return next();
        }

        const secret = pathSecrets[matchingPath];
        if (!secret) {
            // Secret not configured, log warning but allow through
            console.warn(`Webhook secret not configured for path: ${matchingPath}`);
            return next();
        }

        // Apply verification
        return createWebhookVerification({ secret })(req, res, next);
    };
}
