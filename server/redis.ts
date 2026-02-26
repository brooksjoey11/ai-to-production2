import Redis from "ioredis";
import logger from "./logger";
import { APP_CONFIG } from "@shared/config";

let redisClient: Redis | null = null;
let redisAvailable = false;

/**
 * Get or create the Redis connection.
 * Returns null if Redis is not available (graceful fallback).
 */
export function getRedis(): Redis | null {
  if (redisClient) return redisAvailable ? redisClient : null;

  try {
    redisClient = new Redis(APP_CONFIG.redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) {
          logger.warn("Redis: max reconnection attempts reached, giving up");
          return null; // stop retrying
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    redisClient.on("connect", () => {
      redisAvailable = true;
      logger.info("Redis connected");
    });

    redisClient.on("error", (err) => {
      redisAvailable = false;
      logger.warn({ err: err.message }, "Redis connection error (falling back to in-memory)");
    });

    redisClient.on("close", () => {
      redisAvailable = false;
      logger.info("Redis connection closed");
    });

    // Attempt to connect (non-blocking)
    redisClient.connect().catch((err) => {
      redisAvailable = false;
      logger.warn({ err: err.message }, "Redis initial connection failed (falling back to in-memory)");
    });
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "Redis initialization failed (falling back to in-memory)");
    redisClient = null;
    redisAvailable = false;
  }

  return redisAvailable ? redisClient : null;
}

/**
 * Check if Redis is currently available.
 */
export function isRedisAvailable(): boolean {
  return redisAvailable && redisClient !== null;
}

/**
 * Ping Redis to check health.
 */
export async function pingRedis(): Promise<boolean> {
  if (!redisClient || !redisAvailable) return false;
  try {
    const result = await redisClient.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}

/**
 * Gracefully close the Redis connection.
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      redisClient.disconnect();
    }
    redisClient = null;
    redisAvailable = false;
  }
}
