import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { decryptCredentials, encryptCredentials } from "./crypto";
import { EmailConnection } from "@/models/EmailConnection";

export type MailProvider = "gmail" | "microsoft";
export type OAuthTokens = { access_token: string; refresh_token: string; expires_at: number };

type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be configured`);
  return value;
}

function configuration(provider: MailProvider) {
  if (provider === "gmail") return {
    clientId: env("GOOGLE_CLIENT_ID"),
    clientSecret: env("GOOGLE_CLIENT_SECRET"),
    scope: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email",
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
  };
  const tenant = process.env.MICROSOFT_TENANT_ID || "common";
  if (!/^[a-z0-9-]+$/i.test(tenant)) throw new Error("Invalid Microsoft tenant ID");
  return {
    clientId: env("MICROSOFT_CLIENT_ID"),
    clientSecret: env("MICROSOFT_CLIENT_SECRET"),
    scope: "offline_access User.Read Mail.Read",
    authorizationUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
  };
}

export function callbackUri(provider: MailProvider): string {
  const base = env("APP_BASE_URL");
  if (!/^https?:\/\//.test(base)) throw new Error("APP_BASE_URL must be an HTTP(S) origin");
  return `${base.replace(/\/$/, "")}/api/email/oauth/${provider}/callback`;
}

export function signState(provider: MailProvider, nonce: string): string {
  const payload = Buffer.from(JSON.stringify({ provider, nonce, issuedAt: Date.now() })).toString("base64url");
  const signature = createHmac("sha256", env("OAUTH_STATE_SECRET")).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyState(state: string, provider: MailProvider, expectedNonce: string): boolean {
  const [payload, signature, extra] = state.split(".");
  if (!payload || !signature || extra) return false;
  const actual = createHmac("sha256", env("OAUTH_STATE_SECRET")).update(payload).digest();
  const received = Buffer.from(signature, "base64url");
  if (received.length !== actual.length || !timingSafeEqual(actual, received)) return false;
  try {
    const parsed: { provider?: string; nonce?: string; issuedAt?: number } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return parsed.provider === provider && parsed.nonce === expectedNonce &&
      typeof parsed.issuedAt === "number" && parsed.issuedAt <= Date.now() && Date.now() - parsed.issuedAt < 10 * 60_000;
  } catch { return false; }
}

export function newNonce(): string { return randomBytes(32).toString("base64url"); }

export function authorizationUrl(provider: MailProvider, state: string): string {
  const config = configuration(provider);
  const url = new URL(config.authorizationUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", callbackUri(provider));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", state);
  if (provider === "gmail") {
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
  }
  return url.toString();
}

async function tokenRequest(provider: MailProvider, params: URLSearchParams): Promise<TokenResponse> {
  const config = configuration(provider);
  params.set("client_id", config.clientId);
  params.set("client_secret", config.clientSecret);
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const result = await response.json() as TokenResponse;
  if (!response.ok || !result.access_token) {
    throw new Error(`OAuth token exchange failed: ${result.error ?? response.status}`);
  }
  return result;
}

export async function exchangeAuthorizationCode(provider: MailProvider, code: string): Promise<OAuthTokens> {
  const result = await tokenRequest(provider, new URLSearchParams({
    grant_type: "authorization_code", code, redirect_uri: callbackUri(provider),
  }));
  if (!result.refresh_token) throw new Error("Provider did not grant offline access; reconnect with consent");
  return {
    access_token: result.access_token!,
    refresh_token: result.refresh_token,
    expires_at: Date.now() + (result.expires_in ?? 3600) * 1000,
  };
}

export async function accessToken(connection: { _id: unknown; provider: MailProvider; encryptedCredentials?: string }): Promise<string> {
  if (!connection.encryptedCredentials) throw new Error("Mailbox credentials unavailable");
  const credentials = decryptCredentials<OAuthTokens>(connection.encryptedCredentials);
  if (credentials.expires_at > Date.now() + 90_000) return credentials.access_token;
  try {
    const result = await tokenRequest(connection.provider, new URLSearchParams({
      grant_type: "refresh_token", refresh_token: credentials.refresh_token,
      ...(connection.provider === "microsoft" ? { scope: configuration("microsoft").scope } : {}),
    }));
    const renewed: OAuthTokens = {
      access_token: result.access_token!,
      refresh_token: result.refresh_token || credentials.refresh_token,
      expires_at: Date.now() + (result.expires_in ?? 3600) * 1000,
    };
    connection.encryptedCredentials = encryptCredentials(renewed);
    await EmailConnection.findByIdAndUpdate(connection._id, { encryptedCredentials: connection.encryptedCredentials });
    return renewed.access_token;
  } catch (error) {
    // Transient provider outages must not silently revoke mailbox access.
    if (error instanceof Error && /invalid_grant|interaction_required/.test(error.message)) {
      await EmailConnection.findByIdAndUpdate(connection._id, { status: "reauthorization_required" });
    }
    throw error;
  }
}

export async function providerFetch<T>(url: string, token: string, kind: MailProvider): Promise<T> {
  const allowed = kind === "gmail"
    ? /^https:\/\/gmail\.googleapis\.com\/gmail\/v1\//
    : /^https:\/\/graph\.microsoft\.com\/v1\.0\/me(?:\/|\?)/;
  if (!allowed.test(url)) throw new Error("Untrusted provider API URL");
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(kind === "microsoft" ? { Prefer: 'IdType="ImmutableId"' } : {}),
    },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${kind} API returned HTTP ${response.status}`);
  return await response.json() as T;
}
