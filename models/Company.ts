import { Schema, model, models } from "mongoose";

const CompanySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    status: { type: String, enum: ["active", "disabled"], default: "active" },
    senderEmails: [{ type: String, lowercase: true, trim: true }],
    allowedDomains: [{ type: String, lowercase: true, trim: true }],
  },
  { timestamps: true },
);

const Company = models.Company || model("Company", CompanySchema);

export default Company;
