import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

const PLACEHOLDER_KEYS = new Set([
  "change-me-32-byte-hex-key-for-aes256",
  "change-me",
  "dev-encryption-key",
]);

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const key = process.env.ENCRYPTION_KEY;
  const isProd = process.env.NODE_ENV === "production";
  const isPlaceholder = !key || PLACEHOLDER_KEYS.has(key);

  if (isProd && isPlaceholder) {
    throw new Error(
      "ENCRYPTION_KEY must be set to a 64-char hex value (32 bytes) in production. " +
        "Generate one with: openssl rand -hex 32"
    );
  }

  if (isPlaceholder) {
    // Dev/test only — clearly marked.
    cachedKey = crypto.scryptSync("dev-encryption-key-do-not-use-in-prod", "mailtrack-dev", 32);
    return cachedKey;
  }

  // 64-char hex (32 bytes) — use directly. Strongly preferred form.
  if (/^[0-9a-f]{64}$/i.test(key!)) {
    cachedKey = Buffer.from(key!, "hex");
    return cachedKey;
  }

  // Fallback: derive a 32-byte key from a passphrase. In production, require
  // the passphrase to be reasonably long.
  if (isProd && key!.length < 32) {
    throw new Error(
      "ENCRYPTION_KEY passphrase must be at least 32 chars in production, or use a 64-char hex value"
    );
  }
  cachedKey = crypto.scryptSync(key!, "mailtrack-salt", 32);
  return cachedKey;
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();
  // Format: iv:tag:encrypted
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, tagHex, encrypted] = encryptedText.split(":");
  if (!ivHex || !tagHex || !encrypted) {
    throw new Error("Invalid encrypted text format");
  }
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
