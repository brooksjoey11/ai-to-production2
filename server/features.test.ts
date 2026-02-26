import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Helper: create a mock context ───

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-open-id",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  return createMockContext({ role: "admin" });
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ─── Auth Router Tests ───

describe("auth.me", () => {
  it("returns the authenticated user", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.email).toBe("test@example.com");
    expect(result?.role).toBe("user");
  });

  it("returns null for unauthenticated user", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

// ─── Code Router Tests ───

describe("code.getRateLimit", () => {
  it("returns rate limit info for authenticated user", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.code.getRateLimit();
    expect(result).toHaveProperty("remaining");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("resetAt");
    expect(result.total).toBeGreaterThan(0);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
    expect(result.remaining).toBeLessThanOrEqual(result.total);
  });

  it("rejects unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.code.getRateLimit()).rejects.toThrow();
  });
});

describe("code.submit", () => {
  it("rejects empty code", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.code.submit({ code: "", language: "javascript" })
    ).rejects.toThrow();
  });

  it("rejects unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.code.submit({ code: "const x = 1;", language: "javascript" })
    ).rejects.toThrow();
  });
});

describe("code.getJobStatus", () => {
  it("rejects unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.code.getJobStatus({ jobId: "test-job-123" })
    ).rejects.toThrow();
  });

  it("returns status for unknown job", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.code.getJobStatus({ jobId: "nonexistent-job" });
    expect(result).toHaveProperty("jobId");
    expect(result).toHaveProperty("status");
    expect(result.status).toBe("waiting");
  });
});

// ─── Admin Router Tests ───

describe("admin routes - access control", () => {
  it("rejects non-admin users from getPrompts", async () => {
    const ctx = createMockContext({ role: "user" });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.getPrompts()).rejects.toThrow();
  });

  it("rejects unauthenticated users from getPrompts", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.getPrompts()).rejects.toThrow();
  });

  it("rejects non-admin from updating prompt", async () => {
    const ctx = createMockContext({ role: "user" });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.admin.updatePrompt({ step: "forensic", promptText: "test" })
    ).rejects.toThrow();
  });

  it("rejects non-admin from updating model", async () => {
    const ctx = createMockContext({ role: "user" });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.admin.updateModel({ step: "forensic", model: "gpt-4o" })
    ).rejects.toThrow();
  });

  it("rejects non-admin from viewing submissions", async () => {
    const ctx = createMockContext({ role: "user" });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.admin.getSubmissions({ limit: 10, offset: 0 })
    ).rejects.toThrow();
  });
});

describe("admin.getPrompts", () => {
  it("allows admin to get prompts", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.getPrompts();
    expect(result).toBeDefined();
    expect(result).toHaveProperty("forensic");
    expect(result).toHaveProperty("rebuilder");
    expect(result).toHaveProperty("quality");
    expect(typeof result.forensic).toBe("string");
    expect(result.forensic.length).toBeGreaterThan(0);
  });
});

describe("admin.getModels", () => {
  it("allows admin to get models", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.getModels();
    expect(result).toBeDefined();
    expect(result).toHaveProperty("forensic");
    expect(result).toHaveProperty("rebuilder");
    expect(result).toHaveProperty("quality");
  });
});

describe("admin.getAvailableModels", () => {
  it("returns available models list", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.getAvailableModels();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("gpt-4-turbo");
  });
});

describe("admin.updatePrompt", () => {
  it("rejects empty prompt text", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.admin.updatePrompt({ step: "forensic", promptText: "" })
    ).rejects.toThrow();
  });

  it("allows admin to update a prompt", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.updatePrompt({
      step: "forensic",
      promptText: "Test forensic prompt for vitest",
    });
    expect(result).toEqual({ success: true });

    // Verify the prompt was updated
    const prompts = await caller.admin.getPrompts();
    expect(prompts.forensic).toBe("Test forensic prompt for vitest");
  });
});

describe("admin.updateModel", () => {
  it("allows admin to update a model", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.updateModel({
      step: "rebuilder",
      model: "gpt-4o",
    });
    expect(result).toEqual({ success: true });

    // Verify the model was updated
    const models = await caller.admin.getModels();
    expect(models.rebuilder).toBe("gpt-4o");
  });
});

describe("admin.getSubmissions", () => {
  it("allows admin to view submissions", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.getSubmissions({ limit: 10, offset: 0 });
    expect(result).toHaveProperty("submissions");
    expect(Array.isArray(result.submissions)).toBe(true);
  });
});

describe("admin.seedDefaults", () => {
  it("allows admin to seed defaults", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.seedDefaults();
    expect(result).toEqual({ success: true });
  });

  it("rejects non-admin from seeding defaults", async () => {
    const ctx = createMockContext({ role: "user" });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.seedDefaults()).rejects.toThrow();
  });
});

// ─── Rate Limiter Unit Tests ───

describe("Rate Limiter", () => {
  it("getRateLimitInfo returns valid structure", async () => {
    const { getRateLimitInfo } = await import("./rateLimit");
    const info = await getRateLimitInfo(999);
    expect(info).toHaveProperty("remaining");
    expect(info).toHaveProperty("total");
    expect(info).toHaveProperty("resetAt");
    expect(info.remaining).toBeLessThanOrEqual(info.total);
    expect(info.resetAt instanceof Date).toBe(true);
  });

  it("consumeRateLimit decrements remaining count", async () => {
    const { consumeRateLimit, getRateLimitInfo } = await import("./rateLimit");
    const userId = Math.floor(Math.random() * 100000) + 10000;

    const before = await getRateLimitInfo(userId);
    const { allowed, info } = await consumeRateLimit(userId);

    expect(allowed).toBe(true);
    expect(info.remaining).toBe(before.remaining - 1);
  });

  it("consumeRateLimit respects max daily limit", async () => {
    const { consumeRateLimit } = await import("./rateLimit");
    const { APP_CONFIG } = await import("../shared/config");
    const userId = Math.floor(Math.random() * 100000) + 20000;

    // Consume all allowed submissions
    for (let i = 0; i < APP_CONFIG.maxDailySubmissions; i++) {
      const { allowed } = await consumeRateLimit(userId);
      expect(allowed).toBe(true);
    }

    // Next one should be rejected
    const { allowed, info } = await consumeRateLimit(userId);
    expect(allowed).toBe(false);
    expect(info.remaining).toBe(0);
  });
});

// ─── Config Service Unit Tests ───

describe("Config Service", () => {
  it("getPrompt returns default prompts", async () => {
    const { getPrompt } = await import("./configService");
    const prompt = await getPrompt("forensic");
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("getAllPrompts returns all three steps", async () => {
    const { getAllPrompts } = await import("./configService");
    const prompts = await getAllPrompts();
    expect(prompts).toHaveProperty("forensic");
    expect(prompts).toHaveProperty("rebuilder");
    expect(prompts).toHaveProperty("quality");
  });

  it("getModel returns default model", async () => {
    const { getModel } = await import("./configService");
    const model = await getModel("forensic");
    expect(typeof model).toBe("string");
    expect(model.length).toBeGreaterThan(0);
  });

  it("getAllModels returns all three steps", async () => {
    const { getAllModels } = await import("./configService");
    const models = await getAllModels();
    expect(models).toHaveProperty("forensic");
    expect(models).toHaveProperty("rebuilder");
    expect(models).toHaveProperty("quality");
  });
});

// ─── Shared Config Tests ───

describe("APP_CONFIG", () => {
  it("has valid maxDailySubmissions", async () => {
    const { APP_CONFIG } = await import("../shared/config");
    expect(APP_CONFIG.maxDailySubmissions).toBeGreaterThan(0);
    expect(APP_CONFIG.maxDailySubmissions).toBeLessThanOrEqual(100);
  });

  it("has valid maxCodeSizeBytes", async () => {
    const { APP_CONFIG } = await import("../shared/config");
    expect(APP_CONFIG.maxCodeSizeBytes).toBeGreaterThan(0);
  });

  it("has supported languages", async () => {
    const { APP_CONFIG } = await import("../shared/config");
    expect(APP_CONFIG.supportedLanguages.length).toBeGreaterThan(0);
    expect(APP_CONFIG.supportedLanguages).toContain("javascript");
    expect(APP_CONFIG.supportedLanguages).toContain("python");
  });

  it("has available models", async () => {
    const { APP_CONFIG } = await import("../shared/config");
    expect(APP_CONFIG.availableModels.length).toBeGreaterThan(0);
    expect(APP_CONFIG.availableModels).toContain("gpt-4-turbo");
  });

  it("has a default model", async () => {
    const { APP_CONFIG } = await import("../shared/config");
    expect(typeof APP_CONFIG.defaultModel).toBe("string");
    expect(APP_CONFIG.availableModels).toContain(APP_CONFIG.defaultModel);
  });
});

// ─── Logger Tests ───

describe("Logger", () => {
  it("exports a pino logger instance", async () => {
    const { default: logger } = await import("./logger");
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
  });
});

// ─── Metrics Tests ───

describe("Metrics", () => {
  it("exports Prometheus metrics", async () => {
    const { metrics } = await import("./metrics");
    expect(metrics).toBeDefined();
    expect(metrics.register).toBeDefined();
    expect(metrics.httpRequestsTotal).toBeDefined();
    expect(metrics.httpRequestDuration).toBeDefined();
    expect(metrics.queueSize).toBeDefined();
    expect(metrics.llmTokensTotal).toBeDefined();
    expect(metrics.rateLimitHits).toBeDefined();
  });

  it("register can produce metrics output", async () => {
    const { metrics } = await import("./metrics");
    const output = await metrics.register.metrics();
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });
});

// ─── Job Queue Tests ───

describe("Job Queue", () => {
  it("getJobStatus returns waiting for unknown jobs", async () => {
    const { getJobStatus } = await import("./jobQueue");
    const result = await getJobStatus("nonexistent-job-id");
    expect(result.jobId).toBe("nonexistent-job-id");
    expect(result.status).toBe("waiting");
  });
});
