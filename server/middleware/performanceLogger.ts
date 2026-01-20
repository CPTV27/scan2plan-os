/**
 * Performance Logging Middleware
 * 
 * Tracks API response times and logs slow queries for monitoring.
 * Integrates with the structured logger for consistent output format.
 */

import { Request, Response, NextFunction } from "express";
import { log } from "../lib/logger";

const SLOW_REQUEST_THRESHOLD_MS = 1000;
const VERY_SLOW_REQUEST_THRESHOLD_MS = 3000;
const LOG_ALL_REQUESTS = process.env.LOG_ALL_REQUESTS === "true";

interface RequestMetrics {
  path: string;
  method: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  statusCode?: number;
  requestId: string;
}

const requestMetrics: Map<string, RequestMetrics> = new Map();
const slowEndpoints: Map<string, number[]> = new Map();

export const performanceLoggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();
  const requestId = (req as any).id || "unknown";
  const routeKey = `${req.method} ${req.path}`;

  const metrics: RequestMetrics = {
    path: req.path,
    method: req.method,
    startTime,
    requestId,
  };

  requestMetrics.set(requestId, metrics);

  const originalEnd = res.end;
  res.end = function(this: Response, ...args: any[]) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    metrics.endTime = endTime;
    metrics.duration = duration;
    metrics.statusCode = res.statusCode;

    trackSlowEndpoint(routeKey, duration);

    if (duration >= VERY_SLOW_REQUEST_THRESHOLD_MS) {
      log(
        `[${requestId}] VERY SLOW: ${req.method} ${req.path} completed in ${duration}ms (status: ${res.statusCode})`,
        "warn"
      );
    } else if (duration >= SLOW_REQUEST_THRESHOLD_MS) {
      log(
        `[${requestId}] SLOW: ${req.method} ${req.path} completed in ${duration}ms (status: ${res.statusCode})`,
        "warn"
      );
    } else if (LOG_ALL_REQUESTS) {
      log(
        `[${requestId}] ${req.method} ${req.path} completed in ${duration}ms (status: ${res.statusCode})`
      );
    }

    requestMetrics.delete(requestId);
    
    return originalEnd.apply(this, args as any);
  };

  next();
};

function trackSlowEndpoint(routeKey: string, duration: number): void {
  const existing = slowEndpoints.get(routeKey) || [];
  existing.push(duration);
  
  if (existing.length > 100) {
    existing.shift();
  }
  
  slowEndpoints.set(routeKey, existing);
}

export function getPerformanceStats(): Record<string, any> {
  const stats: Record<string, any> = {};
  
  for (const [route, durations] of Array.from(slowEndpoints.entries())) {
    if (durations.length === 0) continue;
    
    const sorted = [...durations].sort((a: number, b: number) => a - b);
    const avg = durations.reduce((a: number, b: number) => a + b, 0) / durations.length;
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const slowCount = durations.filter((d: number) => d >= SLOW_REQUEST_THRESHOLD_MS).length;
    
    stats[route] = {
      count: durations.length,
      avgMs: Math.round(avg),
      p50Ms: p50,
      p95Ms: p95,
      p99Ms: p99,
      slowRequests: slowCount,
      slowPercentage: Math.round((slowCount / durations.length) * 100),
    };
  }
  
  return stats;
}

export function getActiveRequests(): RequestMetrics[] {
  const now = Date.now();
  return Array.from(requestMetrics.values()).map(m => ({
    ...m,
    duration: now - m.startTime,
  }));
}

export function clearPerformanceStats(): void {
  slowEndpoints.clear();
}
