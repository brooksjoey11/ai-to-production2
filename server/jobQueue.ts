import { Queue, Worker, Job } from "bullmq";
import { isRedisAvailable } from "./redis";
import logger from "./logger";
import { APP_CONFIG } from "@shared/config";
import { runPipeline, type PipelineInput, type PipelineOutput } from "./pipeline";
import { getDb } from "./_core/db";
import { pipelineResults, codeSubmissions } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { metrics } from "./metrics";

const QUEUE_NAME = "pipeline-jobs";

export interface PipelineJobData {
  submissionId: number;
  code: string;
  language: string;
  userComments?: string;
}

export interface JobStatusResult {
  jobId: string;
  status: "waiting" | "active" | "completed" | "failed";
  result?: {
    forensicDossier: string;
    rebuiltCode: string;
    qualityReport: string;
    tokensUsed: number;
  };
  error?: string;
}

type InitMode = "api" | "worker" | "both";

let queue: Queue | null = null;
let worker: Worker | null = null;

/* -------------------------------------------------------------------------- */
/*                                 INIT LOGIC                                 */
/* -------------------------------------------------------------------------- */

function ensureQueue(): void {
  if (queue) return;

  const connection = { url: APP_CONFIG.redisUrl };

  queue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: APP_CONFIG.jobMaxRetries,
      backoff: {
        type: "exponential",
        delay: APP_CONFIG.jobBackoffDelay,
      },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 500 },
    },
  });
}

function ensureWorker(): void {
  if (worker) return;

  const connection = { url: APP_CONFIG.redisUrl };

  worker = new Worker(
    QUEUE_NAME,
    async (job: Job<PipelineJobData>) => {
      logger.info(
        { jobId: job.id, submissionId: job.data.submissionId },
        "Pipeline job started"
      );

      metrics.queueSize.dec();

      const db = await getDb();

      try {
        const output = await runPipeline({
          code: job.data.code,
          language: job.data.language,
          userComments: job.data.userComments,
        } satisfies PipelineInput);

        if (db) {
          await db.insert(pipelineResults).values({
            submissionId: job.data.submissionId,
            forensicDossier: output.forensicDossier,
            rebuiltCode: output.rebuiltCode,
            qualityReport: output.qualityReport,
            tokensUsed: output.tokensUsed,
          });
        }

        metrics.llmTokensTotal.inc(output.tokensUsed);

        logger.info(
          {
            jobId: job.id,
            submissionId: job.data.submissionId,
            tokens: output.tokensUsed,
          },
          "Pipeline job completed"
        );

        return output;
      } catch (err) {
        logger.error(
          {
            jobId: job.id,
            submissionId: job.data.submissionId,
            err,
          },
          "Pipeline job execution failed"
        );
        throw err;
      }
    },
    {
      connection,
      concurrency: APP_CONFIG.queueWorkerConcurrency,
      limiter: {
        max: APP_CONFIG.queueLimiterMax,
        duration: APP_CONFIG.queueLimiterDurationMs,
      },
    }
  );

  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, submissionId: job?.data?.submissionId, err },
      "Pipeline job marked as failed"
    );
  });

  worker.on("error", (err) => {
    logger.error({ err }, "Worker error");
  });
}

export function initJobQueue(mode: InitMode = "both"): void {
  if (!isRedisAvailable()) {
    logger.warn("Redis unavailable — queue will operate in degraded mode");
    return;
  }

  if (mode === "api") {
    ensureQueue();
    return;
  }

  if (mode === "worker") {
    ensureQueue();
    ensureWorker();
    return;
  }

  ensureQueue();
  ensureWorker();
}

/* -------------------------------------------------------------------------- */
/*                                ENQUEUE LOGIC                               */
/* -------------------------------------------------------------------------- */

export async function enqueuePipelineJob(
  data: PipelineJobData
): Promise<string> {
  if (!queue) {
    throw new Error("Queue not initialized");
  }

  const job = await queue.add("pipeline", data, {
    jobId: `sub-${data.submissionId}-${Date.now()}`,
  });

  metrics.queueSize.inc();

  logger.info(
    { jobId: job.id, submissionId: data.submissionId },
    "Pipeline job enqueued"
  );

  return job.id!;
}

/* -------------------------------------------------------------------------- */
/*                           HARDENED STATUS RESOLUTION                       */
/* -------------------------------------------------------------------------- */

function mapBullState(state: string): JobStatusResult["status"] {
  switch (state) {
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "active":
      return "active";
    case "waiting":
    case "delayed":
    default:
      return "waiting";
  }
}

/**
 * Single authoritative status resolution:
 * 1. DB result existence = completed
 * 2. BullMQ state (if exists)
 * 3. Fallback to waiting
 */
export async function getJobStatus(
  jobId: string
): Promise<JobStatusResult> {
  const db = await getDb();

  // Extract submissionId from jobId
  const match = jobId.match(/sub-(\d+)-/);
  const submissionId = match ? parseInt(match[1], 10) : null;

  // 1. DB-first: if results exist, treat as completed
  if (submissionId && db) {
    const results = await db
      .select()
      .from(pipelineResults)
      .where(eq(pipelineResults.submissionId, submissionId))
      .limit(1);

    if (results.length > 0) {
      return {
        jobId,
        status: "completed",
        result: {
          forensicDossier: results[0].forensicDossier,
          rebuiltCode: results[0].rebuiltCode,
          qualityReport: results[0].qualityReport,
          tokensUsed: results[0].tokensUsed ?? 0,
        },
      };
    }
  }

  // 2. BullMQ resolution
  if (queue) {
    try {
      const job = await queue.getJob(jobId);

      if (job) {
        const state = await job.getState();

        return {
          jobId,
          status: mapBullState(state),
          error:
            state === "failed"
              ? job.failedReason ?? "Pipeline execution failed"
              : undefined,
        };
      }
    } catch (err) {
      logger.warn({ err, jobId }, "BullMQ status resolution failed");
    }
  }

  // 3. Default fallback
  return {
    jobId,
    status: "waiting",
  };
}

/* -------------------------------------------------------------------------- */
/*                                 SHUTDOWN                                   */
/* -------------------------------------------------------------------------- */

export async function closeJobQueue(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
}
