import { Schema, model, models } from "mongoose";

const ImportJobSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", index: true },
    processedEmailId: { type: Schema.Types.ObjectId, ref: "ProcessedEmail" },
    provider: {
      type: String,
      enum: ["gmail", "microsoft", "manual"],
      required: true,
    },
    mailboxAddress: String,
    providerMessageId: String,
    attachmentId: String,
    attachmentName: { type: String, required: true },
    attachmentSha256: String,
    documentType: { type: String, required: true },
    mappingConfigId: { type: Schema.Types.ObjectId, ref: "MappingConfig" },
    mappingVersion: Number,
    status: {
      type: String,
      enum: [
        "queued",
        "processing",
        "completed",
        "partially_completed",
        "needs_review",
        "failed",
      ],
      default: "queued",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    totalRows: { type: Number, default: 0 },
    successfulRows: { type: Number, default: 0 },
    failedRows: { type: Number, default: 0 },
    importErrors: [
      {
        rowNumber: Number,
        message: String,
        field: String,
      },
    ],
    startedAt: Date,
    completedAt: Date,
  },
  { timestamps: true },
);

ImportJobSchema.index(
  { provider: 1, mailboxAddress: 1, providerMessageId: 1, attachmentId: 1 },
  {
    unique: true,
    name: "unique_email_attachment",
    partialFilterExpression: {
      providerMessageId: { $type: "string" },
      attachmentId: { $type: "string" },
    },
  },
);

export const ImportJob =
  models.ImportJob || model("ImportJob", ImportJobSchema);
