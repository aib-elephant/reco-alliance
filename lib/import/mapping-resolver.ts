import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { MappingConfig } from "@/models/MappingConfig";
import { detectFileFormat, normalizeHeader } from "./format-detector";
import { CANONICAL_FIELDS } from "./canonical-fields";

type MappingDecision =
  | {
      action: "reuse";
      mappingId: string;
      version: number;
      detected: Awaited<ReturnType<typeof detectFileFormat>>;
    }
  | {
      action: "review_required";
      mappingId: string;
      suggestions: Record<string, string[]>;
      detected: Awaited<ReturnType<typeof detectFileFormat>>;
    };

function suggestMappings(
  headers: string[],
  existingMappings: Array<{
    columnMappings: Map<string, string[]> | Record<string, string[]>;
  }>,
): Record<string, string[]> {
  const suggestions: Record<string, string[]> = {};

  for (const mapping of existingMappings) {
    const entries =
      mapping.columnMappings instanceof Map
        ? [...mapping.columnMappings.entries()]
        : Object.entries(mapping.columnMappings ?? {});

    for (const [canonicalField, aliases] of entries) {
      for (const header of headers) {
        const normalized = normalizeHeader(header);

        if (
          Array.isArray(aliases) &&
          aliases.some((alias) => normalizeHeader(alias) === normalized)
        ) {
          suggestions[canonicalField] ??= [];

          if (!suggestions[canonicalField].includes(header)) {
            suggestions[canonicalField].push(header);
          }
        }
      }
    }
  }

  // Offer sensible first-run suggestions; approval remains a human decision.
  const used = new Set(Object.values(suggestions).flat().map(normalizeHeader));
  for (const field of CANONICAL_FIELDS) {
    if (suggestions[field.key]?.length) continue;
    const match = headers.find(
      (h) =>
        normalizeHeader(h) === normalizeHeader(field.key) &&
        !used.has(normalizeHeader(h)),
    );
    if (match) {
      suggestions[field.key] = [match];
      used.add(normalizeHeader(match));
    }
  }
  return suggestions;
}

export async function resolveMapping(input: {
  companyId: string;
  documentType: string;
  fileName: string;
  buffer: Buffer;
}): Promise<MappingDecision> {
  await connectDB();

  if (!Types.ObjectId.isValid(input.companyId)) {
    throw new Error("Invalid companyId");
  }

  const companyId = new Types.ObjectId(input.companyId);
  const documentType = input.documentType.trim().toLowerCase();

  const previousMappings = await MappingConfig.find({
    companyId,
    documentType,
    status: "active",
  })
    .sort({ version: -1 })
    .lean();

  const preferredHeaders = previousMappings.flatMap((mapping) => {
    const mappings = mapping.columnMappings ?? {};
    const entries =
      mappings instanceof Map
        ? [...mappings.values()]
        : Object.values(mappings);

    return entries.flat() as string[];
  });

  const detected = await detectFileFormat({
    fileName: input.fileName,
    buffer: input.buffer,
    preferredHeaders,
  });

  const matching = await MappingConfig.findOne({
    companyId,
    documentType,
    format: detected.format,
    formatFingerprint: detected.fingerprint,
    status: "active",
  }).sort({ version: -1 });

  if (matching) {
    return {
      action: "reuse",
      mappingId: String(matching._id),
      version: matching.version,
      detected,
    };
  }

  const existingDraft = await MappingConfig.findOne({
    companyId,
    documentType,
    format: detected.format,
    formatFingerprint: detected.fingerprint,
    status: "draft",
  }).sort({ version: -1 });

  if (existingDraft) {
    return {
      action: "review_required",
      mappingId: String(existingDraft._id),
      suggestions: Object.fromEntries(
        existingDraft.columnMappings ?? new Map(),
      ),
      detected,
    };
  }

  const suggestions = suggestMappings(detected.headers, previousMappings);

  // Allocate a version for this company/document type.
  // Production deployments should serialize this operation
  // or retry on the unique-index conflict.
  const latest = await MappingConfig.findOne({
    companyId,
    documentType,
  })
    .sort({ version: -1 })
    .select("version")
    .lean();

  const draft = await MappingConfig.create({
    companyId,
    documentType,
    version: (latest?.version ?? 0) + 1,
    status: "draft",
    format: detected.format,
    formatFingerprint: detected.fingerprint,
    detectedHeaders: detected.headers,
    fileRules: {
      headerRow: detected.headerRow,
      dataStartRow: detected.dataStartRow,
      sheetName: detected.sheetName,
      delimiter: detected.delimiter,
      ignoreEmptyRows: true,
    },
    columnMappings: suggestions,
    requiredFields:
      previousMappings[0]?.requiredFields ??
      (documentType === "invoice"
        ? [
            "Policy Number",
            "Share Premium",
            "Co-Insurer: Total Brokerage",
            "Total Brokerage",
          ]
        : []),
  });

  return {
    action: "review_required",
    mappingId: String(draft._id),
    suggestions,
    detected,
  };
}
