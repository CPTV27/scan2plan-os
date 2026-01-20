import { Request, Response, NextFunction } from "express";
import { log } from "../lib/logger";

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;
  details?: Record<string, any>;

  constructor(message: string, statusCode: number = 500, code?: string, details?: Record<string, any>) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, code = "BAD_REQUEST", details?: Record<string, any>) {
    super(message, 400, code, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required", code = "UNAUTHORIZED") {
    super(message, 401, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied", code = "FORBIDDEN") {
    super(message, 403, code);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", code = "NOT_FOUND") {
    super(message, 404, code);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = "CONFLICT", details?: Record<string, any>) {
    super(message, 409, code, details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, code = "VALIDATION_ERROR", details?: Record<string, any>) {
    super(message, 422, code, details);
  }
}

export class MarginGateError extends AppError {
  constructor(margin: number, floor: number) {
    super(
      `Margin ${margin.toFixed(1)}% is below the ${floor * 100}% governance gate. CEO override required.`,
      422,
      "MARGIN_BELOW_FLOOR",
      { margin, floor }
    );
  }
}

export class ServiceError extends AppError {
  constructor(service: string, message: string, code = "SERVICE_ERROR") {
    super(`${service}: ${message}`, 502, code);
  }
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const requestId = (req as any).id || "unknown";
  const status = err.statusCode || err.status || 500;
  const message = err.message || "Internal Server Error";
  const code = err.code || getErrorCodeFromStatus(status);
  const isProduction = process.env.NODE_ENV === "production";

  log(`[${requestId}] Error ${status} (${code}): ${message}`, "error");
  
  if (!isProduction && err.stack) {
    console.error(`[${requestId}] Stack trace:`, err.stack);
  }

  const response: Record<string, any> = {
    error: message,
    code,
    requestId,
  };

  if (err.details && Object.keys(err.details).length > 0) {
    response.details = err.details;
  }

  if (!isProduction && err.stack) {
    response.stack = err.stack;
  }

  res.status(status).json(response);
};

function getErrorCodeFromStatus(status: number): string {
  switch (status) {
    case 400: return "BAD_REQUEST";
    case 401: return "UNAUTHORIZED";
    case 403: return "FORBIDDEN";
    case 404: return "NOT_FOUND";
    case 409: return "CONFLICT";
    case 422: return "VALIDATION_ERROR";
    case 429: return "RATE_LIMITED";
    case 500: return "INTERNAL_ERROR";
    case 502: return "SERVICE_ERROR";
    case 503: return "SERVICE_UNAVAILABLE";
    default: return "UNKNOWN_ERROR";
  }
}

export const notFoundHandler = (req: Request, res: Response) => {
  const requestId = (req as any).id || "unknown";
  res.status(404).json({
    error: "Not Found",
    path: req.path,
    requestId,
  });
};

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<any> | any;

export const asyncHandler = (fn: AsyncRequestHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
