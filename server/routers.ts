import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { codeSubmissions, pipelineResults, users } from "../drizzle/schema";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getAllModels, getAllPrompts, updateModel, updatePrompt, invalidateModelCache } from "./configService";
import { getDb } from "./db";
import { runPipeline } from "./pipeline";
import { consumeRateLimit, getRateLimitInfo } from "./rateLimit";
import { seedDefaults } from "./seed";

const SUPPORTED_LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "java",
  "csharp",
  "go",
  "rust",
  "ruby",
  "php",
  "swift",
  "kotlin",
  "c",
  "cpp",
  "sql",
  "html",
  "css",
  "shell",
  "other",
] as const;

const AVAILABLE_MODELS = [
  "gpt-4-turbo",
  "gpt-4o",
  "gpt-4o-mini",
  "claude-3-5-sonnet",
  "claude-3-haiku",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  "gemini-2.5-flash",
] as const;

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
      const info = await getRateLimitInfo(ctx.user.id);
      return info;
    }),

    /** Submit code for the three-step LLM pipeline */
    submit: protectedProcedure
      .input(
        z.object({
          code: z.string().min(1, "Code is required").max(100000, "Code too large (100KB max)"),
          language: z.enum(SUPPORTED_LANGUAGES),
          userComments: z.string().max(2000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Check rate limit
        const { allowed, info } = await consumeRateLimit(ctx.user.id);
        if (!allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Daily limit reached (${info.total} submissions/day). Resets at ${info.resetAt.toISOString()}.`,
          });
        }

        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        // Save submission
        const insertResult = await db.insert(codeSubmissions).values({
          userId: ctx.user.id,
          originalCode: input.code,
          language: input.language,
          userComments: input.userComments ?? null,
        });

        const submissionId = insertResult[0].insertId;

        // Run the three-step pipeline
        try {
          const pipelineOutput = await runPipeline({
            code: input.code,
            language: input.language,
            userComments: input.userComments,
          });

          // Save pipeline results
          await db.insert(pipelineResults).values({
            submissionId,
            forensicDossier: pipelineOutput.forensicDossier,
            rebuiltCode: pipelineOutput.rebuiltCode,
            qualityReport: pipelineOutput.qualityReport,
            tokensUsed: pipelineOutput.tokensUsed,
          });

          return {
            submissionId,
            forensicDossier: pipelineOutput.forensicDossier,
            rebuiltCode: pipelineOutput.rebuiltCode,
            qualityReport: pipelineOutput.qualityReport,
            tokensUsed: pipelineOutput.tokensUsed,
            rateLimit: info,
          };
        } catch (error) {
          console.error("[Pipeline] Error:", error instanceof Error ? error.message : error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "The analysis pipeline encountered an error. Please try again.",
          });
        }
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
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

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
      return AVAILABLE_MODELS;
    }),
  }),
});

export type AppRouter = typeof appRouter;
