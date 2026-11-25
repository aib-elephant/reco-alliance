import { Schema, model, models } from "mongoose";

const EmailConnectionSchema = new Schema(
  {
    provider: { type: String, enum: ["gmail", "microsoft"], required: true },
    mailboxAddress: { type: String, required: true, lowercase: true, trim: true },
    status: {
      type: String,
      enum: ["active", "reauthorization_required", "disabled"],
      default: "active",
    },
    // Encrypt before saving. Keep this field excluded from normal queries.
    encryptedCredentials: { type: String, required: true, select: false },
    documentType: { type: String, default: "invoice", lowercase: true, trim: true },
    syncCursor: String,
    syncLockUntil: Date,
    subscriptionId: String,
    subscriptionExpiresAt: Date,
    lastSyncedAt: Date,
  },
  { timestamps: true }
);

EmailConnectionSchema.index({ provider: 1, mailboxAddress: 1 }, { unique: true });

export const EmailConnection =
  models.EmailConnection || model("EmailConnection", EmailConnectionSchema);
