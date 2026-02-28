import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { apiProviders, providerApiKeys } from "../drizzle/schema";
import { getDb } from "./db";
import logger from "./logger";
import { ENV } from "./_core/env";

export type AuthType = "bearer" | "header" | "custom";

export type ProviderRow = {
  id: number;
  name: string;
  baseUrl: string;
  authType: AuthType;
  authHeaderName: string;
  authPrefix: string;
  requiresApiKey: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ProviderSummary = ProviderRow & {
  hasActiveKey: boolean;
  lastTested: Date | null;
  lastTestStatus: string | null;
  lastTestMessage: string | null;
};

export type ProviderUpsertInput = {
  name: string;
  baseUrl: string;
  authType: AuthType;
  authHeaderName: string;
  authPrefix: string;
  requiresApiKey: boolean;
  isActive: boolean;
};

export type TestResult = {
  success: boolean;
  message: string;
  testedAt: string;
};

const ENC_VERSION = "v1";

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function requireCryptoSecret(): Buffer {
  if (!ENV.cookieSecret) {
    throw new Error("JWT_SECRET is required for provider key encryption");
  }
  // Stable key derivation from JWT_SECRET to a 32-byte key.
  return crypto.scryptSync(ENV.cookieSecret, "ai-to-production:provider-keys", 32);
}

export function encryptApiKey(plain: string): string {
  const key = requireCryptoSecret();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENC_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function decryptApiKey(encrypted: string): string {
  const key = requireCryptoSecret();
  const parts = encrypted.split(":");
  if (parts.length !== 4 || parts[0] !== ENC_VERSION) {
    throw new Error("Unsupported API key encryption format");
  }

  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const ciphertext = Buffer.from(parts[3], "base64url");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}

export async function listProviders(): Promise<ProviderSummary[]> {
  const db = await getDb();
  if (!db) return [];

  const providers = await db.select().from(apiProviders).orderBy(desc(apiProviders.updatedAt));

  const results: ProviderSummary[] = [];
  for (const p of providers) {
    const keyRows = await db
      .select()
      .from(providerApiKeys)
      .where(and(eq(providerApiKeys.providerId, p.id), eq(providerApiKeys.isActive, 1)))
      .orderBy(desc(providerApiKeys.updatedAt))
      .limit(1);

    const keyRow = keyRows[0];
    results.push({
      id: p.id,
      name: p.name,
      baseUrl: p.baseUrl,
      authType: p.authType as AuthType,
      authHeaderName: p.authHeaderName,
      authPrefix: p.authPrefix,
      requiresApiKey: p.requiresApiKey === 1,
      isActive: p.isActive === 1,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      hasActiveKey: !!keyRow,
      lastTested: keyRow?.lastTested ?? null,
      lastTestStatus: keyRow?.lastTestStatus ?? null,
      lastTestMessage: keyRow?.lastTestMessage ?? null,
    });
  }

  return results;
}

export async function createProvider(input: ProviderUpsertInput): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const inserted = await db.insert(apiProviders).values({
    name: input.name,
    baseUrl: normalizeBaseUrl(input.baseUrl),
    authType: input.authType,
    authHeaderName: input.authHeaderName,
    authPrefix: input.authPrefix,
    requiresApiKey: input.requiresApiKey ? 1 : 0,
    isActive: input.isActive ? 1 : 0,
  });

  const id = inserted?.[0]?.insertId;
  if (!id) throw new Error("Failed to create provider");
  return { id };
}

export async function updateProvider(
  providerId: number,
  patch: Partial<Omit<ProviderUpsertInput, "name">> & { name?: never }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const values: Record<string, unknown> = {};
  if (patch.baseUrl !== undefined) values.baseUrl = normalizeBaseUrl(patch.baseUrl);
  if (patch.authType !== undefined) values.authType = patch.authType;
  if (patch.authHeaderName !== undefined) values.authHeaderName = patch.authHeaderName;
  if (patch.authPrefix !== undefined) values.authPrefix = patch.authPrefix;
  if (patch.requiresApiKey !== undefined) values.requiresApiKey = patch.requiresApiKey ? 1 : 0;
  if (patch.isActive !== undefined) values.isActive = patch.isActive ? 1 : 0;

  await db.update(apiProviders).set(values).where(eq(apiProviders.id, providerId));
}

export async function setProviderApiKey(providerId: number, rawKey: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const encrypted = encryptApiKey(rawKey);

  // Deactivate older keys
  await db
    .update(providerApiKeys)
    .set({ isActive: 0 })
    .where(eq(providerApiKeys.providerId, providerId));

  await db.insert(providerApiKeys).values({
    providerId,
    keyValue: encrypted,
    isActive: 1,
    lastTested: null,
    lastTestStatus: "untested",
    lastTestMessage: null,
  });
}

function buildAuthHeader(provider: ProviderRow, apiKey: string): { headerName: string; headerValue: string } {
  const headerName = provider.authHeaderName || "Authorization";

  if (provider.authType === "bearer") {
    const prefix = provider.authPrefix ?? "Bearer ";
    return { headerName, headerValue: `${prefix}${apiKey}` };
  }

  if (provider.authType === "header") {
    const prefix = provider.authPrefix ?? "";
    return { headerName, headerValue: `${prefix}${apiKey}` };
  }

  // Phase 1: treat custom as header-based (configurable header + prefix).
  const prefix = provider.authPrefix ?? "";
  return { headerName, headerValue: `${prefix}${apiKey}` };
}

async function getActiveKey(providerId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const rows = await db
    .select()
    .from(providerApiKeys)
    .where(and(eq(providerApiKeys.providerId, providerId), eq(providerApiKeys.isActive, 1)))
    .orderBy(desc(providerApiKeys.updatedAt))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return decryptApiKey(row.keyValue);
}

export async function testProviderConnection(providerId: number): Promise<TestResult> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const providers = await db.select().from(apiProviders).where(eq(apiProviders.id, providerId)).limit(1);
  const provider = providers[0];
  if (!provider) throw new Error("Provider not found");

  const testedAt = new Date();
  let status: "ok" | "failed" = "failed";
  let message = "Unknown failure";

  try {
    const apiKey = (provider.requiresApiKey === 1) ? await getActiveKey(providerId) : "";
    if (provider.requiresApiKey === 1 && (!apiKey || apiKey.trim().length === 0)) {
      throw new Error("API key is not configured for this provider");
    }

    const url = `${normalizeBaseUrl(provider.baseUrl)}/models`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const headers: Record<string, string> = {
      "content-type": "application/json",
    };

    if (provider.requiresApiKey === 1 && apiKey) {
      const auth = buildAuthHeader(provider as unknown as ProviderRow, apiKey);
      headers[auth.headerName] = auth.headerValue;
    }

    const res = await fetch(url, { method: "GET", headers, signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      status = "ok";
      message = "Connected successfully. /models responded OK.";
    } else if (res.status === 401 || res.status === 403) {
      status = "failed";
      message = "Invalid API key or insufficient permissions.";
    } else if (res.status === 404) {
      status = "failed";
      message = "The provider did not recognize /models at this base URL.";
    } else if (res.status === 429) {
      status = "failed";
      message = "Rate limited by provider. Try again shortly.";
    } else {
      const body = await res.text().catch(() => "");
      status = "failed";
      message = `Provider returned ${res.status}. ${body ? `Response: ${body.slice(0, 300)}` : ""}`.trim();
    }
  } catch (err) {
    const e = err as Error;
    const raw = e?.message || "Unknown error";
    if (raw.includes("aborted") || raw.includes("AbortError")) {
      message = "Connection timed out.";
    } else {
      message = raw;
    }
    status = "failed";
  }

  // Update last test metadata on active key row (if present)
  try {
    const keyRows = await db
      .select()
      .from(providerApiKeys)
      .where(and(eq(providerApiKeys.providerId, providerId), eq(providerApiKeys.isActive, 1)))
      .orderBy(desc(providerApiKeys.updatedAt))
      .limit(1);

    const keyRow = keyRows[0];
    if (keyRow) {
      await db
        .update(providerApiKeys)
        .set({
          lastTested: testedAt,
          lastTestStatus: status,
          lastTestMessage: message,
        })
        .where(eq(providerApiKeys.id, keyRow.id));
    }
  } catch (err) {
    logger.warn({ providerId, err: err instanceof Error ? err.message : "unknown" }, "Failed to persist provider test result");
  }

  if (status === "ok") {
    logger.info({ providerId, provider: provider.name }, "Provider connection test OK");
    return { success: true, message, testedAt: testedAt.toISOString() };
  }

  logger.warn({ providerId, provider: provider.name, message }, "Provider connection test FAILED");
  return { success: false, message, testedAt: testedAt.toISOString() };
}
