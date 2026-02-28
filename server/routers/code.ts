import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { validateSubmission } from "../validation";
import { enqueuePipelineJob } from "../jobQueue";
import { getDb } from "../_core/db";
import { codeSubmissions } from "../../drizzle/schema";
import { AppError } from "../errors";
import { APP_CONFIG } from "@shared/config";
import logger from "../logger";

export const codeRouter = router({
  submit: protectedProcedure
    .input(z.unknown())
    .mutation(async ({ input, ctx }) => {
      const validated = validateSubmission(input);

      const db = await getDb();
      if (!db) {
        throw new AppError("INTERNAL_ERROR", "Database unavailable");
      }

      // Enforce daily submission limit
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const submissionsToday = await db.query.codeSubmissions.findMany({
        where: (fields, operators) =>
          operators.and(
            operators.eq(fields.userId, ctx.user.id),
            operators.gte(fields.createdAt, today)
          ),
      });

      if (
        submissionsToday.length >= APP_CONFIG.maxDailySubmissions
      ) {
        throw new AppError(
          "RATE_LIMITED",
          "Daily submission limit reached"
        );
      }

      const [record] = await db
        .insert(codeSubmissions)
        .values({
          userId: ctx.user.id,
          code: validated.code,
          language: validated.language,
          userComments: validated.userComments ?? null,
        })
        .$returningId();

      const jobId = await enqueuePipelineJob({
        submissionId: record.id,
        code: validated.code,
        language: validated.language,
        userComments: validated.userComments,
      });

      logger.info(
        { submissionId: record.id, userId: ctx.user.id },
        "Submission accepted"
      );

      return {
        submissionId: record.id,
        jobId,
      };
    }),
});
