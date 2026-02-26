import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { APP_CONFIG } from "@shared/config";
import logger from "../logger";
import { getRedis } from "../redis";
import { initJobQueue, closeJobQueue } from "../jobQueue";
import { requestLogger, errorSanitizer } from "../middleware";
import { healthCheck } from "../health";
import { metrics } from "../metrics";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Trust proxy for secure cookie detection behind reverse proxies
  app.set("trust proxy", 1);

  // Body parser with configurable limit
  app.use(express.json({ limit: APP_CONFIG.maxBodySize }));
  app.use(express.urlencoded({ limit: APP_CONFIG.maxBodySize, extended: true }));
  app.use(cookieParser());

  // Request logging middleware
  app.use(requestLogger);

  // Health check endpoint
  app.get("/health", healthCheck);

  // Prometheus metrics endpoint
  app.get("/metrics", async (_req, res) => {
    try {
      res.set("Content-Type", metrics.register.contentType);
      res.end(await metrics.register.metrics());
    } catch (err) {
      res.status(500).end();
    }
  });

  // Initialize Redis (non-blocking)
  getRedis();

  // Initialize BullMQ job queue
  initJobQueue();

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Error sanitization (must be last middleware)
  app.use(errorSanitizer);

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    logger.info({ preferredPort, actualPort: port }, "Port busy, using alternative");
  }

  server.listen(port, () => {
    logger.info({ port }, `Server running on http://localhost:${port}/`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down gracefully...");
    await closeJobQueue();
    server.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });
    // Force exit after 10 seconds
    setTimeout(() => process.exit(1), 10_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((err) => {
  logger.fatal({ err: err.message }, "Failed to start server");
  process.exit(1);
});
