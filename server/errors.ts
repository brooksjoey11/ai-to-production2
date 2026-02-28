import { TRPCError } from "@trpc/server";
import logger from "./logger";

export type AppErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "EXTERNAL_SERVICE_ERROR";

export interface AppErrorShape {
  code: AppErrorCode;
  message: string;
  details?: unknown;
}

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly details?: unknown;

  constructor(code: AppErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function toTRPCError(error: unknown): TRPCError {
  if (error instanceof AppError) {
    return new TRPCError({
      code: mapToTRPCCode(error.code),
      message: error.message,
      cause: error.details,
    });
  }

  if (error instanceof TRPCError) {
    return error;
  }

  logger.error({ err: error }, "Unhandled error converted to INTERNAL_ERROR");

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred.",
  });
}

function mapToTRPCCode(code: AppErrorCode): TRPCError["code"] {
  switch (code) {
    case "BAD_REQUEST":
      return "BAD_REQUEST";
    case "UNAUTHORIZED":
      return "UNAUTHORIZED";
    case "FORBIDDEN":
      return "FORBIDDEN";
    case "NOT_FOUND":
      return "NOT_FOUND";
    case "RATE_LIMITED":
      return "TOO_MANY_REQUESTS";
    case "EXTERNAL_SERVICE_ERROR":
      return "BAD_GATEWAY";
    case "INTERNAL_ERROR":
    default:
      return "INTERNAL_SERVER_ERROR";
  }
}
