import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { systemPrompts, modelConfig } from "../drizzle/schema";

// ─── In-memory cache for model selections (5-minute TTL) ───
interface CacheEntry {
  model: string;
  timestamp: number;
}
const modelCache: Map<string, CacheEntry> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

const DEFAULT_MODEL = "gpt-4-turbo";

type StepName = "forensic" | "rebuilder" | "quality";

// ─── Prompt functions ───

export async function getPrompt(step: StepName): Promise<string> {
  const db = await getDb();
  if (!db) return DEFAULT_PROMPTS[step] ?? "";

  const record = await db
    .select()
    .from(systemPrompts)
    .where(eq(systemPrompts.stepName, step))
    .limit(1);

  return record[0]?.promptText ?? DEFAULT_PROMPTS[step] ?? "";
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

  // Fill missing steps with defaults
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
}

// ─── Model functions (with 5-minute cache) ───

export async function getModel(step: StepName): Promise<string> {
  const now = Date.now();
  const cached = modelCache.get(step);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.model;
  }

  const db = await getDb();
  if (!db) return DEFAULT_MODEL;

  const record = await db
    .select()
    .from(modelConfig)
    .where(eq(modelConfig.stepName, step))
    .limit(1);

  const model = record[0]?.selectedModel ?? DEFAULT_MODEL;
  modelCache.set(step, { model, timestamp: now });
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
    if (!result[step]) result[step] = DEFAULT_MODEL;
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

  // Invalidate cache immediately
  modelCache.delete(step);
}

export function invalidateModelCache(step?: string): void {
  if (step) {
    modelCache.delete(step);
  } else {
    modelCache.clear();
  }
}
