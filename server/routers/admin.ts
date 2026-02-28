// ensure logger imported
import logger from "../logger";

// inside existing mutations (example additions)

logger.info(
  { adminId: ctx.user.id, action: "updatePrompt", promptId: input.id },
  "Admin updated system prompt"
);

logger.info(
  { adminId: ctx.user.id, action: "updateModel", modelConfigId: input.id },
  "Admin updated model configuration"
);
