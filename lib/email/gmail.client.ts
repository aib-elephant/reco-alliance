import { accessToken, MailProvider, providerFetch } from "./oauth";
import { decodeBase64Url, isSupportedAttachment, MAX_ATTACHMENT_BYTES } from "./attachment.service";

export type ConnectionAuth = { _id: unknown; provider: MailProvider; encryptedCredentials?: string; mailboxAddress: string };
export type MailAttachment = { id: string; name: string; size: number; download: () => Promise<Buffer> };
export type MailMessage = { id: string; sender: string; subject: string; receivedAt: Date; attachments: MailAttachment[] };

type GmailPart = {
  filename?: string;
  mimeType?: string;
  body?: { attachmentId?: string; data?: string; size?: number };
  parts?: GmailPart[];
  headers?: Array<{ name: string; value: string }>;
};
type GmailMessage = { id: string; internalDate?: string; payload?: GmailPart };

function url(path: string): string { return `https://gmail.googleapis.com/gmail/v1/users/me/${path}`; }
function header(message: GmailMessage, key: string): string {
  return message.payload?.headers?.find((h) => h.name.toLowerCase() === key.toLowerCase())?.value ?? "";
}

export async function listGmailMessageIds(connection: ConnectionAuth, since: Date): Promise<string[]> {
  const token = await accessToken(connection);
  const ids = new Set<string>();
  let pageToken: string | undefined;
  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({ q: `has:attachment {filename:csv filename:xlsx} after:${Math.floor(since.getTime() / 1000)}`, maxResults: "100" });
    if (pageToken) params.set("pageToken", pageToken);
    const result = await providerFetch<{ messages?: Array<{ id: string }>; nextPageToken?: string }>(url(`messages?${params}`), token, "gmail");
    for (const message of result.messages ?? []) ids.add(message.id);
    pageToken = result.nextPageToken;
    if (!pageToken) return [...ids];
  }
  throw new Error("Gmail scan exceeded 2,000 messages; cursor was not advanced");
}

export async function getGmailMessage(connection: ConnectionAuth, messageId: string): Promise<MailMessage> {
  const token = await accessToken(connection);
  const result = await providerFetch<GmailMessage>(url(`messages/${encodeURIComponent(messageId)}?format=full`), token, "gmail");
  const attachments: MailAttachment[] = [];
  const visit = (part: GmailPart, path: string) => {
    if (part.filename && isSupportedAttachment(part.filename) && part.body) {
      const size = part.body.size ?? 0;
      const { attachmentId, data } = part.body;
      attachments.push({
        id: attachmentId || `part-${path}`,
        name: part.filename,
        size,
        download: async () => {
          if (size > MAX_ATTACHMENT_BYTES) throw new Error("Attachment exceeds 10 MB maximum");
          let encoded = data;
          if (attachmentId) {
            const attachment = await providerFetch<{ data: string; size: number }>(
              url(`messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`), token, "gmail");
            if (attachment.size > MAX_ATTACHMENT_BYTES) throw new Error("Attachment exceeds 10 MB maximum");
            encoded = attachment.data;
          }
          if (!encoded || encoded.length > Math.ceil(MAX_ATTACHMENT_BYTES * 4 / 3) + 8) throw new Error("Attachment is missing or oversized");
          return decodeBase64Url(encoded);
        },
      });
    }
    for (const [i, child] of (part.parts ?? []).entries()) visit(child, `${path}-${i}`);
  };
  if (result.payload) visit(result.payload, "0");
  return {
    id: result.id,
    sender: header(result, "From"),
    subject: header(result, "Subject"),
    receivedAt: new Date(Number(result.internalDate || Date.now())),
    attachments,
  };
}

export async function gmailIdentity(token: string): Promise<string> {
  const result = await providerFetch<{ emailAddress: string }>(url("profile"), token, "gmail");
  if (!result.emailAddress) throw new Error("Gmail account address unavailable");
  return result.emailAddress.toLowerCase();
}
