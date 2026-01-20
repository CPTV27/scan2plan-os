import { log } from "../lib/logger";

export interface SecurityEvent {
  type: "rate_limit_exceeded" | "auth_failure" | "csrf_failure" | "role_violation" | "suspicious_activity" | "webhook_verification_failed";
  subtype?: string;
  ip?: string;
  path?: string;
  method?: string;
  userId?: string;
  email?: string;
  message?: string;
  metadata?: Record<string, any>;
}

const SECURITY_LOG_PREFIX = "[SECURITY]";

export function logSecurityEvent(event: SecurityEvent): void {
  const timestamp = new Date().toISOString();
  const parts = [
    SECURITY_LOG_PREFIX,
    `type=${event.type}`,
    event.subtype ? `subtype=${event.subtype}` : null,
    event.ip ? `ip=${event.ip}` : null,
    event.userId ? `user=${event.userId}` : null,
    event.email ? `email=${event.email}` : null,
    event.method ? `method=${event.method}` : null,
    event.path ? `path=${event.path}` : null,
    event.message ? `msg="${event.message}"` : null,
  ].filter(Boolean);

  const logLine = parts.join(" ");
  log(logLine, "security");

  // Log metadata separately if present for easier parsing
  if (event.metadata && Object.keys(event.metadata).length > 0) {
    log(`${SECURITY_LOG_PREFIX} metadata=${JSON.stringify(event.metadata)}`, "security");
  }
}

export function logAuthFailure(
  ip: string,
  email: string | undefined,
  reason: string
): void {
  logSecurityEvent({
    type: "auth_failure",
    ip,
    email,
    message: reason,
  });
}

export function logCsrfFailure(
  ip: string,
  path: string,
  method: string
): void {
  logSecurityEvent({
    type: "csrf_failure",
    ip,
    path,
    method,
  });
}

export function logRoleViolation(
  userId: string,
  requiredRole: string,
  actualRole: string,
  path: string
): void {
  logSecurityEvent({
    type: "role_violation",
    userId,
    path,
    message: `Required: ${requiredRole}, Actual: ${actualRole}`,
  });
}

export function logSuspiciousActivity(
  ip: string,
  activity: string,
  metadata?: Record<string, any>
): void {
  logSecurityEvent({
    type: "suspicious_activity",
    ip,
    message: activity,
    metadata,
  });
}
