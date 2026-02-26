import { getRedis, isRedisAvailable } from "./redis";
import logger from "./logger";
import { APP_CONFIG } from "@shared/config";

const RATE_LIMIT_PREFIX = "atp:ratelimit:";

export interface RateLimitInfo {
  remaining: number;
  total: number;
  resetAt: Date;
}

// ─── In-memory fallback (used when Redis is unavailable) ───
interface MemoryRateEntry {
  count: number;
  resetAt: number; // epoch ms
}
const memoryRateLimits: Map<string, MemoryRateEntry> = new Map();

/**
 * Get the next UTC midnight from now.
 */
function getNextMidnightUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));
}

/**
 * Get seconds until next UTC midnight.
 */
function secondsUntilMidnightUTC(): number {
  const now = Date.now();
  const midnight = getNextMidnightUTC().getTime();
  return Math.max(1, Math.ceil((midnight - now) / 1000));
}

/**
 * Redis key for a user's daily rate limit.
 */
function rateLimitKey(userId: number): string {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `${RATE_LIMIT_PREFIX}${userId}:${today}`;
}

/**
 * Get rate limit info for a user using Redis (or in-memory fallback).
 */
export async function getRateLimitInfo(userId: number): Promise<RateLimitInfo> {
  const max = APP_CONFIG.maxDailySubmissions;
  const resetAt = getNextMidnightUTC();

  const redis = getRedis();
  if (redis && isRedisAvailable()) {
    try {
      const key = rateLimitKey(userId);
      const count = await redis.get(key);
      const used = count ? parseInt(count, 10) : 0;
      return {
        remaining: Math.max(0, max - used),
        total: max,
        resetAt,
      };
    } catch (err) {
      logger.warn({ err: (err as Error).message, userId }, "Redis rate limit GET failed, using fallback");
    }
  }

  // In-memory fallback
  const memKey = rateLimitKey(userId);
  const entry = memoryRateLimits.get(memKey);
  if (!entry || Date.now() >= entry.resetAt) {
    return { remaining: max, total: max, resetAt };
  }
  return {
    remaining: Math.max(0, max - entry.count),
    total: max,
    resetAt: new Date(entry.resetAt),
  };
}

/**
 * Consume one rate limit token. Returns true if allowed, false if limit exceeded.
 * Uses Redis INCR for atomic counter (or in-memory fallback).
 */
export async function consumeRateLimit(userId: number): Promise<{ allowed: boolean; info: RateLimitInfo }> {
  const max = APP_CONFIG.maxDailySubmissions;
  const resetAt = getNextMidnightUTC();
  const ttl = secondsUntilMidnightUTC();

  const redis = getRedis();
  if (redis && isRedisAvailable()) {
    try {
      const key = rateLimitKey(userId);
      // Atomic increment + set expiry
      const newCount = await redis.incr(key);
      if (newCount === 1) {
        // First request today, set expiry to midnight UTC
        await redis.expire(key, ttl);
      }

      if (newCount > max) {
        return {
          allowed: false,
          info: { remaining: 0, total: max, resetAt },
        };
      }

      return {
        allowed: true,
        info: { remaining: max - newCount, total: max, resetAt },
      };
    } catch (err) {
      logger.warn({ err: (err as Error).message, userId }, "Redis rate limit INCR failed, using fallback");
    }
  }

  // In-memory fallback
  const memKey = rateLimitKey(userId);
  let entry = memoryRateLimits.get(memKey);

  if (!entry || Date.now() >= entry.resetAt) {
    entry = { count: 0, resetAt: resetAt.getTime() };
  }

  entry.count += 1;
  memoryRateLimits.set(memKey, entry);

  if (entry.count > max) {
    return {
      allowed: false,
      info: { remaining: 0, total: max, resetAt: new Date(entry.resetAt) },
    };
  }

  return {
    allowed: true,
    info: {
      remaining: max - entry.count,
      total: max,
      resetAt: new Date(entry.resetAt),
    },
  };
}
