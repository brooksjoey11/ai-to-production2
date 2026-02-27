import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  if (!ENCRYPTION_KEY) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ENCRYPTION_KEY environment variable is required in production");
    }
    // Development fallback only
    return Buffer.from("dev-key-change-in-production-000", "utf8");
  }
  const key = ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32);
  return Buffer.from(key, "utf8");
}

export async function encryptApiKey(plaintext: string): Promise<string> {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, tag, encrypted]);
  return combined.toString("base64");
}

export async function decryptApiKey(ciphertext: string): Promise<string> {
  const combined = Buffer.from(ciphertext, "base64");

  const iv = combined.slice(0, 12);
  const tag = combined.slice(12, 28);
  const encrypted = combined.slice(28);

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
