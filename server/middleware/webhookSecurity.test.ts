
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { createWebhookVerification } from "./webhookSecurity";
import { verifyWebhookSignature } from "../lib/appUtils";
import { logSecurityEvent } from "./securityLogger";

// Mock the security logger
vi.mock("./securityLogger", () => ({
    logSecurityEvent: vi.fn(),
}));

describe("Webhook Security", () => {
    const SECRET = "test-secret-key-123";
    const PAYLOAD = JSON.stringify({ event: "test_event", data: { id: 1 } });

    // Helper to generate a valid signature
    const generateSignature = (payload: string, secret: string) => {
        return crypto.createHmac("sha256", secret).update(payload).digest("hex");
    };

    describe("verifyWebhookSignature", () => {
        it("should return true for a valid signature", () => {
            const signature = generateSignature(PAYLOAD, SECRET);
            const isValid = verifyWebhookSignature(PAYLOAD, signature, SECRET);
            expect(isValid).toBe(true);
        });

        it("should return false for an invalid signature", () => {
            const signature = generateSignature(PAYLOAD, "wrong-secret");
            const isValid = verifyWebhookSignature(PAYLOAD, signature, SECRET);
            expect(isValid).toBe(false);
        });

        it("should return false for a tampered payload", () => {
            const signature = generateSignature(PAYLOAD, SECRET);
            const tamperedPayload = PAYLOAD + "tampered";
            const isValid = verifyWebhookSignature(tamperedPayload, signature, SECRET);
            expect(isValid).toBe(false);
        });
    });

    describe("createWebhookVerification Middleware", () => {
        let req: Partial<Request>;
        let res: Partial<Response>;
        let next: NextFunction;

        beforeEach(() => {
            req = {
                headers: {},
                body: JSON.parse(PAYLOAD),
                rawBody: Buffer.from(PAYLOAD), // simulate rawBody from parser
                method: "POST",
                path: "/api/webhooks/test",
                ip: "127.0.0.1",
                socket: { remoteAddress: "127.0.0.1" }
            } as any;

            res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
                send: vi.fn(),
            };

            next = vi.fn();
            vi.clearAllMocks();
        });

        it("should call next() when signature is valid", () => {
            const signature = generateSignature(PAYLOAD, SECRET);
            req.headers = { "x-signature": signature };

            const middleware = createWebhookVerification({
                secret: SECRET,
                signatureHeader: "x-signature",
                logFailures: true
            });

            middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it("should return 401 when signature is missing", () => {
            const middleware = createWebhookVerification({
                secret: SECRET,
                signatureHeader: "x-signature",
            });

            middleware(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                error: "Webhook signature missing",
                code: "WEBHOOK_SIGNATURE_MISSING"
            }));
            expect(logSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({
                type: "webhook_verification_failed",
                subtype: "missing_signature",
                ip: "127.0.0.1",
                path: "/api/webhooks/test",
                method: "POST"
            }));
        });

        it("should return 401 when signature is invalid", () => {
            req.headers = { "x-signature": "invalid-signature" };

            const middleware = createWebhookVerification({
                secret: SECRET,
                signatureHeader: "x-signature",
            });

            middleware(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(logSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({
                type: "webhook_verification_failed",
                subtype: "invalid_signature",
                ip: "127.0.0.1",
                path: "/api/webhooks/test",
                method: "POST"
            }));
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                error: "Webhook signature invalid",
                code: "WEBHOOK_SIGNATURE_INVALID"
            }));
        });
    });
});

