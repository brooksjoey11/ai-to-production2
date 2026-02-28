import "dotenv/config";
import logger from "../logger";
import { getRedis } from "../redis";
import { initJobQueue, closeJobQueue } from "../jobQueue";

async function startWorker() {
  // Initialize Redis (non-blocking) to surface connection attempts in logs
  getRedis();

  // Start only the BullMQ worker in this process
  initJobQueue("worker");

  logger.info("Worker running (BullMQ pipeline processor)");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Worker shutting down gracefully...");
    await closeJobQueue();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

startWorker().catch((err) => {
  logger.fatal({ err: err instanceof Error ? err.message : String(err) }, "Failed to start worker");
  process.exit(1);
});
