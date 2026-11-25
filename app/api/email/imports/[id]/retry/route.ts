import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { requireCompanyAdmin } from "@/lib/auth/require-company-admin";
import { connectDB } from "@/lib/db/mongoose";
import { ImportJob } from "@/models/ImportJob";
import { retryImportJob } from "@/lib/email/email-sync.service";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function POST(_request: Request, context: Context) {
  const { id } = await context.params;
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid import ID" }, { status: 400 });
  await connectDB();
  const job = await ImportJob.findById(id).select("companyId provider").lean();
  if (!job || job.provider === "manual") return NextResponse.json({ error: "Email import not found" }, { status: 404 });
  if (!job.companyId || !(await requireCompanyAdmin(String(job.companyId)))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try { return NextResponse.json(await retryImportJob(id)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Retry failed" }, { status: 502 }); }
}
