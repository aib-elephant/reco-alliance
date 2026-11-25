import { createHash } from "node:crypto";
import { connectDB } from "@/lib/db/mongoose";
import Company from "@/models/Company";
import { MappingConfig } from "@/models/MappingConfig";
import { ImportJob } from "@/models/ImportJob";
import { ImportedRecord } from "@/models/ImportedRecord";
import { ImportedTable } from "@/models/ImportedTable";
import { ImportedTableRow } from "@/models/ImportedTableRow";
import { parseCsvTables } from "@/lib/parsers/csv.parser";
import { parseExcelTables } from "@/lib/parsers/excel.parser";
import type { ParsedTable } from "@/lib/parsers/table-utils";
import { mapRow, validateRequiredFields } from "@/lib/mapping/mapping-engine";
import { normalizeValues } from "@/lib/validation/normalize-values";
import { validateNormalizedRecord } from "@/lib/validation/schema-registry";
import { resolveMapping } from "@/lib/import/mapping-resolver";

/** Bounded batches keep large workbooks from producing huge MongoDB bulk writes. */
async function writeInBatches(
  model: typeof ImportedTableRow | typeof ImportedRecord,
  operations: any[],
) {
  for (let start = 0; start < operations.length; start += 500) {
    await model.bulkWrite(operations.slice(start, start + 500), {
      ordered: false,
    });
  }
}

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

  const tables: ParsedTable[] =
    extension === "csv"
      ? parseCsvTables(input.buffer, {
          delimiter: mapping.fileRules?.delimiter,
          headerRow: mapping.fileRules?.headerRow,
          dataStartRow: mapping.fileRules?.dataStartRow,
          stopAtLabels: mapping.fileRules?.stopAtLabels,
        })
      : await parseExcelTables(input.buffer, {
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
        { new: true },
      )
    : await ImportJob.create(jobData);
  if (!job) throw new Error("Import job does not exist");

  let totalRows = 0;
  let successfulRows = 0;
  let failedRows = 0;
  let savedTableRows = 0;
  const errors: { rowNumber: number; message: string; field?: string }[] = [];

  // Persist only the first source table. Its totals remain as raw source rows,
  // while only invoice detail rows become canonical ImportedRecord documents.
  if (tables.length !== 1) {
    throw new Error("Parser must return exactly the first source table");
  }
  const mappedSheet =
    mapping.fileRules?.sheetName ??
    (extension === "csv" ? "CSV" : tables[0]?.sheetName);
  const mappedHeaderRow = mapping.fileRules?.headerRow ?? 1;
  const mappedTable = tables.find(
    (table) =>
      table.sheetName === mappedSheet && table.headerRow === mappedHeaderRow,
  );
  if (!mappedTable)
    throw new Error("Could not find the table matching the approved mapping");

  for (const table of tables) {
    const stored = await ImportedTable.findOneAndUpdate(
      {
        importJobId: job._id,
        sheetName: table.sheetName,
        tableIndex: table.tableIndex,
      },
      {
        $set: {
          companyId: company._id,
          documentType: input.documentType.toLowerCase(),
          headerRow: table.headerRow,
          headers: table.headers,
          rowCount: table.rows.length,
        },
      },
      { new: true, upsert: true },
    );

    const rawOperations = table.rows.map((row) => ({
      updateOne: {
        filter: {
          importJobId: job._id,
          sheetName: table.sheetName,
          tableIndex: table.tableIndex,
          rowNumber: row.rowNumber,
        },
        update: {
          $set: {
            companyId: company._id,
            tableId: stored._id,
            rowType: row.rowType,
            rawData: row.rawData,
          },
        },
        upsert: true,
      },
    }));
    await writeInBatches(ImportedTableRow, rawOperations);
    savedTableRows += rawOperations.length;

    if (table !== mappedTable) continue;

    const normalizedOperations: any[] = [];
    for (const row of table.rows) {
      if (row.rowType !== "detail") continue;
      totalRows++;
      try {
        const mapped = normalizeValues(mapRow(row.effectiveData, mappings));
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
          {
            mappedFields: Object.keys(mappings),
          },
        );
        normalizedOperations.push({
          updateOne: {
            filter: {
              importJobId: job._id,
              "source.sheetName": table.sheetName,
              "source.tableIndex": table.tableIndex,
              "source.rowNumber": row.rowNumber,
            },
            update: {
              $set: {
                companyId: company._id,
                documentType: input.documentType.toLowerCase(),
                normalizedData,
                rawData: row.rawData,
                mappingVersion: mapping.version,
                source: {
                  providerMessageId: input.source?.providerMessageId,
                  attachmentName: input.fileName,
                  sheetName: table.sheetName,
                  tableIndex: table.tableIndex,
                  rowNumber: row.rowNumber,
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
          rowNumber: row.rowNumber,
          message: error instanceof Error ? error.message : "Invalid row",
        });
      }
    }
    await writeInBatches(ImportedRecord, normalizedOperations);
    successfulRows += normalizedOperations.length;
  }

  const status =
    failedRows === 0 && totalRows > 0
      ? "completed"
      : successfulRows > 0
        ? "partially_completed"
        : "failed";

  await ImportJob.findByIdAndUpdate(job._id, {
    tableCount: tables.length,
    savedTableRows,
    totalRows,
    successfulRows,
    failedRows,
    errors: errors.slice(0, 500),
    status,
    completedAt: new Date(),
  });

  return {
    importId: job._id.toString(),
    companyId: company._id.toString(),
    documentType: input.documentType,
    tableCount: tables.length,
    savedTableRows,
    totalRows,
    successfulRows,
    failedRows,
    status,
    errors: errors.slice(0, 100),
  };
}
