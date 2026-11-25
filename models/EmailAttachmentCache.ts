import { Schema, model, models } from "mongoose";

// Temporary encrypted copies let a mapping-review job be retried even when
// the provider changes attachment identifiers or the email is later moved.
// One file is limited to 10 MiB by the attachment service, below MongoDB's
// 16 MiB document limit. TTL is a safety net for abandoned review jobs.
const EmailAttachmentCacheSchema = new Schema(
  {
    importJobId: {
      type: Schema.Types.ObjectId,
      ref: "ImportJob",
      required: true,
      unique: true,
    },
    iv: { type: Buffer, required: true, select: false },
    authTag: { type: Buffer, required: true, select: false },
    ciphertext: { type: Buffer, required: true, select: false },
    byteLength: { type: Number, required: true },
    sha256: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

EmailAttachmentCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailAttachmentCache =
  models.EmailAttachmentCache ||
  model("EmailAttachmentCache", EmailAttachmentCacheSchema);
