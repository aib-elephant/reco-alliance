import { createHash } from "node:crypto";
import { connectDB } from "@/lib/db/mongoose";
import Company from "@/models/Company";
import { MappingConfig } from "@/models/MappingConfig";
import { ImportJob } from "@/models/ImportJob";
import { ImportedRecord } from "@/models/ImportedRecord";
import { parseCsv } from "@/lib/parsers/csv.parser";
import { parseExcel } from "@/lib/parsers/excel.parser";
import { mapRow, validateRequiredFields } from "@/lib/mapping/mapping-engine";
import { normalizeValues } from "@/lib/validation/normalize-values";
import { validateNormalizedRecord } from "@/lib/validation/schema-registry";
import { resolveMapping } from "@/lib/import/mapping-resolver";

export async function processBufferImport(input: {
  companyId: string;
  documentType: string;
  fileName: string;
  buffer: Buffer;
  source?: {
    importJobId: string;
    processedEmailId: string;
    provider: "gmail" | "microsoft";
    mailboxAddress: string;
    providerMessageId: string;
    attachmentId: string;
  };
}) {
  await connectDB();

  const company = await Company.findOne({
    _id: input.companyId,
    status: "active",
  }).lean();
  if (!company) throw new Error("Active company was not found");

  const extension = input.fileName.toLowerCase().split(".").pop();
  if (!["csv", "xlsx"].includes(extension ?? "")) {
    throw new Error("Only .csv and .xlsx files are supported");
  }

  const decision = await resolveMapping({
    companyId: input.companyId,
    documentType: input.documentType,
    fileName: input.fileName,
    buffer: input.buffer,
  });

  if (decision.action === "review_required") {
    if (input.source) {
      await ImportJob.findByIdAndUpdate(input.source.importJobId, {
        status: "needs_review",
        mappingConfigId: decision.mappingId,
        completedAt: new Date(),
      });
    }
    return {
      status: "mapping_review_required" as const,
      mappingId: decision.mappingId,
      detectedFormat: decision.detected,
      suggestedMappings: decision.suggestions,
      importedRows: 0,
    };
  }

  const mapping = await MappingConfig.findOne({
    _id: decision.mappingId,
    companyId: company._id,
    status: "active",
  });

  if (!mapping) throw new Error("Approved mapping is no longer available");

  const mappings =
    mapping.columnMappings instanceof Map
      ? Object.fromEntries(mapping.columnMappings)
      : (mapping.columnMappings as Record<string, string[]>);

  const sheets =
    extension === "csv"
      ? [
          {
            sheetName: undefined,
            rows: parseCsv(input.buffer, {
              delimiter: mapping.fileRules?.delimiter,
              headerRow: mapping.fileRules?.headerRow,
              dataStartRow: mapping.fileRules?.dataStartRow,
              stopAtLabels: mapping.fileRules?.stopAtLabels,
            }),
          },
        ]
      : await parseExcel(input.buffer, {
          headerRow: mapping.fileRules?.headerRow ?? 1,
          sheetName: mapping.fileRules?.sheetName,
          dataStartRow: mapping.fileRules?.dataStartRow,
          stopAtLabels: mapping.fileRules?.stopAtLabels,
        });

  const jobData = {
    companyId: company._id,
    provider: input.source?.provider ?? "manual",
    processedEmailId: input.source?.processedEmailId,
    mailboxAddress: input.source?.mailboxAddress,
    providerMessageId: input.source?.providerMessageId,
    attachmentId: input.source?.attachmentId,
    attachmentName: input.fileName,
    attachmentSha256: createHash("sha256").update(input.buffer).digest("hex"),
    documentType: input.documentType.toLowerCase(),
    mappingConfigId: mapping._id,
    mappingVersion: mapping.version,
    status: "processing",
    startedAt: new Date(),
  };
  const job = input.source
    ? await ImportJob.findByIdAndUpdate(
        input.source.importJobId,
        { $set: jobData },
        { returnDocument: "after" },
      )
    : await ImportJob.create(jobData);
  if (!job) throw new Error("Import job does not exist");

  let totalRows = 0;
  let successfulRows = 0;
  let failedRows = 0;
  const errors: { rowNumber: number; message: string; field?: string }[] = [];

  for (const sheet of sheets) {
    const operations = [];

    for (let index = 0; index < sheet.rows.length; index++) {
      totalRows++;
      const rowNumber = index + (mapping.fileRules?.dataStartRow ?? 2);
      try {
        const mapped = normalizeValues(mapRow(sheet.rows[index], mappings));
        const missing = validateRequiredFields(
          mapped,
          mapping.requiredFields ?? [],
        );
        if (missing.length) {
          throw new Error(`Missing required fields: ${missing.join(", ")}`);
        }

        const normalizedData = validateNormalizedRecord(
          input.documentType,
          mapped,
        );
        operations.push({
          updateOne: {
            filter: {
              importJobId: job._id,
              "source.sheetName": sheet.sheetName,
              "source.rowNumber": rowNumber,
            },
            update: {
              $set: {
                companyId: company._id,
                documentType: input.documentType.toLowerCase(),
                normalizedData,
                mappingVersion: mapping.version,
                source: {
                  providerMessageId: input.source?.providerMessageId,
                  attachmentName: input.fileName,
                  sheetName: sheet.sheetName,
                  rowNumber,
                  attachmentSha256: job.attachmentSha256,
                },
              },
            },
            upsert: true,
          },
        });
      } catch (error) {
        failedRows++;
        errors.push({
          rowNumber,
          message: error instanceof Error ? error.message : "Invalid row",
        });
      }
    }

    if (operations.length) {
      await ImportedRecord.bulkWrite(operations, { ordered: false });
      successfulRows += operations.length;
    }
  }

  const status =
    failedRows === 0
      ? "completed"
      : successfulRows > 0
        ? "partially_completed"
        : "failed";

  await ImportJob.findByIdAndUpdate(job._id, {
    totalRows,
    successfulRows,
    failedRows,
    importErrors: errors.slice(0, 500),
    status,
    completedAt: new Date(),
  });

  return {
    importId: job._id.toString(),
    companyId: company._id.toString(),
    documentType: input.documentType,
    totalRows,
    successfulRows,
    failedRows,
    status,
    importErrors: errors.slice(0, 100),
  };
}
