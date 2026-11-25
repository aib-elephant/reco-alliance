import { Schema, model, models } from "mongoose";

const ProcessedEmailSchema = new Schema(
  {
    provider: { type: String, enum: ["gmail", "microsoft"], required: true },
    mailboxAddress: { type: String, required: true, lowercase: true },
    providerMessageId: { type: String, required: true },
    receivedAt: Date,
    sender: String,
    subject: String,
    status: {
      type: String,
      enum: ["discovered", "processing", "completed", "needs_review", "failed"],
      default: "discovered",
    },
    companyId: { type: Schema.Types.ObjectId, ref: "Company" },
    importJobIds: [{ type: Schema.Types.ObjectId, ref: "ImportJob" }],
    lastError: String,
  },
  { timestamps: true }
);

ProcessedEmailSchema.index(
  { provider: 1, mailboxAddress: 1, providerMessageId: 1 },
  { unique: true }
);

export const ProcessedEmail =
  models.ProcessedEmail || model("ProcessedEmail", ProcessedEmailSchema);
