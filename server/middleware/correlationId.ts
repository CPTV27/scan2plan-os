import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

export const correlationIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const correlationId = (req.headers["x-request-id"] as string) || uuidv4();
  req.id = correlationId;
  res.setHeader("X-Request-ID", correlationId);
  next();
};
