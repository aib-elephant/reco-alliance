import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { EmailConnection } from "@/models/EmailConnection";
import { encryptCredentials } from "@/lib/email/crypto";
import {
  exchangeAuthorizationCode,
  verifyState,
  type MailProvider,
} from "@/lib/email/oauth";
import { gmailIdentity } from "@/lib/email/gmail.client";
import { microsoftIdentity } from "@/lib/email/microsoft.client";

export const runtime = "nodejs";
type Context = { params: Promise<{ provider: string }> };

export async function GET(request: NextRequest, context: Context) {
  const { provider } = await context.params;
  if (provider !== "gmail" && provider !== "microsoft")
    return NextResponse.json(
      { error: "Unsupported provider" },
      { status: 404 },
    );
  const base = new URL("/email", request.url);
  const responseError = request.nextUrl.searchParams.get("error");
  if (responseError) {
    base.searchParams.set("error", "Provider authorization was declined");
    return NextResponse.redirect(base);
  }
  const nonce = request.cookies.get(`drs_oauth_${provider}`)?.value;
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  if (
    !nonce ||
    !state ||
    !code ||
    !verifyState(state, provider as MailProvider, nonce)
  ) {
    return NextResponse.json(
      { error: "Invalid or expired OAuth state" },
      { status: 403 },
    );
  }
  try {
    const tokens = await exchangeAuthorizationCode(
      provider as MailProvider,
      code,
    );
    const mailboxAddress =
      provider === "gmail"
        ? await gmailIdentity(tokens.access_token)
        : await microsoftIdentity(tokens.access_token);
    const documentType =
      request.cookies.get(`drs_type_${provider}`)?.value || "invoice";
    await connectDB();
    await EmailConnection.findOneAndUpdate(
      { provider, mailboxAddress },
      {
        $set: {
          provider,
          mailboxAddress,
          documentType,
          encryptedCredentials: encryptCredentials(tokens),
          status: "active",
        },
        $unset: { syncLockUntil: 1 },
      },
      { upsert: true, returnDocument: "after" },
    );
    base.searchParams.set("connected", mailboxAddress);
  } catch (error) {
    console.error(
      "Mailbox OAuth callback failed:",
      error instanceof Error ? error.message : "Unknown provider error",
    );
    base.searchParams.set(
      "error",
      "Could not connect mailbox; check provider configuration and permissions",
    );
  }
  const response = NextResponse.redirect(base);
  for (const name of [`drs_oauth_${provider}`, `drs_type_${provider}`]) {
    response.cookies.set(name, "", { maxAge: 0, path: "/api/email/oauth" });
  }
  return response;
}
