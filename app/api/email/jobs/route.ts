import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/auth/require-company-admin";
import { connectDB } from "@/lib/db/mongoose";
import { ImportJob } from "@/models/ImportJob";
import { ProcessedEmail } from "@/models/ProcessedEmail";

export const runtime = "nodejs";
export async function GET() {
  if (!(await requireCompanyAdmin("email-connections")))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await connectDB();
  const [jobs, unmatched] = await Promise.all([
    ImportJob.find({ provider: { $in: ["gmail", "microsoft"] } })
      .select("-importErrors")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    ProcessedEmail.find({
      status: "needs_review",
      companyId: { $exists: false },
    })
      .select("provider mailboxAddress sender subject receivedAt lastError")
      .sort({ createdAt: -1 })
      .limit(30)
      .lean(),
  ]);
  return NextResponse.json({ jobs, unmatched });
}
