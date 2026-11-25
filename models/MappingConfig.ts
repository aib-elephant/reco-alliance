import { Schema, model, models } from "mongoose";

const MappingConfigSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    documentType: { type: String, required: true, lowercase: true, trim: true },
    version: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["draft", "active", "archived"],
      default: "draft",
    },
    formatFingerprint: {
      type: String,
      trim: true,
      index: true,
    },

    format: {
      type: String,
      enum: ["csv", "xlsx"],
    },

    detectedHeaders: {
      type: [String],
      default: [],
    },
    fileRules: {
      filenamePatterns: { type: [String], default: [] },
      headerRow: { type: Number, default: 1, min: 1 },
      dataStartRow: { type: Number, default: 2, min: 1 },
      sheetName: String,
      sheetIndex: Number,
      delimiter: String,
      stopAtLabels: {
        type: [String],
        default: [],
      },

      ignoreEmptyRows: {
        type: Boolean,
        default: true,
      },
    },
    columnMappings: {
      type: Map,
      of: [String],
      required: true,
    },
    requiredFields: { type: [String], default: [] },
  },
  { timestamps: true },
);

MappingConfigSchema.index(
  {
    companyId: 1,
    documentType: 1,
    format: 1,
    formatFingerprint: 1,
    status: 1,
    version: 1,
  },
  { unique: true },
);

export const MappingConfig =
  models.MappingConfig || model("MappingConfig", MappingConfigSchema);
