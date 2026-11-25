import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

function encryptionKey(): Buffer {
  const value = process.env.MAILBOX_ENCRYPTION_KEY;
  if (!value) throw new Error("MAILBOX_ENCRYPTION_KEY must be configured");
  const key = /^[0-9a-f]{64}$/i.test(value)
    ? Buffer.from(value, "hex")
    : Buffer.from(value, "base64");
  if (key.length !== 32) {
    throw new Error("MAILBOX_ENCRYPTION_KEY must be 32 bytes (hex or base64)");
  }
  return key;
}

export function encryptCredentials(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptCredentials<T>(value: string): T {
  const [version, iv, tag, ciphertext, extra] = value.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext || extra) {
    throw new Error("Invalid encrypted credentials");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8")) as T;
}


/** Encrypt spreadsheet bytes separately from OAuth credentials (AES-256-GCM). */
export function encryptAttachment(buffer: Buffer): {
  iv: Buffer;
  authTag: Buffer;
  ciphertext: Buffer;
} {
  const iv = randomBytes(12);
  const key = Buffer.from(hkdfSync("sha256", encryptionKey(), "drs-email-attachments", "v1", 32));
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return { iv, authTag: cipher.getAuthTag(), ciphertext };
}

export function decryptAttachment(value: {
  iv: Buffer;
  authTag: Buffer;
  ciphertext: Buffer;
}): Buffer {
  const key = Buffer.from(hkdfSync("sha256", encryptionKey(), "drs-email-attachments", "v1", 32));
  const decipher = createDecipheriv("aes-256-gcm", key, value.iv);
  decipher.setAuthTag(value.authTag);
  return Buffer.concat([decipher.update(value.ciphertext), decipher.final()]);
}
