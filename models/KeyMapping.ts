import { Schema, model, models } from "mongoose";

const MappedKeySchema = new Schema(
  {
    source_field: { type: String, required: true },
    mapped_columns: { type: [String], required: true },
    deleted_keys: [String],
  },
  { timestamps: true },
);

export const MappedKey =
  models.MappedKey || model("MappedKey", MappedKeySchema);
