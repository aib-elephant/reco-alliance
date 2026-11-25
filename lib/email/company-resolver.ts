import Company from "@/models/Company";
import { connectDB } from "@/lib/db/mongoose";
import { matchCompanyFromSender, type CompanyResolution } from "./sender-rules";

export type { CompanyResolution } from "./sender-rules";

// Sender-based routing is only a routing hint; From headers are not authentication.
// Review SPF/DKIM/DMARC requirements for sensitive workflows.
export async function resolveCompany(input: { sender: string; documentType: string }): Promise<CompanyResolution> {
  await connectDB();
  const companies = await Company.find({ status: "active" })
    .select("_id senderEmails allowedDomains").lean();
  return matchCompanyFromSender(input, companies.map((company) => ({
    id: String(company._id),
    senderEmails: company.senderEmails,
    allowedDomains: company.allowedDomains,
  })));
}
