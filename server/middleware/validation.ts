import { Request, Response, NextFunction } from "express";
import { z, ZodError, ZodSchema } from "zod";
import { ValidationError, BadRequestError } from "./errorHandler";

const MAX_JSON_BODY_SIZE = 1024 * 1024; // 1MB default limit
const MAX_STRING_LENGTH = 10000; // 10KB for individual strings

export interface ValidationOptions {
  maxBodySize?: number;
  stripUnknown?: boolean;
}

export function validateBody<T extends ZodSchema>(
  schema: T,
  options: ValidationOptions = {}
) {
  const { maxBodySize = MAX_JSON_BODY_SIZE, stripUnknown = true } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Check actual body size, not just Content-Length header
    const bodyStr = JSON.stringify(req.body || {});
    const actualSize = Buffer.byteLength(bodyStr, "utf8");
    
    if (actualSize > maxBodySize) {
      return next(
        new BadRequestError(
          `Request body too large. Maximum size is ${Math.round(maxBodySize / 1024)}KB`,
          "PAYLOAD_TOO_LARGE"
        )
      );
    }

    try {
      // Use .strict() to reject unknown fields if stripUnknown is false
      // Otherwise, allow extra fields but don't include them in output (default Zod behavior)
      let effectiveSchema = schema;
      if (!stripUnknown && schema instanceof z.ZodObject) {
        effectiveSchema = schema.strict() as unknown as T;
      }
      
      const validated = effectiveSchema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
          code: err.code,
        }));

        return next(
          new ValidationError("Invalid request data", "VALIDATION_FAILED", {
            errors: formattedErrors,
          })
        );
      }
      next(error);
    }
  };
}

export function validateQuery<T extends ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
          code: err.code,
        }));

        return next(
          new ValidationError("Invalid query parameters", "QUERY_VALIDATION_FAILED", {
            errors: formattedErrors,
          })
        );
      }
      next(error);
    }
  };
}

export function validateParams<T extends ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.params);
      req.params = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
          code: err.code,
        }));

        return next(
          new ValidationError("Invalid path parameters", "PARAMS_VALIDATION_FAILED", {
            errors: formattedErrors,
          })
        );
      }
      next(error);
    }
  };
}

export const commonSchemas = {
  id: z.coerce.number().int().positive(),
  uuid: z.string().uuid(),
  upid: z.string().regex(/^UPID-\d{3}-\d{5}$/, "Invalid UPID format"),
  email: z.string().email().max(255),
  phone: z.string().max(50).optional(),
  url: z.string().url().max(2048).optional(),
  safeString: z.string().max(MAX_STRING_LENGTH),
  shortString: z.string().max(255),
  longText: z.string().max(50000),
  positiveNumber: z.coerce.number().nonnegative(),
  percentage: z.coerce.number().min(0).max(100),
  currency: z.coerce.number().nonnegative().multipleOf(0.01),
  dateString: z.string().datetime().optional(),
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
};

export const leadIdParamSchema = z.object({
  id: commonSchemas.id,
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().max(255).optional(),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export function sanitizeString(str: string): string {
  return str
    .replace(/[<>]/g, "") // Remove angle brackets (XSS prevention)
    .trim();
}

export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizeString(value);
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized as T;
}
