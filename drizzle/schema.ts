import { boolean, decimal, index, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Code submissions from users.
 * Indexed on (userId, createdAt) for efficient history queries.
 */
export const codeSubmissions = mysqlTable("code_submissions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  originalCode: text("originalCode").notNull(),
  language: varchar("language", { length: 50 }).notNull(),
  userComments: text("userComments"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("idx_submissions_user_date").on(table.userId, table.createdAt),
]);

export type CodeSubmission = typeof codeSubmissions.$inferSelect;
export type InsertCodeSubmission = typeof codeSubmissions.$inferInsert;

/**
 * Pipeline results for each submission (forensic, rebuilt, quality).
 * Indexed on submissionId for efficient lookups.
 */
export const pipelineResults = mysqlTable("pipeline_results", {
  id: int("id").autoincrement().primaryKey(),
  submissionId: int("submissionId").notNull().references(() => codeSubmissions.id),
  forensicDossier: text("forensicDossier").notNull(),
  rebuiltCode: text("rebuiltCode").notNull(),
  qualityReport: text("qualityReport").notNull(),
  tokensUsed: int("tokensUsed"),
  estimatedCost: decimal("estimatedCost", { precision: 10, scale: 6 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("idx_results_submission").on(table.submissionId),
]);

export type PipelineResult = typeof pipelineResults.$inferSelect;
export type InsertPipelineResult = typeof pipelineResults.$inferInsert;

/**
 * System prompts for each pipeline step (forensic, rebuilder, quality).
 * Runtime-configurable by admin.
 */
export const systemPrompts = mysqlTable("system_prompts", {
  id: int("id").autoincrement().primaryKey(),
  stepName: mysqlEnum("stepName", ["forensic", "rebuilder", "quality"]).notNull().unique(),
  promptText: text("promptText").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SystemPrompt = typeof systemPrompts.$inferSelect;
export type InsertSystemPrompt = typeof systemPrompts.$inferInsert;

/**
 * Model configuration for each pipeline step.
 * Runtime-configurable by admin.
 */
export const modelConfig = mysqlTable("model_config", {
  id: int("id").autoincrement().primaryKey(),
  stepName: mysqlEnum("stepName", ["forensic", "rebuilder", "quality"]).notNull().unique(),
  selectedModel: varchar("selectedModel", { length: 100 }).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  providerModelId: int("provider_model_id"),
});

export type ModelConfig = typeof modelConfig.$inferSelect;
export type InsertModelConfig = typeof modelConfig.$inferInsert;

/**
 * Rate limits table (DEPRECATED - kept for backwards compatibility).
 * Rate limiting is now handled by Redis atomic counters.
 * This table can be safely dropped in a future migration.
 */
export const rateLimits = mysqlTable("rate_limits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id).unique(),
  dailyCount: int("dailyCount").default(0).notNull(),
  resetTimestamp: timestamp("resetTimestamp").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RateLimit = typeof rateLimits.$inferSelect;
export type InsertRateLimit = typeof rateLimits.$inferInsert;

// ─── New Admin Feature Tables ───

export const apiProviders = mysqlTable("api_providers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  baseUrl: varchar("base_url", { length: 255 }).notNull(),
  authType: mysqlEnum("auth_type", ["bearer", "header", "basic", "custom"]).default("bearer"),
  authHeaderName: varchar("auth_header_name", { length: 50 }).default("Authorization"),
  authPrefix: varchar("auth_prefix", { length: 20 }).default("Bearer "),
  version: varchar("version", { length: 20 }),
  testPrompt: text("test_prompt"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export const providerApiKeys = mysqlTable("provider_api_keys", {
  id: int("id").autoincrement().primaryKey(),
  providerId: int("provider_id").notNull().references(() => apiProviders.id),
  keyValue: text("key_value").notNull(),
  isActive: boolean("is_active").default(true),
  lastTested: timestamp("last_tested"),
  lastTestStatus: mysqlEnum("last_test_status", ["ok", "failed", "untested"]).default("untested"),
  lastTestMessage: text("last_test_message"),
  lastError: json("last_error"),
  lastUpdatedBy: int("last_updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export const providerModels = mysqlTable("provider_models", {
  id: int("id").autoincrement().primaryKey(),
  providerId: int("provider_id").notNull().references(() => apiProviders.id),
  modelName: varchar("model_name", { length: 100 }).notNull(),
  displayName: varchar("display_name", { length: 100 }),
  contextLength: int("context_length"),
  rpmLimit: int("rpm_limit"),
  tpmLimit: int("tpm_limit"),
  isEnabled: boolean("is_enabled").default(true),
  lastSynced: timestamp("last_synced"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export const providerAuditLog = mysqlTable("provider_audit_log", {
  id: int("id").autoincrement().primaryKey(),
  providerId: int("provider_id").notNull().references(() => apiProviders.id),
  action: varchar("action", { length: 50 }).notNull(),
  performedBy: int("performed_by").notNull().references(() => users.id),
  details: json("details"),
  performedAt: timestamp("performed_at").defaultNow(),
});

export const deadLetterQueue = mysqlTable("dead_letter_queue", {
  id: int("id").autoincrement().primaryKey(),
  jobId: varchar("job_id", { length: 100 }).notNull(),
  submissionId: int("submission_id"),
  step: varchar("step", { length: 50 }),
  provider: varchar("provider", { length: 100 }),
  model: varchar("model", { length: 100 }),
  errorMessage: text("error_message").notNull(),
  errorStack: text("error_stack"),
  failedAt: timestamp("failed_at").defaultNow(),
  retryCount: int("retry_count").default(0),
  payload: json("payload"),
  status: mysqlEnum("status", ["pending", "retried", "deleted"]).default("pending"),
});

export const idempotencyKeys = mysqlTable("idempotency_keys", {
  id: int("id").autoincrement().primaryKey(),
  idempotencyKey: varchar("idempotency_key", { length: 64 }).notNull(),
  userId: int("user_id").notNull().references(() => users.id),
  submissionId: int("submission_id").references(() => codeSubmissions.id),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: varchar("entity_id", { length: 100 }),
  beforeValue: json("before_value"),
  afterValue: json("after_value"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const providerHealthHistory = mysqlTable("provider_health_history", {
  id: int("id").autoincrement().primaryKey(),
  providerId: int("provider_id").notNull().references(() => apiProviders.id),
  status: varchar("status", { length: 20 }).notNull(),
  responseTimeMs: int("response_time_ms"),
  errorMessage: text("error_message"),
  checkedAt: timestamp("checked_at").defaultNow(),
});

export const runtimeConfig = mysqlTable("runtime_config", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull(),
  value: json("value").notNull(),
  description: text("description"),
  updatedBy: int("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  version: int("version").default(1),
});

export const userRateOverrides = mysqlTable("user_rate_overrides", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().references(() => users.id),
  limit: int("limit").notNull(),
  updatedBy: int("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export const dailyUsage = mysqlTable("daily_usage", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().references(() => users.id),
  date: varchar("date", { length: 10 }).notNull(),
  count: int("count").default(0),
});

export const backups = mysqlTable("backups", {
  id: int("id").autoincrement().primaryKey(),
  filename: varchar("filename", { length: 255 }).notNull(),
  size: varchar("size", { length: 50 }),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending"),
  downloadUrl: text("download_url"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});
