import ExcelJS from "exceljs";
import { buildFirstTable, type ParsedTable } from "./table-utils";

function cellValue(value: ExcelJS.CellValue): unknown {
  if (value && typeof value === "object" && !(value instanceof Date)) {
    if ("result" in value) return cellValue(value.result as ExcelJS.CellValue);
    if ("text" in value) return value.text;
    if ("richText" in value)
      return value.richText.map((part) => part.text).join("");
  }
  return value;
}

/**
 * Read only the FIRST report table on the selected worksheet. Existing mappings
 * supply the correct header row (8 for new_india_invoice.xlsx). Other worksheets,
 * second table headers and tax-summary rows are never imported.
 */
export async function parseExcelTables(
  buffer: Buffer,
  options: {
    headerRow?: number;
    dataStartRow?: number;
    sheetName?: string;
    stopAtLabels?: string[];
  } = {},
): Promise<ParsedTable[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );

  const sheet = options.sheetName
    ? workbook.getWorksheet(options.sheetName)
    : workbook.worksheets[0];
  if (!sheet)
    throw new Error(
      `Worksheet "${options.sheetName ?? "first"}" was not found`,
    );

  const headerRowNumber = options.headerRow ?? 1;
  const dataStartRow = options.dataStartRow ?? headerRowNumber + 1;
  const header = sheet.getRow(headerRowNumber);
  const headers = Array.from({ length: header.cellCount }, (_, index) =>
    String(cellValue(header.getCell(index + 1).value) ?? "").trim(),
  );
  if (!headers.some(Boolean)) {
    throw new Error(
      `No headers found in "${sheet.name}" row ${headerRowNumber}`,
    );
  }

  const rows: Array<{ rowNumber: number; values: unknown[] }> = [];
  for (let rowNumber = dataStartRow; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const values = Array.from(
      { length: Math.max(headers.length, row.cellCount) },
      (_, index) => cellValue(row.getCell(index + 1).value),
    );
    rows.push({ rowNumber, values });
  }
  return [
    buildFirstTable(
      sheet.name,
      headerRowNumber,
      headers,
      rows,
      options.stopAtLabels,
    ),
  ];
}

// Backward-compatible export used by existing imports.
export const parseExcel = parseExcelTables;
