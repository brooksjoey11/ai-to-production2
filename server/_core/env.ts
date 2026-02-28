export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};

export type EnvValidationOptions = {
  /**
   * If true, DATABASE_URL must be set.
   * Defaults to ENV.isProduction.
   */
  requireDatabaseUrl?: boolean;
};

export type EnvValidationIssue = {
  key: string;
  reason: string;
};

export function validateEnv(options: EnvValidationOptions = {}): EnvValidationIssue[] {
  const issues: EnvValidationIssue[] = [];
  const requireDatabaseUrl = options.requireDatabaseUrl ?? ENV.isProduction;

  if (!ENV.appId) {
    issues.push({ key: "VITE_APP_ID", reason: "required to identify the app during OAuth login" });
  }

  if (!ENV.cookieSecret) {
    issues.push({ key: "JWT_SECRET", reason: "required to sign/verify session cookies" });
  }

  if (!ENV.oAuthServerUrl) {
    issues.push({
      key: "OAUTH_SERVER_URL",
      reason: "required to exchange OAuth codes and fetch user identity",
    });
  }

  if (!ENV.forgeApiKey) {
    issues.push({ key: "BUILT_IN_FORGE_API_KEY", reason: "required to call the Forge LLM API" });
  }

  if (requireDatabaseUrl && !ENV.databaseUrl) {
    issues.push({ key: "DATABASE_URL", reason: "required for persistent storage in production" });
  }

  return issues;
}

export function validateEnvOrThrow(options: EnvValidationOptions = {}): void {
  const issues = validateEnv(options);
  if (issues.length === 0) return;

  const messageLines = [
    "Missing required environment variables:",
    ...issues.map((i) => `- ${i.key}: ${i.reason}`),
  ];
  throw new Error(messageLines.join("\n"));
}
