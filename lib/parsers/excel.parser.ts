import ExcelJS from "exceljs";

export type ParsedSheet = {
  sheetName: string;
  rows: Record<string, unknown>[];
};

function cellValue(value: ExcelJS.CellValue): unknown {
  if (value && typeof value === "object") {
    if ("result" in value) return value.result;
    if ("text" in value) return value.text;
    if ("richText" in value) {
      return value.richText.map((part) => part.text).join("");
    }
  }
  return value;
}

export async function parseExcel(
  buffer: Buffer,
  options: {
    headerRow?: number;
    dataStartRow?: number;
    sheetName?: string;
    stopAtLabels?: string[];
  } = {},
): Promise<ParsedSheet[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );

  const headerRowNumber = options.headerRow ?? 1;

  const dataStartRow = options.dataStartRow ?? headerRowNumber + 1;

  const sheets = options.sheetName
    ? workbook.worksheets.filter((sheet) => sheet.name === options.sheetName)
    : workbook.worksheets;

  if (options.sheetName && sheets.length === 0) {
    throw new Error(`Worksheet "${options.sheetName}" was not found`);
  }

  return sheets.map((sheet) => {
    const headerRow = sheet.getRow(headerRowNumber);
    const headers: string[] = [];

    for (let col = 1; col <= headerRow.cellCount; col++) {
      headers.push(
        String(cellValue(headerRow.getCell(col).value) ?? "").trim(),
      );
    }

    if (!headers.some(Boolean)) {
      throw new Error(
        `No headers found in "${sheet.name}" row ${headerRowNumber}`,
      );
    }

    const rows: Record<string, unknown>[] = [];

    for (
      let rowNumber = dataStartRow;
      rowNumber <= sheet.rowCount;
      rowNumber++
    ) {
      const row = sheet.getRow(rowNumber);

      const values = headers.map((header, index) =>
        header ? cellValue(row.getCell(index + 1).value) : undefined,
      );

      const firstNonEmpty = values.find(
        (value) =>
          value !== null && value !== undefined && String(value).trim() !== "",
      );

      if (firstNonEmpty === undefined) continue;

      const stopLabels = options.stopAtLabels ?? [];

      const shouldStop = values.some((value) =>
        stopLabels.some(
          (label) =>
            String(value ?? "")
              .trim()
              .toLowerCase() === label.trim().toLowerCase(),
        ),
      );

      if (shouldStop) break;

      const record: Record<string, unknown> = {};

      headers.forEach((header, index) => {
        if (header) {
          record[header] = values[index];
        }
      });

      rows.push(record);
    }

    // sheet.eachRow((row, rowNumber) => {

    //   if (rowNumber <= headerRowNumber) return;

    //   const record: Record<string, unknown> = {};

    //   headers.forEach((header, index) => {
    //     if (header) record[header] = cellValue(row.getCell(index + 1).value);
    //   });

    //   if (
    //     Object.values(record).some(
    //       (value) => value !== null && value !== undefined && value !== "",
    //     )
    //   ) {
    //     rows.push(record);
    //   }
    // });

    return { sheetName: sheet.name, rows };
  });
}
