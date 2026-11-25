import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/auth/require-company-admin";
import { retryUnmatchedEmail } from "@/lib/email/email-sync.service";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function POST(_request: Request, context: Context) {
  if (!(await requireCompanyAdmin("email-connections"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  try { return NextResponse.json(await retryUnmatchedEmail(id)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not retry email" }, { status: 400 }); }
}
