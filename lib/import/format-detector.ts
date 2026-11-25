import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";

export type DetectedFormat = {
  format: "csv" | "xlsx";
  fingerprint: string;
  sheetName?: string;
  headerRow: number;
  dataStartRow: number;
  delimiter?: string;
  headers: string[];
};

export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function cleanCell(value: unknown): string {
  if (value == null) return "";

  if (typeof value === "object") {
    if ("text" in value) {
      return String(value.text ?? "").trim();
    }

    if ("result" in value) {
      return cleanCell(value.result);
    }

    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText
        .map((part: { text?: string }) => part.text ?? "")
        .join("")
        .trim();
    }
  }

  return String(value).trim();
}

function chooseHeaderRow(
  rows: string[][],
  preferredHeaders: string[] = [],
): { row: number; headers: string[] } {
  const known = new Set(preferredHeaders.map(normalizeHeader));

  let best: { row: number; headers: string[]; score: number } | undefined;

  rows.slice(0, 30).forEach((cells, index) => {
    const headers = cells.map(cleanCell);
    const populated = headers.filter(Boolean);
    const normalized = populated.map(normalizeHeader);

    const uniqueCount = new Set(normalized).size;
    const knownMatches = normalized.filter((h) => known.has(h)).length;

    // Prefer wide, distinctive rows containing known business headers.
    const score =
      knownMatches * 10 +
      uniqueCount * 2 -
      (populated.length - uniqueCount) * 5;

    if (
      populated.length >= 2 &&
      uniqueCount === populated.length &&
      (!best || score > best.score)
    ) {
      best = { row: index + 1, headers, score };
    }
  });

  if (!best) {
    throw new Error("Could not identify a table header row");
  }

  return { row: best.row, headers: best.headers };
}

function makeFingerprint(format: string, headers: string[]): string {
  const normalized = headers.filter(Boolean).map(normalizeHeader);

  if (
    normalized.some((header) => !header) ||
    new Set(normalized).size !== normalized.length
  ) {
    throw new Error("Empty or duplicate normalized column headers");
  }

  // Sorting tolerates column reordering.
  const signature = JSON.stringify({
    algorithm: "header-set-v1",
    format,
    headers: [...normalized].sort(),
  });

  return createHash("sha256").update(signature).digest("hex");
}

function detectDelimiter(text: string): string {
  const candidates = [",", ";", "\t", "|"];
  const lines = text.split(/\r?\n/).filter(Boolean).slice(0, 10);

  let best = ",";
  let bestScore = -1;

  for (const delimiter of candidates) {
    try {
      const rows = parse(lines.join("\n"), {
        delimiter,
        relax_quotes: true,
        relax_column_count: true,
        skip_empty_lines: true,
      }) as string[][];

      const widths = rows.map((row) => row.length);
      const score =
        widths.filter((width) => width > 1).length * 10 -
        (Math.max(...widths) - Math.min(...widths));

      if (score > bestScore) {
        bestScore = score;
        best = delimiter;
      }
    } catch {
      // Try the next delimiter.
    }
  }

  return best;
}

export async function detectFileFormat(input: {
  fileName: string;
  buffer: Buffer;
  preferredHeaders?: string[];
}): Promise<DetectedFormat> {
  const extension = input.fileName.split(".").pop()?.toLowerCase();

  if (extension === "csv") {
    const text = input.buffer.toString("utf8").replace(/^\uFEFF/, "");
    const delimiter = detectDelimiter(text);

    const rows = parse(text, {
      delimiter,
      bom: true,
      relax_column_count: true,
      skip_empty_lines: true,
      to_line: 35,
    }) as string[][];

    const detected = chooseHeaderRow(rows, input.preferredHeaders);

    return {
      format: "csv",
      fingerprint: makeFingerprint("csv", detected.headers),
      headerRow: detected.row,
      dataStartRow: detected.row + 1,
      delimiter,
      headers: detected.headers,
    };
  }

  if (extension === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(input.buffer as any);

    let best: (DetectedFormat & { score: number }) | undefined;

    for (const sheet of workbook.worksheets) {
      const rows: string[][] = [];

      for (let row = 1; row <= Math.min(sheet.rowCount, 30); row++) {
        const worksheetRow = sheet.getRow(row);
        const cells: string[] = [];

        for (let col = 1; col <= sheet.columnCount; col++) {
          cells.push(cleanCell(worksheetRow.getCell(col).value));
        }

        rows.push(cells);
      }

      try {
        const detected = chooseHeaderRow(rows, input.preferredHeaders);

        const score = detected.headers.filter(Boolean).length;

        if (!best || score > best.score) {
          best = {
            format: "xlsx",
            fingerprint: makeFingerprint("xlsx", detected.headers),
            sheetName: sheet.name,
            headerRow: detected.row,
            dataStartRow: detected.row + 1,
            headers: detected.headers,
            score,
          };
        }
      } catch {
        continue;
      }
    }

    if (!best) {
      throw new Error("No usable Excel table found");
    }

    const { score: _score, ...result } = best;
    return result;
  }

  throw new Error("Only CSV and XLSX files are supported");
}
