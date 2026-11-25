import { parse } from "csv-parse/sync";
import { buildFirstTable, type ParsedTable } from "./table-utils";

export function parseCsvTables(
  buffer: Buffer,
  options: {
    delimiter?: string;
    headerRow?: number;
    dataStartRow?: number;
    stopAtLabels?: string[];
  } = {},
): ParsedTable[] {
  const rows = parse(buffer.toString("utf8"), {
    bom: true,
    delimiter: options.delimiter ?? ",",
    skip_empty_lines: false,
    relax_column_count: true,
    relax_quotes: true,
  }) as string[][];
  const headerRow = options.headerRow ?? 1;
  const headers = (rows[headerRow - 1] ?? []).map((value) =>
    String(value ?? "").trim(),
  );
  if (!headers.some(Boolean)) throw new Error("CSV header row is empty");
  const dataStartRow = options.dataStartRow ?? headerRow + 1;
  const sourceRows = rows.slice(dataStartRow - 1).map((values, index) => ({
    rowNumber: dataStartRow + index,
    values,
  }));
  return [
    buildFirstTable(
      "CSV",
      headerRow,
      headers,
      sourceRows,
      options.stopAtLabels,
    ),
  ];
}

/** Backward-compatible flat view of the first CSV table's detail rows. */
export function parseCsv(
  buffer: Buffer,
  options: {
    delimiter?: string;
    headerRow?: number;
    dataStartRow?: number;
    stopAtLabels?: string[];
  } = {},
) {
  return (parseCsvTables(buffer, options)[0]?.rows ?? [])
    .filter((row) => row.rowType === "detail")
    .map((row) => row.effectiveData);
}
