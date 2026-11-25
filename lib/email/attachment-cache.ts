import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { EmailAttachmentCache } from "@/models/EmailAttachmentCache";
import { assertAttachmentSize } from "./attachment.service";
import { decryptAttachment, encryptAttachment } from "./crypto";

const CACHE_DAYS = 30;

/** Keep the original attachment in MongoDB, encrypted, while approval is pending. */
export async function saveAttachmentForRetry(
  importJobId: string,
  buffer: Buffer,
): Promise<void> {
  if (!Types.ObjectId.isValid(importJobId)) throw new Error("Invalid import ID");
  assertAttachmentSize(buffer);
  const encrypted = encryptAttachment(buffer);
  await EmailAttachmentCache.updateOne(
    { importJobId: new Types.ObjectId(importJobId) },
    {
      $setOnInsert: {
        ...encrypted,
        byteLength: buffer.length,
        sha256: createHash("sha256").update(buffer).digest("hex"),
        expiresAt: new Date(Date.now() + CACHE_DAYS * 24 * 60 * 60_000),
      },
    },
    { upsert: true },
  );
}

export async function readAttachmentForRetry(
  importJobId: string,
): Promise<Buffer | null> {
  if (!Types.ObjectId.isValid(importJobId)) throw new Error("Invalid import ID");
  const cached = await EmailAttachmentCache.findOne({
    importJobId: new Types.ObjectId(importJobId),
    expiresAt: { $gt: new Date() },
  }).select("+iv +authTag +ciphertext");
  if (!cached) return null;
  const buffer = decryptAttachment({
    iv: cached.iv,
    authTag: cached.authTag,
    ciphertext: cached.ciphertext,
  });
  assertAttachmentSize(buffer);
  const digest = createHash("sha256").update(buffer).digest("hex");
  if (buffer.length !== cached.byteLength || digest !== cached.sha256) {
    throw new Error("Cached attachment failed integrity verification");
  }
  return buffer;
}

export async function clearAttachmentForRetry(importJobId: string): Promise<void> {
  if (!Types.ObjectId.isValid(importJobId)) throw new Error("Invalid import ID");
  await EmailAttachmentCache.deleteOne({ importJobId: new Types.ObjectId(importJobId) });
}
