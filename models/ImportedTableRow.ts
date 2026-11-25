import { Schema, model, models } from "mongoose";

const ImportedTableRowSchema = new Schema(
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
    tableId: {
      type: Schema.Types.ObjectId,
      ref: "ImportedTable",
      required: true,
      index: true,
    },
    sheetName: { type: String, required: true },
    tableIndex: { type: Number, required: true },
    rowNumber: { type: Number, required: true },
    rowType: {
      type: String,
      enum: ["detail", "subtotal", "grand_total"],
      required: true,
    },
    rawData: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);
ImportedTableRowSchema.index(
  { importJobId: 1, sheetName: 1, tableIndex: 1, rowNumber: 1 },
  { unique: true },
);
export const ImportedTableRow =
  models.ImportedTableRow || model("ImportedTableRow", ImportedTableRowSchema);
