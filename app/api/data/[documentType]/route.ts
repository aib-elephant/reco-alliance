import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { requireCompanyAdmin } from "@/lib/auth/require-company-admin";
import { ImportedRecord } from "@/models/ImportedRecord";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ documentType: string }> }
) {
  // TODO: replace this demo companyId query param with company scope from auth.
  const { documentType } = await context.params;
  const companyId = request.nextUrl.searchParams.get("companyId");
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 50), 1), 100);

  if (!companyId || !/^[a-f\d]{24}$/i.test(companyId)) {
    return NextResponse.json({ error: "Valid companyId is required" }, { status: 400 });
  }

  if (!(await requireCompanyAdmin(companyId))) return NextResponse.json({error:"Forbidden"},{status:403});
  await connectDB();
  const records = await ImportedRecord.find({
    companyId,
    documentType: documentType.toLowerCase(),
  })
    .sort({ _id: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json({ data: records, limit });
}
