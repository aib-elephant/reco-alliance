import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/auth/require-company-admin";
import { authorizationUrl, newNonce, signState, type MailProvider } from "@/lib/email/oauth";

export const runtime = "nodejs";
type Context = { params: Promise<{ provider: string }> };

export async function GET(request: NextRequest, context: Context) {
  const { provider } = await context.params;
  if (provider !== "gmail" && provider !== "microsoft") return NextResponse.json({ error: "Unsupported provider" }, { status: 404 });
  if (!(await requireCompanyAdmin("email-connections"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const documentType = (request.nextUrl.searchParams.get("documentType") || "invoice").trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,80}$/.test(documentType)) return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
  try {
    const nonce = newNonce();
    const state = signState(provider as MailProvider, nonce);
    const response = NextResponse.redirect(authorizationUrl(provider as MailProvider, state));
    response.cookies.set(`drs_oauth_${provider}`, nonce, {
      httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", maxAge: 600, path: "/api/email/oauth",
    });
    response.cookies.set(`drs_type_${provider}`, documentType, {
      httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", maxAge: 600, path: "/api/email/oauth",
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "OAuth setup error" }, { status: 500 });
  }
}
