import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { toTRPCError } from "../errors";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return {
      ...shape,
      data: {
        ...shape.data,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure.use(async ({ next }) => {
  try {
    return await next();
  } catch (err) {
    throw toTRPCError(err);
  }
});

export const protectedProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw toTRPCError(
      new Error("Unauthorized")
    );
  }
  return next();
});

export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user?.role !== "admin") {
    throw toTRPCError(
      new Error("Forbidden")
    );
  }
  return next();
});
