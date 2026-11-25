import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { requireCompanyAdmin } from "@/lib/auth/require-company-admin";
import { ImportJob } from "@/models/ImportJob";

export async function GET(request: NextRequest) {
  // TODO: replace with session/API-key auth and derive companyId from the principal.
  const companyId = request.nextUrl.searchParams.get("companyId");
  if (!companyId || !/^[a-f\d]{24}$/i.test(companyId)) {
    return NextResponse.json(
      { error: "Valid companyId is required" },
      { status: 400 },
    );
  }

  if (!(await requireCompanyAdmin(companyId)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await connectDB();
  const jobs = await ImportJob.find({ companyId })
    .select("-errors")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return NextResponse.json({ data: jobs });
}
