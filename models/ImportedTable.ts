import { Schema, model, models } from "mongoose";

const ImportedTableSchema = new Schema(
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
    documentType: { type: String, required: true },
    sheetName: { type: String, required: true },
    tableIndex: { type: Number, required: true },
    headerRow: { type: Number, required: true },
    headers: { type: [String], required: true },
    rowCount: { type: Number, required: true },
  },
  { timestamps: true },
);
ImportedTableSchema.index(
  { importJobId: 1, sheetName: 1, tableIndex: 1 },
  { unique: true },
);
export const ImportedTable =
  models.ImportedTable || model("ImportedTable", ImportedTableSchema);
