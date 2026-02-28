import type { Request, Response } from "express";
import { getDb } from "./_core/db";
import { getRedis, isRedisAvailable } from "./redis";
import logger from "./logger";
import { ENV } from "./_core/env";
import axios from "axios";

type ComponentStatus = "up" | "down";

interface HealthResponse {
  status: "ok" | "degraded" | "down";
  timestamp: string;
  components: {
    database: ComponentStatus;
    redis: ComponentStatus;
    llm: ComponentStatus;
  };
}

async function checkDatabase(): Promise<ComponentStatus> {
  try {
    const db = await getDb();
    if (!db) return "down";

    await db.execute("SELECT 1");
    return "up";
  } catch (err) {
    logger.error({ err }, "Database health check failed");
    return "down";
  }
}

async function checkRedis(): Promise<ComponentStatus> {
  try {
    if (!isRedisAvailable()) {
      return "down";
    }

    const redis = getRedis();
    await redis.ping();
    return "up";
  } catch (err) {
    logger.error({ err }, "Redis health check failed");
    return "down";
  }
}

async function checkLLM(): Promise<ComponentStatus> {
  try {
    if (!ENV.FORGE_API_URL || !ENV.FORGE_API_KEY) {
      return "down";
    }

    // Lightweight HEAD or minimal GET to validate reachability
    await axios.get(ENV.FORGE_API_URL, {
      timeout: 3000,
      headers: {
        Authorization: `Bearer ${ENV.FORGE_API_KEY}`,
      },
    });

    return "up";
  } catch (err) {
    logger.error({ err }, "LLM health check failed");
    return "down";
  }
}

function aggregateStatus(
  database: ComponentStatus,
  redis: ComponentStatus,
  llm: ComponentStatus
): "ok" | "degraded" | "down" {
  const components = [database, redis, llm];

  if (components.every((c) => c === "up")) {
    return "ok";
  }

  if (components.some((c) => c === "down")) {
    // If DB or LLM is down, treat system as down
    if (database === "down" || llm === "down") {
      return "down";
    }

    return "degraded";
  }

  return "degraded";
}

export async function healthCheck(_req: Request, res: Response) {
  const [database, redis, llm] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkLLM(),
  ]);

  const status = aggregateStatus(database, redis, llm);

  const response: HealthResponse = {
    status,
    timestamp: new Date().toISOString(),
    components: {
      database,
      redis,
      llm,
    },
  };

  const httpStatus =
    status === "ok" ? 200 : status === "degraded" ? 200 : 503;

  res.status(httpStatus).json(response);
}
