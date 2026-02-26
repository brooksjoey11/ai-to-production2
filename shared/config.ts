/**
 * Centralized application configuration.
 * All hardcoded numbers are externalized here and can be overridden via environment variables.
 */

function envInt(key: string, fallback: number): number {
  const val = typeof process !== "undefined" ? process.env?.[key] : undefined;
  if (val === undefined || val === "") return fallback;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function envStr(key: string, fallback: string): string {
  const val = typeof process !== "undefined" ? process.env?.[key] : undefined;
  return val && val.length > 0 ? val : fallback;
}

export const APP_CONFIG = {
  /** Maximum code submissions per user per day */
  maxDailySubmissions: envInt("MAX_DAILY_SUBMISSIONS", 5),

  /** Maximum code size in bytes (100KB) */
  maxCodeSizeBytes: envInt("MAX_CODE_SIZE_BYTES", 100_000),

  /** Maximum request body size */
  maxBodySize: envStr("MAX_BODY_SIZE", "1mb"),

  /** Redis URL for BullMQ, rate limiting, and caching */
  redisUrl: envStr("REDIS_URL", "redis://localhost:6379"),

  /** Cache TTL for prompts and model config in seconds */
  cacheTtlSeconds: envInt("CACHE_TTL_SECONDS", 300),

  /** BullMQ job retry attempts */
  jobMaxRetries: envInt("JOB_MAX_RETRIES", 3),

  /** BullMQ job backoff delay in ms */
  jobBackoffDelay: envInt("JOB_BACKOFF_DELAY_MS", 5000),

  /** Pipeline job timeout in ms (5 minutes) */
  jobTimeoutMs: envInt("JOB_TIMEOUT_MS", 300_000),

  /** Default LLM model */
  defaultModel: envStr("DEFAULT_LLM_MODEL", "gpt-4-turbo"),

  /** Supported languages */
  supportedLanguages: [
    "javascript", "typescript", "python", "java", "csharp", "go",
    "rust", "ruby", "php", "swift", "kotlin", "c", "cpp", "sql",
    "html", "css", "shell", "other",
  ] as const,

  /** Available LLM models */
  availableModels: [
    "gpt-4-turbo", "gpt-4o", "gpt-4o-mini",
    "claude-3-5-sonnet", "claude-3-haiku",
    "gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.5-flash",
  ] as const,
} as const;

export type SupportedLanguage = (typeof APP_CONFIG.supportedLanguages)[number];
export type AvailableModel = (typeof APP_CONFIG.availableModels)[number];
