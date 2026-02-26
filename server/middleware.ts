import type { Request, Response, NextFunction } from "express";
import logger from "./logger";
import { metrics } from "./metrics";
import crypto from "crypto";
import { APP_CONFIG } from "@shared/config";

/**
 * Request logging middleware using Pino.
 * Logs method, path, status code, and duration for every request.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationMs = durationNs / 1_000_000;
    const durationSec = durationMs / 1000;

    // Normalize path for metrics (avoid high cardinality)
    const normalizedPath = normalizePath(req.path);

    // Record Prometheus metrics
    const statusCode = res.statusCode.toString();
    metrics.httpRequestsTotal.inc({ method: req.method, path: normalizedPath, status_code: statusCode });
    metrics.httpRequestDuration.observe({ method: req.method, path: normalizedPath, status_code: statusCode }, durationSec);

    // Structured log
    logger.info({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      userAgent: req.headers["user-agent"]?.slice(0, 100),
    }, "request completed");
  });

  next();
}

/**
 * Normalize paths for Prometheus labels to avoid high cardinality.
 */
function normalizePath(path: string): string {
  if (path.startsWith("/api/trpc")) return "/api/trpc";
  if (path.startsWith("/api/oauth")) return "/api/oauth";
  if (path === "/health" || path === "/metrics") return path;
  if (path.startsWith("/assets/")) return "/assets/*";
  return "/other";
}

/**
 * CSRF protection using double-submit cookie pattern.
 * Sets a CSRF token cookie and validates it against a header on state-changing requests.
 */
const CSRF_COOKIE = "atp-csrf";
const CSRF_HEADER = "x-csrf-token";

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Skip for safe methods and non-API routes
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    // Ensure CSRF cookie exists
    if (!req.cookies?.[CSRF_COOKIE]) {
      const token = crypto.randomBytes(32).toString("hex");
      res.cookie(CSRF_COOKIE, token, {
        httpOnly: false, // Must be readable by JS
        secure: true,
        sameSite: "lax",
        path: "/",
      });
    }
    return next();
  }

  // For state-changing requests to /api/trpc, validate CSRF token
  if (req.path.startsWith("/api/trpc")) {
    const cookieToken = req.cookies?.[CSRF_COOKIE];
    const headerToken = req.headers[CSRF_HEADER];

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      // Don't block in development for easier testing
      if (process.env.NODE_ENV === "production") {
        logger.warn({ path: req.path, method: req.method }, "CSRF validation failed");
        res.status(403).json({ error: "CSRF validation failed" });
        return;
      }
    }
  }

  next();
}

/**
 * Error sanitization middleware.
 * Ensures no stack traces or DB details are exposed to clients.
 */
export function errorSanitizer(err: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error({
    err: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
  }, "Unhandled error");

  // Never expose internal details
  const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500;
  const safeMessage = statusCode >= 500
    ? "An internal error occurred. Please try again later."
    : err.message;

  res.status(statusCode).json({
    error: safeMessage,
  });
}

/**
 * Body size limit enforcement.
 * The express.json({ limit }) handles this, but we add an extra check for code submissions.
 */
export function codeSizeValidator(req: Request, res: Response, next: NextFunction): void {
  // Only check POST requests to the tRPC endpoint
  if (req.method === "POST" && req.path.startsWith("/api/trpc")) {
    const body = req.body;
    if (body && typeof body === "object") {
      // Check for code field in tRPC batch or single calls
      const checkCode = (params: Record<string, unknown>) => {
        if (params.code && typeof params.code === "string") {
          if (Buffer.byteLength(params.code, "utf8") > APP_CONFIG.maxCodeSizeBytes) {
            res.status(413).json({ error: `Code exceeds maximum size of ${APP_CONFIG.maxCodeSizeBytes} bytes` });
            return true;
          }
        }
        return false;
      };

      // tRPC sends input in various formats
      if (body.input && checkCode(body.input)) return;
      if (body["0"]?.input && checkCode(body["0"].input)) return;
    }
  }
  next();
}
