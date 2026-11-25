import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";

import { connectDB } from "@/lib/db/mongoose";
import { MappingConfig } from "@/models/MappingConfig";
import { requireCompanyAdmin } from "@/lib/auth/require-company-admin";
import { CANONICAL_FIELD_KEYS } from "@/lib/import/canonical-fields";
import { normalizeHeader } from "@/lib/import/format-detector";

type RouteContext = {
  params: Promise<{
    companyId: string;
    mappingId: string;
  }>;
};

const ApprovalSchema = z.object({
  columnMappings: z.record(
    z.string(),
    z.array(z.string().trim().min(1)).min(1),
  ),
  requiredFields: z.array(z.string()),
  fileRules: z.object({
    headerRow: z.number().int().min(1),
    dataStartRow: z.number().int().min(2),
    stopAtLabels: z.array(z.string().trim().min(1)),
  }),
});

async function getContext(context: RouteContext) {
  const { companyId, mappingId } = await context.params;

  if (
    !Types.ObjectId.isValid(companyId) ||
    !Types.ObjectId.isValid(mappingId)
  ) {
    return null;
  }

  return { companyId, mappingId };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const ids = await getContext(context);

  if (!ids) {
    return NextResponse.json({ error: "Invalid identifiers" }, { status: 400 });
  }

  if (!(await requireCompanyAdmin(ids.companyId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();

  const mapping = await MappingConfig.findOne({
    _id: ids.mappingId,
    companyId: ids.companyId,
  }).lean();

  if (!mapping) {
    return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: String(mapping._id),
    companyId: String(mapping.companyId),
    documentType: mapping.documentType,
    version: mapping.version,
    status: mapping.status,
    format: mapping.format,
    formatFingerprint: mapping.formatFingerprint,
    detectedHeaders: mapping.detectedHeaders ?? [],
    columnMappings:
      mapping.columnMappings instanceof Map
        ? Object.fromEntries(mapping.columnMappings)
        : (mapping.columnMappings ?? {}),
    requiredFields: mapping.requiredFields ?? [],
    fileRules: mapping.fileRules,
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const ids = await getContext(context);

  if (!ids) {
    return NextResponse.json({ error: "Invalid identifiers" }, { status: 400 });
  }

  if (!(await requireCompanyAdmin(ids.companyId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = ApprovalSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid approval request",
        details: z.flattenError(parsed.error),
      },
      { status: 400 },
    );
  }

  await connectDB();

  const mapping = await MappingConfig.findOne({
    _id: ids.mappingId,
    companyId: ids.companyId,
    status: "draft",
  });

  if (!mapping) {
    return NextResponse.json(
      { error: "Draft mapping not found" },
      { status: 404 },
    );
  }

  const input = parsed.data;
  const allowedFields = new Set<string>(CANONICAL_FIELD_KEYS);
  const availableHeaders = new Set(
    (mapping.detectedHeaders ?? []).map(normalizeHeader),
  );

  const selectedSources = new Set<string>();

  for (const [canonical, sources] of Object.entries(input.columnMappings)) {
    if (!allowedFields.has(canonical)) {
      return NextResponse.json(
        { error: `Unsupported canonical field: ${canonical}` },
        { status: 400 },
      );
    }

    if (sources.length !== 1) {
      return NextResponse.json(
        { error: `Select one source for ${canonical}` },
        { status: 400 },
      );
    }

    const source = normalizeHeader(sources[0]);

    if (!availableHeaders.has(source)) {
      return NextResponse.json(
        { error: `Unknown source column: ${sources[0]}` },
        { status: 400 },
      );
    }

    if (selectedSources.has(source)) {
      return NextResponse.json(
        { error: `Duplicate source assignment: ${sources[0]}` },
        { status: 400 },
      );
    }

    selectedSources.add(source);
  }

  // Required fields are defined by the server-side draft,
  // not by values supplied in the approval request.
  const required = mapping.requiredFields ?? [];

  for (const field of required) {
    if (!input.columnMappings[field]?.length) {
      return NextResponse.json(
        { error: `Required field is unmapped: ${field}` },
        { status: 400 },
      );
    }
  }

  if (input.fileRules.dataStartRow <= input.fileRules.headerRow) {
    return NextResponse.json(
      { error: "Data must start after the header row" },
      { status: 400 },
    );
  }

  if (input.fileRules.headerRow !== mapping.fileRules.headerRow) {
    return NextResponse.json(
      {
        error: "Header row changes require re-detection of the format",
      },
      { status: 400 },
    );
  }

  mapping.columnMappings = new Map(Object.entries(input.columnMappings));

  mapping.fileRules.dataStartRow = input.fileRules.dataStartRow;

  mapping.fileRules.stopAtLabels = input.fileRules.stopAtLabels;

  // Archive previous approval for this exact layout.
  // Serialize concurrent approvals in production.
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

  return NextResponse.json({
    mappingId: String(mapping._id),
    status: "active",
    version: mapping.version,
    message: "Mapping approved successfully",
  });
}
