import { Schema, model, models } from "mongoose";

const ImportedRecordSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    importJobId: {
      type: Schema.Types.ObjectId,
      ref: "ImportJob",
      required: true,
      index: true,
    },
    documentType: { type: String, required: true, index: true },
    recordKey: String,
    normalizedData: { type: Schema.Types.Mixed, required: true },
    rawData: { type: Schema.Types.Mixed, required: true },
    source: {
      providerMessageId: String,
      attachmentName: String,
      sheetName: String,
      tableIndex: Number,
      rowNumber: Number,
      attachmentSha256: String,
    },
    mappingVersion: Number,
  },
  { timestamps: true },
);

ImportedRecordSchema.index({ companyId: 1, documentType: 1, createdAt: -1 });

export const ImportedRecord =
  models.ImportedRecord || model("ImportedRecord", ImportedRecordSchema);
