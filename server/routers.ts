import { COOKIE_NAME } from "@shared/const";
import { APP_CONFIG } from "@shared/config";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { codeSubmissions, pipelineResults, users } from "../drizzle/schema";
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
    /** Get current rate limit info for the authenticated user */
    getRateLimit: protectedProcedure.query(async ({ ctx }) => {
      return getRateLimitInfo(ctx.user.id);
    }),

    /** Submit code for the three-step LLM pipeline (async – returns jobId) */
    submit: protectedProcedure
      .input(
        z.object({
          code: z.string().min(1, "Code is required").max(APP_CONFIG.maxCodeSizeBytes, `Code too large (${APP_CONFIG.maxCodeSizeBytes} bytes max)`),
          language: z.enum(APP_CONFIG.supportedLanguages),
          userComments: z.string().max(2000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Check rate limit
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

        // Save submission
        const insertResult = await db.insert(codeSubmissions).values({
          userId: ctx.user.id,
          originalCode: input.code,
          language: input.language,
          userComments: input.userComments ?? null,
        });

        const submissionId = insertResult[0].insertId;

        // Enqueue async pipeline job
        try {
          const jobId = await enqueuePipelineJob({
            submissionId,
            code: input.code,
            language: input.language,
            userComments: input.userComments,
          });

          metrics.pipelineJobsTotal.inc({ status: "enqueued" });
          logger.info({ submissionId, jobId, userId: ctx.user.id }, "Code submission enqueued");

          return {
            submissionId,
            jobId,
            rateLimit: info,
          };
        } catch (error) {
          logger.error({ err: error instanceof Error ? error.message : "Unknown error", submissionId }, "Failed to enqueue pipeline job");
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to start analysis. Please try again.",
          });
        }
      }),

    /** Poll for job status and results */
    getJobStatus: protectedProcedure
      .input(z.object({ jobId: z.string().min(1) }))
      .query(async ({ input }) => {
        return getJobStatus(input.jobId);
      }),

    /** Get submission history for the authenticated user */
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

    /** Get a specific submission result */
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

        return {
          submission: submissions[0],
          result: results[0] ?? null,
        };
      }),
  }),

  admin: router({
    /** Get all system prompts */
    getPrompts: adminProcedure.query(async () => {
      return getAllPrompts();
    }),

    /** Update a system prompt */
    updatePrompt: adminProcedure
      .input(
        z.object({
          step: z.enum(["forensic", "rebuilder", "quality"]),
          promptText: z.string().min(1, "Prompt cannot be empty"),
        })
      )
      .mutation(async ({ input }) => {
        await updatePrompt(input.step, input.promptText);
        return { success: true };
      }),

    /** Get all model configurations */
    getModels: adminProcedure.query(async () => {
      return getAllModels();
    }),

    /** Update model for a pipeline step */
    updateModel: adminProcedure
      .input(
        z.object({
          step: z.enum(["forensic", "rebuilder", "quality"]),
          model: z.string().min(1),
        })
      )
      .mutation(async ({ input }) => {
        await updateModel(input.step, input.model);
        invalidateModelCache(input.step);
        return { success: true };
      }),

    /** Get all submissions (admin view) */
    getSubmissions: adminProcedure
      .input(
        z.object({
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
        }).optional()
      )
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

    /** Seed default prompts and models */
    seedDefaults: adminProcedure.mutation(async () => {
      await seedDefaults();
      return { success: true };
    }),

    /** Get available models list */
    getAvailableModels: adminProcedure.query(() => {
      return APP_CONFIG.availableModels;
    }),
  }),
});

export type AppRouter = typeof appRouter;
