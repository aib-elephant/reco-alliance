import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { requireCompanyAdmin } from "@/lib/auth/require-company-admin";
import { connectDB } from "@/lib/db/mongoose";
import { ImportJob } from "@/models/ImportJob";
import { ImportedTable } from "@/models/ImportedTable";
import { ImportedTableRow } from "@/models/ImportedTableRow";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ importId: string }> },
) {
  const { importId } = await context.params;
  if (!Types.ObjectId.isValid(importId)) {
    return NextResponse.json({ error: "Invalid import ID" }, { status: 400 });
  }
  await connectDB();
  const job = await ImportJob.findById(importId).lean();
  if (!job)
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  if (!job.companyId || !(await requireCompanyAdmin(String(job.companyId)))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Even historical multi-table jobs expose only the first table. New imports
  // persist exactly one table with tableIndex = 0.
  const tables = await ImportedTable.find({
    importJobId: importId,
    tableIndex: 0,
  })
    .sort({ sheetName: 1, tableIndex: 1 })
    .limit(1)
    .lean();
  const tableId = request.nextUrl.searchParams.get("tableId");
  const selected = tableId
    ? tables.find((table) => String(table._id) === tableId)
    : tables[0];
  if (tableId && !selected) {
    return NextResponse.json(
      { error: "Table not found in this import" },
      { status: 404 },
    );
  }

  const page = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get("page") || "1") || 1, 1),
    100000,
  );
  const limit = Math.min(
    Math.max(
      Number(request.nextUrl.searchParams.get("limit") || "50") || 50,
      1,
    ),
    100,
  );
  const rows = selected
    ? await ImportedTableRow.find({
        importJobId: importId,
        tableId: selected._id,
      })
        .sort({ rowNumber: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
    : [];

  return NextResponse.json({
    importId,
    tables,
    selectedTableId: selected ? String(selected._id) : null,
    rows,
    page,
    limit,
    totalRows: selected?.rowCount ?? 0,
  });
}
