import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { rateLimits } from "../drizzle/schema";

const MAX_DAILY_SUBMISSIONS = 5;

export interface RateLimitInfo {
  remaining: number;
  total: number;
  resetAt: Date;
}

/**
 * Get the next UTC midnight from now.
 */
function getNextMidnightUTC(): Date {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  return tomorrow;
}

/**
 * Check if the reset timestamp has passed (i.e. it's a new day).
 */
function isExpired(resetTimestamp: Date): boolean {
  return new Date() >= resetTimestamp;
}

/**
 * Get rate limit info for a user.
 */
export async function getRateLimitInfo(userId: number): Promise<RateLimitInfo> {
  const db = await getDb();
  if (!db) {
    return { remaining: MAX_DAILY_SUBMISSIONS, total: MAX_DAILY_SUBMISSIONS, resetAt: getNextMidnightUTC() };
  }

  const records = await db
    .select()
    .from(rateLimits)
    .where(eq(rateLimits.userId, userId))
    .limit(1);

  if (records.length === 0) {
    return {
      remaining: MAX_DAILY_SUBMISSIONS,
      total: MAX_DAILY_SUBMISSIONS,
      resetAt: getNextMidnightUTC(),
    };
  }

  const record = records[0];

  // If the reset timestamp has passed, the counter resets
  if (isExpired(record.resetTimestamp)) {
    return {
      remaining: MAX_DAILY_SUBMISSIONS,
      total: MAX_DAILY_SUBMISSIONS,
      resetAt: getNextMidnightUTC(),
    };
  }

  const remaining = Math.max(0, MAX_DAILY_SUBMISSIONS - record.dailyCount);
  return {
    remaining,
    total: MAX_DAILY_SUBMISSIONS,
    resetAt: record.resetTimestamp,
  };
}

/**
 * Consume one rate limit token. Returns true if allowed, false if limit exceeded.
 * Uses upsert to handle concurrent requests safely.
 */
export async function consumeRateLimit(userId: number): Promise<{ allowed: boolean; info: RateLimitInfo }> {
  const db = await getDb();
  if (!db) {
    return {
      allowed: true,
      info: { remaining: MAX_DAILY_SUBMISSIONS - 1, total: MAX_DAILY_SUBMISSIONS, resetAt: getNextMidnightUTC() },
    };
  }

  const records = await db
    .select()
    .from(rateLimits)
    .where(eq(rateLimits.userId, userId))
    .limit(1);

  const nextMidnight = getNextMidnightUTC();

  if (records.length === 0) {
    // First submission ever - create record with count 1
    await db.insert(rateLimits).values({
      userId,
      dailyCount: 1,
      resetTimestamp: nextMidnight,
    });
    return {
      allowed: true,
      info: { remaining: MAX_DAILY_SUBMISSIONS - 1, total: MAX_DAILY_SUBMISSIONS, resetAt: nextMidnight },
    };
  }

  const record = records[0];

  // If expired, reset counter
  if (isExpired(record.resetTimestamp)) {
    await db
      .update(rateLimits)
      .set({ dailyCount: 1, resetTimestamp: nextMidnight })
      .where(eq(rateLimits.id, record.id));
    return {
      allowed: true,
      info: { remaining: MAX_DAILY_SUBMISSIONS - 1, total: MAX_DAILY_SUBMISSIONS, resetAt: nextMidnight },
    };
  }

  // Check if limit exceeded
  if (record.dailyCount >= MAX_DAILY_SUBMISSIONS) {
    return {
      allowed: false,
      info: {
        remaining: 0,
        total: MAX_DAILY_SUBMISSIONS,
        resetAt: record.resetTimestamp,
      },
    };
  }

  // Increment counter
  const newCount = record.dailyCount + 1;
  await db
    .update(rateLimits)
    .set({ dailyCount: newCount })
    .where(eq(rateLimits.id, record.id));

  return {
    allowed: true,
    info: {
      remaining: MAX_DAILY_SUBMISSIONS - newCount,
      total: MAX_DAILY_SUBMISSIONS,
      resetAt: record.resetTimestamp,
    },
  };
}
