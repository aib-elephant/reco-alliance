import { parse } from "csv-parse/sync";
import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";

export async function GET() {
  try {
    const filePath = path.join(
      process.cwd(),
      "public",
      "data",
      "Finance_Reco_Report_2025-2026-2026-11-18-20-57-11.csv",
    );

    const csvData = await readFile(filePath, "utf-8");

    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      trim: true,
    });

    return NextResponse.json({ success: true, data: records }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 },
    );
  }
}
