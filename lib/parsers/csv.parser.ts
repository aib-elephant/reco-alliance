import { parse } from "csv-parse/sync";

export function parseCsv(buffer: Buffer, options: { delimiter?: string; headerRow?: number; dataStartRow?: number; stopAtLabels?: string[] } = {}) {
  const rows = parse(buffer.toString("utf8"), {
    bom: true, delimiter: options.delimiter ?? ",", skip_empty_lines: false,
    relax_column_count: true, relax_quotes: true,
  }) as string[][];
  const headerIndex = (options.headerRow ?? 1) - 1;
  const headers = (rows[headerIndex] ?? []).map(v => String(v ?? "").trim());
  if (!headers.some(Boolean)) throw new Error("CSV header row is empty");
  const stop = new Set((options.stopAtLabels ?? []).map(x => x.trim().toLowerCase()));
  const output: Record<string, unknown>[] = [];
  for (let i = (options.dataStartRow ?? headerIndex + 2) - 1; i < rows.length; i++) {
    const values = rows[i] ?? [];
    if (values.some(x => stop.has(String(x ?? "").trim().toLowerCase()))) break;
    if (!values.some(x => String(x ?? "").trim())) continue;
    const record: Record<string, unknown> = {};
    headers.forEach((header, index) => { if (header) record[header] = String(values[index] ?? "").trim(); });
    output.push(record);
  }
  return output;
}
