import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/auth/require-company-admin";
import { connectDB } from "@/lib/db/mongoose";
import { EmailConnection } from "@/models/EmailConnection";

export const runtime = "nodejs";
export async function GET() {
  if (!(await requireCompanyAdmin("email-connections"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await connectDB();
  const connections = await EmailConnection.find().select("-encryptedCredentials -syncCursor").sort({ createdAt: -1 }).lean();
  return NextResponse.json({ data: connections });
}
