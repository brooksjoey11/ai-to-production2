import { router, adminProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/db";
import { encryptApiKey } from "@/providerService";

export const providersRouter = router({
  getProviders: adminProcedure.query(async () => {
    const providers = await db.query(`
      SELECT p.*, k.last_tested, k.last_test_status, k.last_test_message
      FROM api_providers p
      LEFT JOIN provider_api_keys k ON k.provider_id = p.id AND k.is_active = 1
      ORDER BY p.id DESC
    `);

    return providers;
  }),

  createProvider: adminProcedure
    .input(
      z.object({
        name: z.string(),
        baseUrl: z.string(),
        apiKey: z.string(),
        authType: z.enum(["bearer", "header", "custom"]),
        authHeaderName: z.string(),
        authPrefix: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const [provider] = await db.query(
        `INSERT INTO api_providers (name, base_url, auth_type, auth_header_name, auth_prefix)
         VALUES (?, ?, ?, ?, ?) RETURNING id`,
        [
          input.name,
          input.baseUrl,
          input.authType,
          input.authHeaderName,
          input.authPrefix,
        ]
      );

      const encrypted = await encryptApiKey(input.apiKey);

      await db.query(
        `INSERT INTO provider_api_keys (provider_id, key_value)
         VALUES (?, ?)`,
        [provider.id, encrypted]
      );

      return { success: true };
    }),

  testProvider: adminProcedure
    .input(z.object({ providerId: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const provider = await db.queryOne(
          `SELECT * FROM api_providers WHERE id = ?`,
          [input.providerId]
        );

        const keyRow = await db.queryOne(
          `SELECT * FROM provider_api_keys WHERE provider_id = ? AND is_active = 1`,
          [input.providerId]
        );

        if (!provider || !keyRow) {
          throw new Error("Provider not configured");
        }

        const res = await fetch(`${provider.base_url}/models`, {
          headers: {
            [provider.auth_header_name]:
              provider.auth_prefix + "test-key-placeholder",
          },
        });

        const ok = res.status < 500;

        await db.query(
          `UPDATE provider_api_keys
           SET last_tested = NOW(),
               last_test_status = ?,
               last_test_message = ?
           WHERE provider_id = ?`,
          [
            ok ? "ok" : "failed",
            ok ? "Connection successful" : `HTTP ${res.status}`,
            input.providerId,
          ]
        );

        return {
          success: ok,
          message: ok ? "Connection successful" : `HTTP ${res.status}`,
        };
      } catch (e: any) {
        await db.query(
          `UPDATE provider_api_keys
           SET last_tested = NOW(),
               last_test_status = 'failed',
               last_test_message = ?
           WHERE provider_id = ?`,
          [e.message, input.providerId]
        );

        return {
          success: false,
          message: e.message,
        };
      }
    }),
});
