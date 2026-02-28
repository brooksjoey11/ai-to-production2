import { router, publicProcedure } from "../_core/trpc";
import logger from "../logger";

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => {
    logger.debug(
      { userId: ctx.user?.id ?? null },
      "Auth.me invoked"
    );
    return ctx.user ?? null;
  }),

  logout: publicProcedure.mutation(({ ctx }) => {
    logger.info(
      { userId: ctx.user?.id ?? null },
      "User logout"
    );

    ctx.res.clearCookie("session");
    return { success: true };
  }),
});
