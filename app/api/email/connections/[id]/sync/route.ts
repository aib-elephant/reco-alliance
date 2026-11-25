import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { requireCompanyAdmin } from "@/lib/auth/require-company-admin";
import { syncMailbox } from "@/lib/email/email-sync.service";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function POST(_request: Request, context: Context) {
  if (!(await requireCompanyAdmin("email-connections"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid connection ID" }, { status: 400 });
  try {
    const result = await syncMailbox({ connectionId: id });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Mailbox sync failed:", error instanceof Error ? error.message : "Unknown failure");
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sync failed" }, { status: 502 });
  }
}
