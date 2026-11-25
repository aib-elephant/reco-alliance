import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { MappingConfig } from "@/models/MappingConfig";
import { normalizeHeader } from "./format-detector";

export async function approveMapping(input: {
  companyId: string;
  mappingId: string;
  columnMappings: Record<string, string[]>;
  requiredFields: string[];
  stopAtLabels?: string[];
}) {
  await connectDB();

  if (
    !Types.ObjectId.isValid(input.companyId) ||
    !Types.ObjectId.isValid(input.mappingId)
  ) {
    throw new Error("Invalid mapping or company ID");
  }

  const mapping = await MappingConfig.findOne({
    _id: input.mappingId,
    companyId: input.companyId,
    status: "draft",
  });

  if (!mapping) {
    throw new Error("Draft mapping not found");
  }

  const detected = new Set(mapping.detectedHeaders.map(normalizeHeader));

  for (const [field, aliases] of Object.entries(input.columnMappings)) {
    if (!field.trim() || aliases.length === 0) {
      throw new Error(`Invalid mapping for ${field}`);
    }

    if (!aliases.some((alias) => detected.has(normalizeHeader(alias)))) {
      throw new Error(`No source column found for ${field}`);
    }
  }

  for (const required of input.requiredFields) {
    if (!input.columnMappings[required]?.length) {
      throw new Error(`Missing required mapping: ${required}`);
    }
  }

  mapping.columnMappings = new Map(Object.entries(input.columnMappings));
  mapping.requiredFields = input.requiredFields;
  mapping.fileRules.stopAtLabels = input.stopAtLabels ?? [];

  // Approval must be serialized per company/document type/
  // fingerprint in production to avoid concurrent approvals.
  await MappingConfig.updateMany(
    {
      companyId: mapping.companyId,
      documentType: mapping.documentType,
      format: mapping.format,
      formatFingerprint: mapping.formatFingerprint,
      status: "active",
      _id: { $ne: mapping._id },
    },
    { $set: { status: "archived" } },
  );

  mapping.status = "active";
  await mapping.save();

  return {
    mappingId: String(mapping._id),
    status: mapping.status,
    version: mapping.version,
  };
}
