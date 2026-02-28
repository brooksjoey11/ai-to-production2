import {
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

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
export const codeSubmissions = mysqlTable(
  "code_submissions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    originalCode: text("originalCode").notNull(),
    language: varchar("language", { length: 50 }).notNull(),
    userComments: text("userComments"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("idx_submissions_user_date").on(table.userId, table.createdAt)]
);

export type CodeSubmission = typeof codeSubmissions.$inferSelect;
export type InsertCodeSubmission = typeof codeSubmissions.$inferInsert;

/**
 * Pipeline results for each submission (forensic, rebuilt, quality).
 * Indexed on submissionId for efficient lookups.
 */
export const pipelineResults = mysqlTable(
  "pipeline_results",
  {
    id: int("id").autoincrement().primaryKey(),
    submissionId: int("submissionId").notNull().references(() => codeSubmissions.id),
    forensicDossier: text("forensicDossier").notNull(),
    rebuiltCode: text("rebuiltCode").notNull(),
    qualityReport: text("qualityReport").notNull(),
    tokensUsed: int("tokensUsed"),
    estimatedCost: decimal("estimatedCost", { precision: 10, scale: 6 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("idx_results_submission").on(table.submissionId)]
);

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
 * API Providers (admin-managed).
 */
export const apiProviders = mysqlTable("api_providers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  baseUrl: varchar("baseUrl", { length: 255 }).notNull(),
  authType: mysqlEnum("authType", ["bearer", "header", "custom"]).default("bearer").notNull(),
  authHeaderName: varchar("authHeaderName", { length: 50 }).default("Authorization").notNull(),
  authPrefix: varchar("authPrefix", { length: 20 }).default("Bearer ").notNull(),
  requiresApiKey: int("requiresApiKey").default(1).notNull(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ApiProvider = typeof apiProviders.$inferSelect;
export type InsertApiProvider = typeof apiProviders.$inferInsert;

/**
 * Provider API keys (encrypted at rest).
 */
export const providerApiKeys = mysqlTable("provider_api_keys", {
  id: int("id").autoincrement().primaryKey(),
  providerId: int("providerId").notNull().references(() => apiProviders.id, { onDelete: "cascade" }),
  keyValue: text("keyValue").notNull(),
  isActive: int("isActive").default(1).notNull(),
  lastTested: timestamp("lastTested"),
  lastTestStatus: varchar("lastTestStatus", { length: 50 }),
  lastTestMessage: text("lastTestMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProviderApiKey = typeof providerApiKeys.$inferSelect;
export type InsertProviderApiKey = typeof providerApiKeys.$inferInsert;

/**
 * Provider models (synced later in Phase 2).
 */
export const providerModels = mysqlTable(
  "provider_models",
  {
    id: int("id").autoincrement().primaryKey(),
    providerId: int("providerId").notNull().references(() => apiProviders.id, { onDelete: "cascade" }),
    modelName: varchar("modelName", { length: 120 }).notNull(),
    displayName: varchar("displayName", { length: 120 }),
    contextLength: int("contextLength"),
    isEnabled: int("isEnabled").default(1).notNull(),
    lastSynced: timestamp("lastSynced"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("provider_models_provider_model_unique").on(table.providerId, table.modelName)]
);

export type ProviderModel = typeof providerModels.$inferSelect;
export type InsertProviderModel = typeof providerModels.$inferInsert;

/**
 * Model configuration for each pipeline step.
 * Runtime-configurable by admin.
 *
 * Backward compatible:
 * - selectedModel remains authoritative for current runtime.
 * - providerModelId is introduced for future multi-provider support.
 */
export const modelConfig = mysqlTable("model_config", {
  id: int("id").autoincrement().primaryKey(),
  stepName: mysqlEnum("stepName", ["forensic", "rebuilder", "quality"]).notNull().unique(),
  selectedModel: varchar("selectedModel", { length: 100 }).notNull(),
  providerModelId: int("providerModelId").references(() => providerModels.id, { onDelete: "set null" }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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
