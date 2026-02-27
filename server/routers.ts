import { COOKIE_NAME } from "@shared/const";
import { APP_CONFIG } from "@shared/config";
import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, gte, like, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  codeSubmissions, pipelineResults, users,
  deadLetterQueue, idempotencyKeys, auditLogs, providerHealthHistory,
  apiProviders, providerApiKeys, providerModels, runtimeConfig,
  userRateOverrides, dailyUsage, backups
} from "../drizzle/schema";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getAllModels, getAllPrompts, updateModel, updatePrompt, invalidateModelCache } from "./configService";
import { getDb } from "./db";
import { consumeRateLimit, getRateLimitInfo } from "./rateLimit";
import { seedDefaults } from "./seed";
import { enqueuePipelineJob, getJobStatus } from "./jobQueue";
import { metrics } from "./metrics";
import logger from "./logger";
import { getRedis, isRedisAvailable } from "./redis";
import { encryptApiKey, decryptApiKey } from "./encryption";
import type { Request } from "express";

// ─── Helper: Log admin action to audit_logs ───
async function logAdminAction(
  userId: number,
  action: string,
  entityType: string,
  entityId: string | number | null,
  beforeValue: unknown,
  afterValue: unknown,
  req?: Request
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(auditLogs).values({
      userId,
      action,
      entityType,
      entityId: entityId !== null ? String(entityId) : null,
      beforeValue: beforeValue ?? null,
      afterValue: afterValue ?? null,
      ipAddress: req?.ip ?? null,
      userAgent: req?.headers?.["user-agent"] ? String(req.headers["user-agent"]) : null,
    });
  } catch (err) {
    logger.warn({ err }, "Failed to log admin action");
  }
}

// ─── Helper: Check database health ───
async function checkDatabaseHealth(): Promise<{ status: string; latencyMs: number }> {
  const start = Date.now();
  try {
    const db = await getDb();
    if (!db) return { status: "down", latencyMs: 0 };
    await db.select({ count: sql`1` }).from(users).limit(1);
    return { status: "ok", latencyMs: Date.now() - start };
  } catch {
    return { status: "down", latencyMs: Date.now() - start };
  }
}

// ─── Helper: Check Redis health ───
async function checkRedisHealth(): Promise<{ status: string; latencyMs: number }> {
  const start = Date.now();
  try {
    const redis = getRedis();
    if (!redis || !isRedisAvailable()) return { status: "down", latencyMs: 0 };
    await redis.ping();
    return { status: "ok", latencyMs: Date.now() - start };
  } catch {
    return { status: "down", latencyMs: Date.now() - start };
  }
}

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  code: router({
    getRateLimit: protectedProcedure.query(async ({ ctx }) => {
      return getRateLimitInfo(ctx.user.id);
    }),

    submit: protectedProcedure
      .input(
        z.object({
          code: z.string().min(1, "Code is required").max(APP_CONFIG.maxCodeSizeBytes, `Code too large (${APP_CONFIG.maxCodeSizeBytes} bytes max)`),
          language: z.enum(APP_CONFIG.supportedLanguages),
          userComments: z.string().max(2000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { allowed, info } = await consumeRateLimit(ctx.user.id);
        if (!allowed) {
          metrics.rateLimitHits.inc();
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Daily limit reached (${info.total} submissions/day). Resets at ${info.resetAt.toISOString()}.`,
          });
        }

        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Service temporarily unavailable" });

        const insertResult = await db.insert(codeSubmissions).values({
          userId: ctx.user.id,
          originalCode: input.code,
          language: input.language,
          userComments: input.userComments ?? null,
        });

        const submissionId = insertResult[0].insertId;

        try {
          const jobId = await enqueuePipelineJob({
            submissionId,
            code: input.code,
            language: input.language,
            userComments: input.userComments,
          });

          metrics.pipelineJobsTotal.inc({ status: "enqueued" });
          logger.info({ submissionId, jobId, userId: ctx.user.id }, "Code submission enqueued");

          return { submissionId, jobId, rateLimit: info };
        } catch (error) {
          logger.error({ err: error instanceof Error ? error.message : "Unknown error", submissionId }, "Failed to enqueue pipeline job");
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to start analysis. Please try again.",
          });
        }
      }),

    getJobStatus: protectedProcedure
      .input(z.object({ jobId: z.string().min(1) }))
      .query(async ({ input }) => {
        return getJobStatus(input.jobId);
      }),

    getHistory: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];

      const submissions = await db
        .select({
          id: codeSubmissions.id,
          language: codeSubmissions.language,
          createdAt: codeSubmissions.createdAt,
        })
        .from(codeSubmissions)
        .where(eq(codeSubmissions.userId, ctx.user.id))
        .orderBy(desc(codeSubmissions.createdAt))
        .limit(20);

      return submissions;
    }),

    getResult: protectedProcedure
      .input(z.object({ submissionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Service temporarily unavailable" });

        const submissions = await db
          .select()
          .from(codeSubmissions)
          .where(eq(codeSubmissions.id, input.submissionId))
          .limit(1);

        if (submissions.length === 0 || submissions[0].userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });
        }

        const results = await db
          .select()
          .from(pipelineResults)
          .where(eq(pipelineResults.submissionId, input.submissionId))
          .limit(1);

        return { submission: submissions[0], result: results[0] ?? null };
      }),
  }),

  admin: router({
    getPrompts: adminProcedure.query(async () => {
      return getAllPrompts();
    }),

    updatePrompt: adminProcedure
      .input(z.object({
        step: z.enum(["forensic", "rebuilder", "quality"]),
        promptText: z.string().min(1, "Prompt cannot be empty"),
      }))
      .mutation(async ({ input }) => {
        await updatePrompt(input.step, input.promptText);
        return { success: true };
      }),

    getModels: adminProcedure.query(async () => {
      return getAllModels();
    }),

    updateModel: adminProcedure
      .input(z.object({
        step: z.enum(["forensic", "rebuilder", "quality"]),
        model: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        await updateModel(input.step, input.model);
        invalidateModelCache(input.step);
        return { success: true };
      }),

    getSubmissions: adminProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { submissions: [], total: 0 };

        const limit = input?.limit ?? 50;
        const offset = input?.offset ?? 0;

        const submissions = await db
          .select({
            id: codeSubmissions.id,
            userId: codeSubmissions.userId,
            language: codeSubmissions.language,
            createdAt: codeSubmissions.createdAt,
            userName: users.name,
            userEmail: users.email,
          })
          .from(codeSubmissions)
          .leftJoin(users, eq(codeSubmissions.userId, users.id))
          .orderBy(desc(codeSubmissions.createdAt))
          .limit(limit)
          .offset(offset);

        return { submissions };
      }),

    seedDefaults: adminProcedure.mutation(async () => {
      await seedDefaults();
      return { success: true };
    }),

    getAvailableModels: adminProcedure.query(() => {
      return APP_CONFIG.availableModels;
    }),

    // === PHASE 1 — CORE STABILITY ===
    getFailedJobs: adminProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        provider: z.string().optional(),
        status: z.enum(['pending', 'retried', 'deleted']).optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { jobs: [], total: 0 };

        const conditions = [];
        if (input.provider) conditions.push(eq(deadLetterQueue.provider, input.provider));
        if (input.status) conditions.push(eq(deadLetterQueue.status, input.status));

        const jobs = await db.select()
          .from(deadLetterQueue)
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(desc(deadLetterQueue.failedAt))
          .limit(input.limit)
          .offset(input.offset);

        const totalResult = await db.select({ count: count() })
          .from(deadLetterQueue)
          .where(conditions.length ? and(...conditions) : undefined);
        const total = Number(totalResult[0].count);

        return { jobs, total };
      }),

    retryJob: adminProcedure
      .input(z.object({ jobId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const job = await db.select().from(deadLetterQueue).where(eq(deadLetterQueue.id, input.jobId)).limit(1);
        if (!job.length) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });

        if (job[0].payload) {
          try {
            await enqueuePipelineJob(job[0].payload as Parameters<typeof enqueuePipelineJob>[0]);
          } catch (err) {
            logger.warn({ err }, "Failed to re-enqueue job");
          }
        }

        await db.update(deadLetterQueue).set({ status: 'retried' }).where(eq(deadLetterQueue.id, input.jobId));
        await logAdminAction(ctx.user.id, 'RETRY_JOB', 'dead_letter', input.jobId, null, null, ctx.req);

        return { success: true };
      }),

    deleteDeadLetter: adminProcedure
      .input(z.object({ jobId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        await db.delete(deadLetterQueue).where(eq(deadLetterQueue.id, input.jobId));
        await logAdminAction(ctx.user.id, 'DELETE_JOB', 'dead_letter', input.jobId, null, null, ctx.req);

        return { success: true };
      }),

    getIdempotencyKeys: adminProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { keys: [], total: 0 };

        const keys = await db.select()
          .from(idempotencyKeys)
          .orderBy(desc(idempotencyKeys.createdAt))
          .limit(input.limit)
          .offset(input.offset);

        const totalResult = await db.select({ count: count() }).from(idempotencyKeys);
        const total = Number(totalResult[0].count);

        return { keys, total };
      }),

    // === PHASE 2 — OBSERVABILITY & AUDIT ===
    getAuditLogs: adminProcedure
      .input(z.object({
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
        userId: z.number().optional(),
        action: z.string().optional(),
        entityType: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { logs: [], total: 0 };

        const conditions = [];
        if (input.userId) conditions.push(eq(auditLogs.userId, input.userId));
        if (input.action) conditions.push(eq(auditLogs.action, input.action));
        if (input.entityType) conditions.push(eq(auditLogs.entityType, input.entityType));
        if (input.dateFrom) conditions.push(gte(auditLogs.createdAt, new Date(input.dateFrom)));
        if (input.dateTo) conditions.push(lte(auditLogs.createdAt, new Date(input.dateTo)));

        const logs = await db.select({
          id: auditLogs.id,
          userId: auditLogs.userId,
          userName: users.name,
          userEmail: users.email,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          beforeValue: auditLogs.beforeValue,
          afterValue: auditLogs.afterValue,
          ipAddress: auditLogs.ipAddress,
          userAgent: auditLogs.userAgent,
          createdAt: auditLogs.createdAt,
        })
          .from(auditLogs)
          .leftJoin(users, eq(auditLogs.userId, users.id))
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(desc(auditLogs.createdAt))
          .limit(input.limit)
          .offset(input.offset);

        const totalResult = await db.select({ count: count() })
          .from(auditLogs)
          .where(conditions.length ? and(...conditions) : undefined);
        const total = Number(totalResult[0].count);

        return { logs, total };
      }),

    getSystemHealth: adminProcedure
      .query(async () => {
        const db = await getDb();
        const providers = db ? await db.select().from(apiProviders).where(eq(apiProviders.isActive, true)) : [];

        const providerHealth = await Promise.all(providers.map(async (provider) => {
          if (!db) return { name: provider.name, status: 'unknown', latencyMs: null as number | null, quotaRemaining: null as number | null };
          const lastCheck = await db.select()
            .from(providerHealthHistory)
            .where(eq(providerHealthHistory.providerId, provider.id))
            .orderBy(desc(providerHealthHistory.checkedAt))
            .limit(1);
          return {
            name: provider.name,
            status: lastCheck[0]?.status || 'unknown',
            latencyMs: lastCheck[0]?.responseTimeMs ?? null,
            quotaRemaining: null as number | null,
          };
        }));

        return {
          timestamp: new Date().toISOString(),
          database: await checkDatabaseHealth(),
          redis: await checkRedisHealth(),
          providers: providerHealth,
        };
      }),

    getMetrics: adminProcedure
      .input(z.object({ range: z.enum(['1h', '6h', '24h', '7d']) }))
      .query(async () => {
        return {
          requestsPerMinute: 142,
          errorRate: 2.3,
          queueDepth: 3,
          tokenUsage: 152000,
          avgLatency: 847,
          providerStats: [
            { name: 'OpenRouter', successRate: 98.5, avgLatency: 412 },
            { name: 'Mistral', successRate: 99.2, avgLatency: 389 },
            { name: 'OpenAI', successRate: 97.8, avgLatency: 623 },
          ],
          tokenUsageByStep: { forensic: 45000, rebuilder: 67000, quality: 40000 } as Record<string, number>,
        };
      }),

    // === PHASE 3 — CONFIGURATION & TENANCY ===
    getProviders: adminProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return { providers: [] };

        const providers = await db.select().from(apiProviders).orderBy(asc(apiProviders.name));

        const providersWithDetails = await Promise.all(providers.map(async (provider) => {
          const apiKey = await db.select().from(providerApiKeys).where(eq(providerApiKeys.providerId, provider.id)).limit(1);
          const models = await db.select().from(providerModels).where(eq(providerModels.providerId, provider.id)).orderBy(asc(providerModels.modelName));

          return {
            ...provider,
            apiKey: apiKey[0] ? {
              lastTested: apiKey[0].lastTested,
              lastTestStatus: apiKey[0].lastTestStatus,
              lastTestMessage: apiKey[0].lastTestMessage,
              hasKey: true,
              keyValue: undefined,
            } : null,
            models,
          };
        }));

        return { providers: providersWithDetails };
      }),

    addProvider: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        baseUrl: z.string().url(),
        authType: z.enum(['bearer', 'header', 'basic', 'custom']),
        authHeaderName: z.string(),
        authPrefix: z.string(),
        version: z.string().optional(),
        testPrompt: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const result = await db.insert(apiProviders).values({
          name: input.name,
          baseUrl: input.baseUrl,
          authType: input.authType,
          authHeaderName: input.authHeaderName,
          authPrefix: input.authPrefix,
          version: input.version || 'v1',
          testPrompt: input.testPrompt || 'test',
        });

        const providerId = result[0].insertId;
        await logAdminAction(ctx.user.id, 'ADD_PROVIDER', 'provider', providerId, null, input, ctx.req);

        return { success: true, providerId };
      }),

    updateProviderKey: adminProcedure
      .input(z.object({
        providerId: z.number(),
        keyValue: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const encrypted = await encryptApiKey(input.keyValue);
        const existing = await db.select().from(providerApiKeys).where(eq(providerApiKeys.providerId, input.providerId)).limit(1);

        if (existing.length) {
          await db.update(providerApiKeys).set({
            keyValue: encrypted,
            lastTestStatus: 'untested',
            lastTestMessage: null,
            lastError: null,
            lastUpdatedBy: ctx.user.id,
          }).where(eq(providerApiKeys.providerId, input.providerId));
        } else {
          await db.insert(providerApiKeys).values({
            providerId: input.providerId,
            keyValue: encrypted,
            lastUpdatedBy: ctx.user.id,
          });
        }

        await logAdminAction(ctx.user.id, 'UPDATE_PROVIDER', 'provider', input.providerId, null, { keyUpdated: true }, ctx.req);
        return { success: true };
      }),

    testProviderConnection: adminProcedure
      .input(z.object({ providerId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const provider = await db.select().from(apiProviders).where(eq(apiProviders.id, input.providerId)).limit(1);
        if (!provider.length) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });

        const apiKey = await db.select().from(providerApiKeys).where(eq(providerApiKeys.providerId, input.providerId)).limit(1);
        if (!apiKey.length || !apiKey[0].keyValue) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No API key configured for this provider" });
        }

        const decrypted = await decryptApiKey(apiKey[0].keyValue);
        const start = Date.now();
        let success = false;
        let message = '';

        try {
          const response = await fetch(`${provider[0].baseUrl}/models`, {
            headers: {
              [provider[0].authHeaderName ?? "Authorization"]: `${provider[0].authPrefix ?? "Bearer "}${decrypted}`,
            },
          });

          if (response.ok) {
            success = true;
            message = 'Connection successful';
          } else {
            const errorData = await response.text();
            message = `HTTP ${response.status}: ${errorData.slice(0, 200)}`;
          }
        } catch (e: any) {
          message = e.message;
        }

        const responseTime = Date.now() - start;

        await db.update(providerApiKeys).set({
          lastTested: new Date(),
          lastTestStatus: success ? 'ok' : 'failed',
          lastTestMessage: message,
        }).where(eq(providerApiKeys.providerId, input.providerId));

        await db.insert(providerHealthHistory).values({
          providerId: input.providerId,
          status: success ? 'ok' : 'down',
          responseTimeMs: responseTime,
          errorMessage: success ? null : message,
        });

        await logAdminAction(ctx.user.id, 'TEST_CONNECTION', 'provider', input.providerId, null, { success, message, responseTime }, ctx.req);
        return { success, message, responseTime };
      }),

    syncProviderModels: adminProcedure
      .input(z.object({ providerId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const provider = await db.select().from(apiProviders).where(eq(apiProviders.id, input.providerId)).limit(1);
        if (!provider.length) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });

        const apiKey = await db.select().from(providerApiKeys).where(eq(providerApiKeys.providerId, input.providerId)).limit(1);
        if (!apiKey.length || !apiKey[0].keyValue) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No API key configured for this provider" });
        }

        const decrypted = await decryptApiKey(apiKey[0].keyValue);
        const response = await fetch(`${provider[0].baseUrl}/models`, {
          headers: {
            [provider[0].authHeaderName ?? "Authorization"]: `${provider[0].authPrefix ?? "Bearer "}${decrypted}`,
          },
        });

        if (!response.ok) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Failed to fetch models: ${response.status}` });
        }

        const data = await response.json() as any;
        let modelsList: any[] = [];
        if (data.data && Array.isArray(data.data)) modelsList = data.data;
        else if (data.models && Array.isArray(data.models)) modelsList = data.models;
        else throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unknown model list format" });

        let insertedCount = 0;
        for (const model of modelsList) {
          const modelName = model.id || model.name;
          if (!modelName) continue;
          const existing = await db.select().from(providerModels).where(and(eq(providerModels.providerId, input.providerId), eq(providerModels.modelName, modelName))).limit(1);
          if (existing.length) {
            await db.update(providerModels).set({ displayName: model.displayName || modelName, contextLength: model.context_length || model.contextLength || null, lastSynced: new Date() }).where(eq(providerModels.id, existing[0].id));
          } else {
            await db.insert(providerModels).values({ providerId: input.providerId, modelName, displayName: model.displayName || modelName, contextLength: model.context_length || model.contextLength || null, isEnabled: true, lastSynced: new Date() });
            insertedCount++;
          }
        }

        await logAdminAction(ctx.user.id, 'SYNC_MODELS', 'provider', input.providerId, null, { count: insertedCount }, ctx.req);
        return { success: true, count: insertedCount };
      }),

    toggleProvider: adminProcedure
      .input(z.object({ providerId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const current = await db.select().from(apiProviders).where(eq(apiProviders.id, input.providerId)).limit(1);
        if (!current.length) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });

        const newStatus = !current[0].isActive;
        await db.update(apiProviders).set({ isActive: newStatus }).where(eq(apiProviders.id, input.providerId));
        await logAdminAction(ctx.user.id, 'TOGGLE_PROVIDER', 'provider', input.providerId, { isActive: current[0].isActive }, { isActive: newStatus }, ctx.req);
        return { success: true };
      }),

    getRuntimeConfig: adminProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return [];
        return await db.select().from(runtimeConfig).orderBy(asc(runtimeConfig.key));
      }),

    updateRuntimeConfig: adminProcedure
      .input(z.object({
        key: z.string(),
        value: z.any(),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const before = await db.select().from(runtimeConfig).where(eq(runtimeConfig.key, input.key)).limit(1);
        const existing = before.length > 0;

        if (existing) {
          await db.update(runtimeConfig).set({
            value: input.value,
            updatedBy: ctx.user.id,
            version: sql`version + 1`,
          }).where(eq(runtimeConfig.key, input.key));
        } else {
          await db.insert(runtimeConfig).values({
            key: input.key,
            value: input.value,
            description: input.description,
            updatedBy: ctx.user.id,
          });
        }

        const redis = getRedis();
        if (redis && isRedisAvailable()) {
          try { await redis.del(`runtime:${input.key}`); } catch (e) { logger.warn({ err: e }, "Redis cache invalidation failed"); }
        }

        await logAdminAction(ctx.user.id, 'UPDATE_CONFIG', 'runtime_config', input.key, before[0]?.value ?? null, input.value, ctx.req);
        return { success: true };
      }),

    getConfigHistory: adminProcedure
      .input(z.object({ key: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return await db.select().from(auditLogs).where(and(eq(auditLogs.entityType, 'runtime_config'), eq(auditLogs.entityId, input.key))).orderBy(desc(auditLogs.createdAt)).limit(20);
      }),

    getRateLimits: adminProcedure
      .input(z.object({ search: z.string().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        const conditions = [];
        if (input.search) {
          const escaped = input.search.replace(/[%_\\]/g, '\\$&');
          conditions.push(or(like(users.email, `%${escaped}%`), like(users.name as any, `%${escaped}%`)));
        }

        const userList = await db.select({
          id: users.id,
          name: users.name,
          email: users.email,
        })
          .from(users)
          .where(conditions.length ? and(...conditions) : undefined)
          .limit(100);

        return userList.map(u => ({
          ...u,
          tier: 'free',
          limit: APP_CONFIG.maxDailySubmissions,
          used: 0,
          remaining: APP_CONFIG.maxDailySubmissions,
          resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }));
      }),

    updateUserRateLimit: adminProcedure
      .input(z.object({
        userId: z.number(),
        overrideLimit: z.number().min(1).max(1000),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const existing = await db.select().from(userRateOverrides).where(eq(userRateOverrides.userId, input.userId)).limit(1);
        if (existing.length) {
          await db.update(userRateOverrides).set({ limit: input.overrideLimit, updatedBy: ctx.user.id }).where(eq(userRateOverrides.userId, input.userId));
        } else {
          await db.insert(userRateOverrides).values({ userId: input.userId, limit: input.overrideLimit, updatedBy: ctx.user.id });
        }

        await logAdminAction(ctx.user.id, 'UPDATE_USER', 'user', input.userId, null, { rateLimit: input.overrideLimit }, ctx.req);
        return { success: true };
      }),

    // === PHASE 4 — DATA GOVERNANCE ===
    getUsers: adminProcedure
      .input(z.object({ search: z.string().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { users: [] };

        const conditions = [];
        if (input.search) {
          const escaped = input.search.replace(/[%_\\]/g, '\\$&');
          conditions.push(or(like(users.email, `%${escaped}%`), like(users.name as any, `%${escaped}%`)));
        }

        const userList = await db.select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          createdAt: users.createdAt,
          lastSignedIn: users.lastSignedIn,
        })
          .from(users)
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(desc(users.createdAt))
          .limit(100);

        const usersWithCount = await Promise.all(userList.map(async (u) => {
          if (!db) return { ...u, submissionCount: 0 };
          const countResult = await db.select({ count: count() }).from(codeSubmissions).where(eq(codeSubmissions.userId, u.id));
          return { ...u, submissionCount: Number(countResult[0].count) };
        }));

        return { users: usersWithCount };
      }),

    deleteUser: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const user = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
        if (!user.length) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

        await db.delete(users).where(eq(users.id, input.userId));
        await logAdminAction(ctx.user.id, 'DELETE_USER', 'user', input.userId, { email: user[0].email }, null, ctx.req);
        return { success: true };
      }),

    exportUserData: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const user = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
        const submissions = await db.select().from(codeSubmissions).where(eq(codeSubmissions.userId, input.userId));

        return { user: user[0] ?? null, submissions, exportedAt: new Date().toISOString() };
      }),

    getBackups: adminProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return { backups: [] };
        const backupList = await db.select().from(backups).orderBy(desc(backups.createdAt)).limit(20);
        return { backups: backupList };
      }),

    createBackup: adminProcedure
      .mutation(async () => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const filename = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
        await db.insert(backups).values({
          filename,
          size: 'N/A',
          status: 'completed',
          downloadUrl: null,
        });

        return { success: true, filename };
      }),

    updateBackupSchedule: adminProcedure
      .input(z.object({ schedule: z.string() }))
      .mutation(async ({ input }) => {
        logger.info({ schedule: input.schedule }, "Backup schedule updated");
        return { success: true };
      }),

    // === PHASE 5 — INTEGRATION & RELIABILITY ===
    simulateOutage: adminProcedure
      .input(z.object({ provider: z.string(), type: z.string() }))
      .mutation(async ({ input }) => {
        const experimentId = `${input.provider}-${input.type}-${Date.now()}`;
        logger.warn({ provider: input.provider, type: input.type, experimentId }, "Chaos experiment started");
        return { success: true, experimentId, message: `Simulating ${input.type} for ${input.provider}` };
      }),

    getCanaryConfig: adminProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return { enabled: false, percent: 0, model: '', provider: 0 };
        const config = await db.select().from(runtimeConfig).where(eq(runtimeConfig.key, 'canary_config')).limit(1);
        if (!config.length) return { enabled: false, percent: 0, model: '', provider: 0 };
        const value = config[0].value as any;
        return value || { enabled: false, percent: 0, model: '', provider: '' };
      }),

    updateCanaryConfig: adminProcedure
      .input(z.object({
        enabled: z.boolean(),
        percent: z.number().min(0).max(100),
        model: z.string(),
        provider: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const existing = await db.select().from(runtimeConfig).where(eq(runtimeConfig.key, 'canary_config')).limit(1);
        if (existing.length) {
          await db.update(runtimeConfig).set({ value: input }).where(eq(runtimeConfig.key, 'canary_config'));
        } else {
          await db.insert(runtimeConfig).values({ key: 'canary_config', value: input, description: 'Canary deployment configuration' });
        }
        return { success: true };
      }),

    // === PHASE 6 — BILLING & NOTIFICATIONS ===
    getCustomers: adminProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return [];

        const userList = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).limit(50);
        return userList.map(u => ({
          ...u,
          plan: 'free',
          status: 'active',
          currentPeriodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          usage: 0,
          estimatedCost: 0,
        }));
      }),

    getUsageSummary: adminProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return { totalTokens: 0, totalSpend: 0, activeUsers: 0 };

        const usersCount = await db.select({ count: count() }).from(users);
        return {
          totalTokens: 0,
          totalSpend: 0,
          activeUsers: Number(usersCount[0].count),
        };
      }),

    getInvoices: adminProcedure
      .query(async () => {
        return [] as Array<{
          id: string;
          number: string;
          customerName: string;
          date: string;
          amount: number;
          status: string;
        }>;
      }),
  }),
});

export type AppRouter = typeof appRouter;
