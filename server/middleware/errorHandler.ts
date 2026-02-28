import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors";
import logger from "../logger";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    logger.warn(
      { code: err.code, message: err.message, details: err.details },
      "AppError handled"
    );

    return res.status(mapStatus(err.code)).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  logger.error({ err }, "Unhandled Express error");

  return res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected server error occurred.",
    },
  });
}

function mapStatus(code: string): number {
  switch (code) {
    case "BAD_REQUEST":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "RATE_LIMITED":
      return 429;
    case "EXTERNAL_SERVICE_ERROR":
      return 502;
    case "INTERNAL_ERROR":
    default:
      return 500;
  }
}
