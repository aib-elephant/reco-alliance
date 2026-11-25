import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { requireCompanyAdmin } from "@/lib/auth/require-company-admin";
import { ImportJob } from "@/models/ImportJob";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ importId: string }> }
) {
  // TODO: authorize the current user for this job's company before returning it.
  const { importId } = await context.params;
  if (!/^[a-f\d]{24}$/i.test(importId)) {
    return NextResponse.json({ error: "Invalid import ID" }, { status: 400 });
  }

  await connectDB();
  const job = await ImportJob.findById(importId).lean();
  if (!job) return NextResponse.json({ error: "Import not found" }, { status: 404 });
  if (!(await requireCompanyAdmin(String(job.companyId)))) return NextResponse.json({error:"Forbidden"},{status:403});

  return NextResponse.json({ data: job });
}
