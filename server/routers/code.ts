logger.info(
  {
    userId: ctx.user.id,
    submissionId: record.id,
    language: validated.language,
  },
  "Code submission accepted"
);
