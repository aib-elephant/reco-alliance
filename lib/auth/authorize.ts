/**
 * Replace with your actual session or API-key implementation.
 * Never use a caller-supplied companyId as proof of authorization.
 */
export async function requireCompanyAccess(_companyId: string): Promise<void> {
  throw new Error("Authentication and company authorization must be implemented");
}
