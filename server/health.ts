import type { Request, Response } from "express";
import { getDb } from "./db";
import { sql } from "drizzle-orm";
import { pingRedis, isRedisAvailable } from "./redis";
import { ENV } from "./_core/env";
import logger from "./logger";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  checks: {
    database: { status: string; latencyMs?: number };
    redis: { status: string; latencyMs?: number };
    llm: { status: string; latencyMs?: number };
  };
}

/**
 * Health check endpoint handler.
 * Checks DB, Redis, and LLM service reachability.
 */
export async function healthCheck(_req: Request, res: Response): Promise<void> {
  const result: HealthStatus = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: { status: "unknown" },
      redis: { status: "unknown" },
      llm: { status: "unknown" },
    },
  };

  // ─── Check Database ───
  try {
    const start = Date.now();
    const db = await getDb();
    if (db) {
      await db.execute(sql`SELECT 1`);
      result.checks.database = { status: "ok", latencyMs: Date.now() - start };
    } else {
      result.checks.database = { status: "unavailable" };
      result.status = "degraded";
    }
  } catch (err) {
    result.checks.database = { status: "error" };
    result.status = "unhealthy";
    logger.warn({ err: (err as Error).message }, "Health check: DB failed");
  }

  // ─── Check Redis ───
  try {
    const start = Date.now();
    if (isRedisAvailable()) {
      const ok = await pingRedis();
      result.checks.redis = {
        status: ok ? "ok" : "error",
        latencyMs: Date.now() - start,
      };
      if (!ok) result.status = "degraded";
    } else {
      result.checks.redis = { status: "unavailable (using in-memory fallback)" };
      // Redis being unavailable is degraded, not unhealthy
      if (result.status === "healthy") result.status = "degraded";
    }
  } catch (err) {
    result.checks.redis = { status: "error" };
    if (result.status === "healthy") result.status = "degraded";
    logger.warn({ err: (err as Error).message }, "Health check: Redis failed");
  }

  // ─── Check LLM Service ───
  try {
    const start = Date.now();
    const apiUrl = ENV.forgeApiUrl
      ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/models`
      : "https://forge.manus.im/v1/models";

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        authorization: `Bearer ${ENV.forgeApiKey}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    result.checks.llm = {
      status: response.ok ? "ok" : `error (${response.status})`,
      latencyMs: Date.now() - start,
    };
    if (!response.ok) result.status = "degraded";
  } catch (err) {
    result.checks.llm = { status: "error" };
    if (result.status === "healthy") result.status = "degraded";
    logger.warn({ err: (err as Error).message }, "Health check: LLM service failed");
  }

  const statusCode = result.status === "unhealthy" ? 503 : 200;
  res.status(statusCode).json(result);
}
