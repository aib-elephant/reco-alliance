import { headers } from "next/headers";
/** Local development access only. Integrate a real session & company roles before production. */
export async function requireCompanyAdmin(_companyId: string): Promise<boolean> {
  if (process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_ADMIN === "true") return true;
  const configured = process.env.ADMIN_API_KEY;
  if (!configured) return false;
  const supplied = (await headers()).get("x-admin-api-key");
  if (!supplied) return false;
  const { timingSafeEqual } = await import("node:crypto");
  const a = Buffer.from(supplied);
  const b = Buffer.from(configured);
  return a.length === b.length && timingSafeEqual(a, b);
}
