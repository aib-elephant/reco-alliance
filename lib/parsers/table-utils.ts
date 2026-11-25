/** Helpers for importing the FIRST report table only, including its totals. */
export type SourceRowType = "detail" | "subtotal" | "grand_total";

export type SourceTableRow = {
  rowNumber: number; // Physical worksheet / CSV row number
  rowType: SourceRowType;
  rawData: Record<string, unknown>; // Never filled or modified
  effectiveData: Record<string, unknown>; // Identifiers carried down for mapping
};

export type ParsedTable = {
  sheetName: string;
  tableIndex: number;
  headerRow: number;
  headers: string[];
  rows: SourceTableRow[];
};

export function isPresent(value: unknown): boolean {
  return value !== null && value !== undefined &&
    (typeof value !== "string" || value.trim() !== "");
}

export function sourceRowType(
  values: unknown[],
  stopAtLabels: string[] = [],
): SourceRowType {
  const populated = values.filter(isPresent).map((value) => String(value).trim());
  const first = populated[0]?.toLowerCase() ?? "";
  if (/^grand\s+total\b/.test(first)) return "grand_total";
  if (/\b(?:sub\s*total|total)\s*:?$/i.test(first)) return "subtotal";
  const stop = new Set(stopAtLabels.map((label) => label.trim().toLowerCase()));
  if (populated.some((value) => stop.has(value.toLowerCase()))) return "subtotal";
  return "detail";
}

const HEADER_WORDS = /\b(?:invoice|number|date|amount|taxable|cgst|sgst|igst|input|rcm|premium|brokerage|policy|insured|office|code|endorsement|percentage|name|type|expiry|inception|total|gstin)\b/i;

/** A different header signals the beginning of a second table; don't import it. */
export function looksLikeTableHeader(values: unknown[], currentHeaders: string[]): boolean {
  const nonempty = values.filter(isPresent);
  if (nonempty.length < 3) return false;
  if (!nonempty.every((value) => typeof value === "string" && /[a-z]/i.test(value))) {
    return false;
  }
  const labels = nonempty.map((value) => String(value).trim());
  if (new Set(labels.map((value) => value.toLowerCase())).size !== labels.length) {
    return false;
  }
  const current = new Set(currentHeaders.map((value) => value.trim().toLowerCase()));
  if (labels.every((label) => current.has(label.toLowerCase()))) {
    return true; // Repeated page header; avoid importing it as an invoice.
  }
  const matches = labels.filter((label) => HEADER_WORDS.test(label)).length;
  return matches >= 3 && matches / labels.length >= 0.65;
}

/** Invoice lines often omit invoice number/date/office after the first line. */
const CARRY_DOWN = new Set(["invoicenumber", "invoicedate", "officecode"]);
function normalizedKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Store the complete FIRST table, including subtotal and grand-total rows.
 * Never stop on intermediate subtotals, and never read the subsequent table.
 * Totals are retained in rawData, but callers must map only detail rows.
 */
export function buildFirstTable(
  sheetName: string,
  headerRow: number,
  headers: string[],
  rows: Array<{ rowNumber: number; values: unknown[] }>,
  stopAtLabels: string[] = [],
): ParsedTable {
  const table: ParsedTable = { sheetName, tableIndex: 0, headerRow, headers, rows: [] };
  const carried = new Map<string, unknown>();

  for (const source of rows) {
    const values = source.values;
    if (!values.some(isPresent)) continue;

    // The next table can start without a Grand Total row.
    if (looksLikeTableHeader(values, headers)) break;

    // Ignore isolated page numbers/report section labels.
    const populated = values.filter(isPresent);
    if (populated.length === 1 &&
        !/\b(?:total|subtotal)\b/i.test(String(populated[0]))) continue;

    const rawData: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      if (header) rawData[header] = values[index] ?? null;
    });

    const rowType = sourceRowType(values, stopAtLabels);
    const effectiveData = { ...rawData };
    if (rowType === "detail") {
      headers.forEach((header) => {
        if (!header || !CARRY_DOWN.has(normalizedKey(header))) return;
        if (isPresent(effectiveData[header])) {
          carried.set(header, effectiveData[header]);
        } else if (carried.has(header)) {
          effectiveData[header] = carried.get(header);
        }
      });
    } else {
      carried.clear(); // New invoice group starts after a subtotal.
    }

    table.rows.push({ rowNumber: source.rowNumber, rowType, rawData, effectiveData });

    // Include the grand total in the saved table, then stop before table 2.
    if (rowType === "grand_total") break;
  }

  return table;
}
