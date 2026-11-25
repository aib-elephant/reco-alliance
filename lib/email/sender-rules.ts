export type CompanyResolution =
  | { status: "matched"; companyId: string; documentType: string; reason: string }
  | { status: "ambiguous" | "unmatched"; candidates?: string[]; reason: string };

export type SenderRuleCompany = {
  id: string;
  senderEmails?: string[];
  allowedDomains?: string[];
};

export function extractSenderAddress(from: string): string | null {
  const match = from.match(/(?:<|^|\s)([a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,})(?:>|$|\s)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

export function matchCompanyFromSender(input: { sender: string; documentType: string }, companies: SenderRuleCompany[]): CompanyResolution {
  const sender = extractSenderAddress(input.sender);
  if (!sender) return { status: "unmatched", reason: "Sender address was missing or invalid" };
  const exact = companies.filter((company) =>
    (company.senderEmails ?? []).some((email) => email.trim().toLowerCase() === sender));
  const domain = sender.split("@")[1];
  const matched = exact.length ? exact : companies.filter((company) =>
    (company.allowedDomains ?? []).some((allowed) => allowed.replace(/^@/, "").trim().toLowerCase() === domain));
  if (!matched.length) return { status: "unmatched", reason: `No active company matches sender ${sender}` };
  if (matched.length !== 1) return {
    status: "ambiguous", candidates: matched.map((company) => company.id),
    reason: `Sender ${sender} matches multiple companies`,
  };
  return {
    status: "matched", companyId: matched[0].id,
    documentType: input.documentType,
    reason: exact.length ? "exact_sender" : "allowed_domain",
  };
}
