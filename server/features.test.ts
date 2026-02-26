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

// ─── Tests ───

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

describe("code.getRateLimit", () => {
  it("returns rate limit info for authenticated user", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.code.getRateLimit();
    expect(result).toHaveProperty("remaining");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("resetAt");
    expect(result.total).toBe(5);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
    expect(result.remaining).toBeLessThanOrEqual(5);
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

describe("admin routes", () => {
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

  it("allows admin to get prompts", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.getPrompts();
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
    // Should have all three steps
    expect(result).toHaveProperty("forensic");
    expect(result).toHaveProperty("rebuilder");
    expect(result).toHaveProperty("quality");
  });

  it("allows admin to get models", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.getModels();
    expect(result).toBeDefined();
    expect(result).toHaveProperty("forensic");
    expect(result).toHaveProperty("rebuilder");
    expect(result).toHaveProperty("quality");
  });

  it("allows admin to get available models list", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.getAvailableModels();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("gpt-4-turbo");
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

  it("allows admin to view submissions", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.getSubmissions({ limit: 10, offset: 0 });
    expect(result).toHaveProperty("submissions");
    expect(Array.isArray(result.submissions)).toBe(true);
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
