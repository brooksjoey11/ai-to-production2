import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from "prom-client";

export const register = new Registry();

// Collect default Node.js metrics (CPU, memory, event loop, etc.)
collectDefaultMetrics({ register });

// ─── HTTP Metrics ───

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "path", "status_code"] as const,
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "path", "status_code"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// ─── Pipeline / Queue Metrics ───

export const queueSize = new Gauge({
  name: "pipeline_queue_size",
  help: "Number of jobs currently in the pipeline queue",
  registers: [register],
});

export const pipelineJobsTotal = new Counter({
  name: "pipeline_jobs_total",
  help: "Total number of pipeline jobs processed",
  labelNames: ["status"] as const,
  registers: [register],
});

export const llmTokensTotal = new Counter({
  name: "llm_tokens_total",
  help: "Total LLM tokens consumed",
  registers: [register],
});

// ─── Rate Limit Metrics ───

export const rateLimitHits = new Counter({
  name: "rate_limit_hits_total",
  help: "Total number of rate limit rejections",
  registers: [register],
});

// ─── Export all metrics as a single object ───

export const metrics = {
  register,
  httpRequestsTotal,
  httpRequestDuration,
  queueSize,
  pipelineJobsTotal,
  llmTokensTotal,
  rateLimitHits,
};
