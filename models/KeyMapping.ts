import { Schema, model, models } from "mongoose";

const columnSchema = new Schema(
  {
    key: { type: String, required: true },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
  },
  { _id: false },
);

const MappedKeySchema = new Schema(
  {
    source_field: { type: String, required: true },
    mapped_columns: {
      type: [columnSchema],
      default: [],
    },
    deleted_keys: { type: [columnSchema], default: [] },
  },
  { timestamps: true },
);

export const MappedKey =
  models.MappedKey || model("MappedKey", MappedKeySchema);
