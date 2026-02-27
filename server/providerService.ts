import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { apiProviders, providerApiKeys, providerModels } from "../drizzle/schema";
import { decryptApiKey } from "./encryption";

export interface ProviderConfig {
  id: number;
  name: string;
  baseUrl: string;
  authHeaderName: string;
  authPrefix: string;
  apiKey: string;
}

export async function getProviderForModel(providerModelId: number): Promise<ProviderConfig> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const model = await db
    .select()
    .from(providerModels)
    .where(eq(providerModels.id, providerModelId))
    .limit(1);

  if (!model.length) throw new Error(`Provider model ${providerModelId} not found`);

  const provider = await db
    .select()
    .from(apiProviders)
    .where(eq(apiProviders.id, model[0].providerId))
    .limit(1);

  if (!provider.length) throw new Error(`Provider not found for model ${providerModelId}`);

  const apiKey = await db
    .select()
    .from(providerApiKeys)
    .where(eq(providerApiKeys.providerId, provider[0].id))
    .limit(1);

  if (!apiKey.length || !apiKey[0].keyValue) {
    throw new Error(`No API key configured for provider ${provider[0].name}`);
  }

  const decryptedKey = await decryptApiKey(apiKey[0].keyValue);

  return {
    id: provider[0].id,
    name: provider[0].name,
    baseUrl: provider[0].baseUrl,
    authHeaderName: provider[0].authHeaderName ?? "Authorization",
    authPrefix: provider[0].authPrefix ?? "Bearer ",
    apiKey: decryptedKey,
  };
}
