import { Queue, Worker, Job } from "bullmq";
import { isRedisAvailable } from "./redis";
import logger from "./logger";
import { APP_CONFIG } from "@shared/config";
import { runPipeline, type PipelineInput, type PipelineOutput } from "./pipeline";
import { getDb } from "./db";
import { pipelineResults } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { metrics } from "./metrics";

const QUEUE_NAME = "pipeline-jobs";

// ─── In-memory job store (fallback when Redis is unavailable) ───
interface InMemoryJob {
  id: string;
  status: "waiting" | "active" | "completed" | "failed";
  data: PipelineJobData;
  result?: PipelineOutput;
  error?: string;
  createdAt: number;
}
const inMemoryJobs: Map<string, InMemoryJob> = new Map();

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
      logger.info({ jobId: job.id, submissionId: job.data.submissionId }, "Pipeline job started");
      metrics.queueSize.dec();

      const output = await runPipeline({
        code: job.data.code,
        language: job.data.language,
        userComments: job.data.userComments,
      } satisfies PipelineInput);

      // Store results in DB
      const db = await getDb();
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
        { jobId: job.id, submissionId: job.data.submissionId, tokens: output.tokensUsed },
        "Pipeline job completed"
      );

      return output;
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
    logger.error({ jobId: job?.id, err: err.message }, "Pipeline job failed");
  });

  worker.on("error", (err) => {
    logger.error({ err: err.message }, "Worker error");
  });
}

/**
 * Initialize the BullMQ queue and/or worker.
 * - mode "api": initialize queue only (for enqueue/status). No worker.
 * - mode "worker": initialize worker (and queue if needed).
 * - mode "both": initialize both (backward-compatible).
 *
 * Falls back to synchronous in-memory processing if Redis is unavailable.
 */
export function initJobQueue(mode: InitMode = "both"): void {
  if (!isRedisAvailable()) {
    logger.warn("Redis not available – pipeline jobs will run synchronously in-memory");
    return;
  }

  try {
    if (mode === "api") {
      ensureQueue();
      logger.info(
        { queue: QUEUE_NAME },
        "BullMQ queue initialized (api mode: worker disabled)"
      );
      return;
    }

    if (mode === "worker") {
      ensureQueue();
      ensureWorker();
      logger.info(
        {
          queue: QUEUE_NAME,
          concurrency: APP_CONFIG.queueWorkerConcurrency,
          limiterMax: APP_CONFIG.queueLimiterMax,
          limiterDurationMs: APP_CONFIG.queueLimiterDurationMs,
        },
        "BullMQ worker initialized (worker mode)"
      );
      return;
    }

    ensureQueue();
    ensureWorker();
    logger.info(
      {
        queue: QUEUE_NAME,
        concurrency: APP_CONFIG.queueWorkerConcurrency,
        limiterMax: APP_CONFIG.queueLimiterMax,
        limiterDurationMs: APP_CONFIG.queueLimiterDurationMs,
      },
      "BullMQ queue and worker initialized (both mode)"
    );
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, mode },
      "Failed to initialize BullMQ, falling back to sync processing"
    );
    queue = null;
    worker = null;
  }
}

/**
 * Enqueue a pipeline job. Returns the jobId.
 * Falls back to in-memory processing if queue is unavailable.
 */
export async function enqueuePipelineJob(data: PipelineJobData): Promise<string> {
  if (queue) {
    try {
      const job = await queue.add("pipeline", data, {
        jobId: `sub-${data.submissionId}-${Date.now()}`,
      });
      metrics.queueSize.inc();
      logger.info({ jobId: job.id, submissionId: data.submissionId }, "Pipeline job enqueued");
      return job.id!;
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "Failed to enqueue to BullMQ, falling back to sync");
    }
  }

  // In-memory fallback
  const jobId = `mem-${data.submissionId}-${Date.now()}`;
  const memJob: InMemoryJob = {
    id: jobId,
    status: "active",
    data,
    createdAt: Date.now(),
  };
  inMemoryJobs.set(jobId, memJob);

  processInMemory(memJob).catch((err) => {
    logger.error({ jobId, err: (err as Error).message }, "In-memory pipeline job failed");
  });

  return jobId;
}

async function processInMemory(memJob: InMemoryJob): Promise<void> {
  try {
    const output = await runPipeline({
      code: memJob.data.code,
      language: memJob.data.language,
      userComments: memJob.data.userComments,
    } satisfies PipelineInput);

    const db = await getDb();
    if (db) {
      await db.insert(pipelineResults).values({
        submissionId: memJob.data.submissionId,
        forensicDossier: output.forensicDossier,
        rebuiltCode: output.rebuiltCode,
        qualityReport: output.qualityReport,
        tokensUsed: output.tokensUsed,
      });
    }

    memJob.result = output;
    memJob.status = "completed";
    metrics.llmTokensTotal.inc(output.tokensUsed);
    logger.info({ jobId: memJob.id, submissionId: memJob.data.submissionId }, "In-memory pipeline job completed");
  } catch (err) {
    memJob.error = err instanceof Error ? err.message : "Unknown error";
    memJob.status = "failed";
    logger.error({ jobId: memJob.id, err: memJob.error }, "In-memory pipeline job failed");
  }
}

/**
 * Get the status of a pipeline job.
 */
export async function getJobStatus(jobId: string): Promise<JobStatusResult> {
  const memJob = inMemoryJobs.get(jobId);
  if (memJob) {
    return {
      jobId: memJob.id,
      status: memJob.status,
      result: memJob.result
        ? {
            forensicDossier: memJob.result.forensicDossier,
            rebuiltCode: memJob.result.rebuiltCode,
            qualityReport: memJob.result.qualityReport,
            tokensUsed: memJob.result.tokensUsed,
          }
        : undefined,
      error: memJob.error,
    };
  }

  if (queue) {
    try {
      const job = await queue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        const returnValue = job.returnvalue as PipelineOutput | undefined;

        let status: JobStatusResult["status"];
        if (state === "completed") status = "completed";
        else if (state === "failed") status = "failed";
        else if (state === "active") status = "active";
        else status = "waiting";

        return {
          jobId: job.id!,
          status,
          result: returnValue
            ? {
                forensicDossier: returnValue.forensicDossier,
                rebuiltCode: returnValue.rebuiltCode,
                qualityReport: returnValue.qualityReport,
                tokensUsed: returnValue.tokensUsed,
              }
            : undefined,
          error: state === "failed" ? job.failedReason : undefined,
        };
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message, jobId }, "Failed to get BullMQ job status");
    }
  }

  const db = await getDb();
  if (db) {
    const match = jobId.match(/(?:sub|mem)-(\d+)-/);
    if (match) {
      const submissionId = parseInt(match[1], 10);
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
  }

  return { jobId, status: "waiting" };
}

/**
 * Gracefully close the queue and worker.
 */
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
