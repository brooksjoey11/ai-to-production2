import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { systemPrompts, modelConfig } from "../drizzle/schema";
import { getRedis, isRedisAvailable } from "./redis";
import logger from "./logger";
import { APP_CONFIG } from "@shared/config";

const CACHE_PREFIX = "atp:config:";
const PROMPT_KEY = (step: string) => `${CACHE_PREFIX}prompt:${step}`;
const MODEL_KEY = (step: string) => `${CACHE_PREFIX}model:${step}`;

// ─── In-memory fallback cache (used when Redis is unavailable) ───
interface FallbackEntry {
  value: string;
  expiresAt: number;
}
const fallbackCache: Map<string, FallbackEntry> = new Map();

function getFallback(key: string): string | null {
  const entry = fallbackCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    fallbackCache.delete(key);
    return null;
  }
  return entry.value;
}

function setFallback(key: string, value: string, ttlSeconds: number): void {
  fallbackCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

function deleteFallback(key: string): void {
  fallbackCache.delete(key);
}

// ─── Cache helpers (Redis primary, in-memory fallback) ───

async function cacheGet(key: string): Promise<string | null> {
  const redis = getRedis();
  if (redis && isRedisAvailable()) {
    try {
      return await redis.get(key);
    } catch (err) {
      logger.warn({ err: (err as Error).message, key }, "Redis GET failed, using fallback");
    }
  }
  return getFallback(key);
}

async function cacheSet(key: string, value: string, ttlSeconds: number = APP_CONFIG.cacheTtlSeconds): Promise<void> {
  const redis = getRedis();
  if (redis && isRedisAvailable()) {
    try {
      await redis.setex(key, ttlSeconds, value);
    } catch (err) {
      logger.warn({ err: (err as Error).message, key }, "Redis SETEX failed, using fallback");
    }
  }
  setFallback(key, value, ttlSeconds);
}

async function cacheDelete(key: string): Promise<void> {
  const redis = getRedis();
  if (redis && isRedisAvailable()) {
    try {
      await redis.del(key);
    } catch (err) {
      logger.warn({ err: (err as Error).message, key }, "Redis DEL failed");
    }
  }
  deleteFallback(key);
}

// ─── Default prompts (fallback if DB is empty) ───
const DEFAULT_PROMPTS: Record<string, string> = {
  forensic: `You are a code detective. Analyze the given code and produce a detailed forensic report covering:
- Critical bugs and logical errors
- Security vulnerabilities
- Missing error handling
- Performance issues
- Code style and maintainability problems
Format the report in markdown with clear sections.`,
  rebuilder: `You are a senior engineer. Rewrite the given code to fix all issues identified in the forensic report. Add proper error handling, input validation, logging, and remove any placeholders. Output only the corrected code, no explanations.`,
  quality: `You are a project manager. Summarize in plain language what was wrong with the original code and what was fixed. List 3-5 bullet points. Note any remaining concerns or recommendations.`,
};

type StepName = "forensic" | "rebuilder" | "quality";

// ─── Prompt functions ───

export async function getPrompt(step: StepName): Promise<string> {
  // Try cache first
  const cached = await cacheGet(PROMPT_KEY(step));
  if (cached) return cached;

  const db = await getDb();
  if (!db) return DEFAULT_PROMPTS[step] ?? "";

  const record = await db
    .select()
    .from(systemPrompts)
    .where(eq(systemPrompts.stepName, step))
    .limit(1);

  const prompt = record[0]?.promptText ?? DEFAULT_PROMPTS[step] ?? "";
  await cacheSet(PROMPT_KEY(step), prompt);
  return prompt;
}

export async function getAllPrompts(): Promise<Record<string, string>> {
  const db = await getDb();
  const result: Record<string, string> = {};

  if (db) {
    const records = await db.select().from(systemPrompts);
    for (const r of records) {
      result[r.stepName] = r.promptText;
    }
  }

  for (const step of ["forensic", "rebuilder", "quality"] as const) {
    if (!result[step]) result[step] = DEFAULT_PROMPTS[step];
  }
  return result;
}

export async function updatePrompt(step: string, promptText: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(systemPrompts)
    .where(eq(systemPrompts.stepName, step as StepName))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(systemPrompts)
      .set({ promptText })
      .where(eq(systemPrompts.id, existing[0].id));
  } else {
    await db.insert(systemPrompts).values({
      stepName: step as StepName,
      promptText,
    });
  }

  // Immediately invalidate cache
  await cacheDelete(PROMPT_KEY(step));
  logger.info({ step }, "Prompt updated and cache invalidated");
}

// ─── Model functions ───

export async function getModel(step: StepName): Promise<string> {
  const cached = await cacheGet(MODEL_KEY(step));
  if (cached) return cached;

  const db = await getDb();
  if (!db) return APP_CONFIG.defaultModel;

  const record = await db
    .select()
    .from(modelConfig)
    .where(eq(modelConfig.stepName, step))
    .limit(1);

  const model = record[0]?.selectedModel ?? APP_CONFIG.defaultModel;
  await cacheSet(MODEL_KEY(step), model);
  return model;
}

export async function getAllModels(): Promise<Record<string, string>> {
  const db = await getDb();
  const result: Record<string, string> = {};

  if (db) {
    const records = await db.select().from(modelConfig);
    for (const r of records) {
      result[r.stepName] = r.selectedModel;
    }
  }

  for (const step of ["forensic", "rebuilder", "quality"] as const) {
    if (!result[step]) result[step] = APP_CONFIG.defaultModel;
  }
  return result;
}

export async function updateModel(step: string, selectedModel: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(modelConfig)
    .where(eq(modelConfig.stepName, step as StepName))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(modelConfig)
      .set({ selectedModel })
      .where(eq(modelConfig.id, existing[0].id));
  } else {
    await db.insert(modelConfig).values({
      stepName: step as StepName,
      selectedModel,
    });
  }

  // Immediately invalidate cache
  await cacheDelete(MODEL_KEY(step));
  logger.info({ step, model: selectedModel }, "Model updated and cache invalidated");
}

export function invalidateModelCache(step?: string): void {
  if (step) {
    cacheDelete(MODEL_KEY(step));
  } else {
    for (const s of ["forensic", "rebuilder", "quality"]) {
      cacheDelete(MODEL_KEY(s));
    }
  }
}
