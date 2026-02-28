import pino from "pino";
import { ENV } from "./_core/env";

export const logger = pino({
  level: ENV.LOG_LEVEL || "info",
  base: {
    service: "ai-to-production",
    env: ENV.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;
