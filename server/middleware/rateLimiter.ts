import rateLimit from "express-rate-limit";
import { SERVER_CONSTANTS, HTTP_STATUS } from "../constants";
import { logSecurityEvent } from "./securityLogger";

function createRateLimiter(
  windowMs: number,
  max: number,
  message: string,
  eventType: string
) {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      retryAfter: Math.ceil(windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
    handler: (req, res) => {
      logSecurityEvent({
        type: "rate_limit_exceeded",
        subtype: eventType,
        ip: req.ip || req.socket.remoteAddress || "unknown",
        path: req.path,
        method: req.method,
        userId: (req as any).user?.id,
      });
      res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  });
}

export const apiLimiter = createRateLimiter(
  SERVER_CONSTANTS.RATE_LIMIT_WINDOW_MS,
  SERVER_CONSTANTS.RATE_LIMIT_MAX_REQUESTS,
  "Too many requests, please try again later.",
  "api"
);

export const authLimiter = createRateLimiter(
  SERVER_CONSTANTS.RATE_LIMIT_WINDOW_MS,
  SERVER_CONSTANTS.AUTH_RATE_LIMIT_MAX_REQUESTS,
  "Too many login attempts, please try again later.",
  "auth"
);

// Stricter limiter for file uploads (10 per minute)
export const uploadLimiter = createRateLimiter(
  60 * 1000, // 1 minute window
  10,
  "Too many file uploads, please wait a moment.",
  "upload"
);

// Stricter limiter for AI/LLM endpoints (20 per minute)
export const aiLimiter = createRateLimiter(
  60 * 1000, // 1 minute window
  20,
  "Too many AI requests, please wait a moment.",
  "ai"
);

// Password limiter (20 per 1 minute)
export const passwordLimiter = createRateLimiter(
  1 * 60 * 1000, // 1 minute window
  20,
  "Too many password attempts, please try again later.",
  "password"
);
