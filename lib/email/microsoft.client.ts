import { accessToken, providerFetch } from "./oauth";
import { isSupportedAttachment, MAX_ATTACHMENT_BYTES } from "./attachment.service";
import type { ConnectionAuth, MailMessage, MailAttachment } from "./gmail.client";

const graph = "https://graph.microsoft.com/v1.0/me/";
type GraphMessage = {
  id: string; subject?: string; receivedDateTime?: string;
  from?: { emailAddress?: { address?: string } };
  hasAttachments?: boolean;
};
type GraphAttachment = {
  id: string; name?: string; size?: number; isInline?: boolean;
  "@odata.type"?: string; contentBytes?: string;
};

export async function listMicrosoftMessageIds(connection: ConnectionAuth, since: Date): Promise<string[]> {
  const token = await accessToken(connection);
  const ids = new Set<string>();
  const params = new URLSearchParams({
    "$filter": `receivedDateTime ge ${since.toISOString()}`,
    "$select": "id,receivedDateTime,hasAttachments",
    "$top": "100",
    "$orderby": "receivedDateTime desc",
  });
  let next: string | undefined = `${graph}mailFolders/inbox/messages?${params}`;
  for (let page = 0; page < 20 && next; page++) {
    const result: { value?: GraphMessage[]; "@odata.nextLink"?: string } =
      await providerFetch(next, token, "microsoft");
    for (const msg of result.value ?? []) if (msg.hasAttachments) ids.add(msg.id);
    next = result["@odata.nextLink"];
    if (!next) return [...ids];
  }
  throw new Error("Microsoft inbox scan exceeded 2,000 messages; cursor was not advanced");
}

export async function getMicrosoftMessage(connection: ConnectionAuth, messageId: string): Promise<MailMessage> {
  const token = await accessToken(connection);
  const message = await providerFetch<GraphMessage>(`${graph}messages/${encodeURIComponent(messageId)}?$select=id,subject,receivedDateTime,from`, token, "microsoft");
  const attachments: MailAttachment[] = [];
  let next: string | undefined = `${graph}messages/${encodeURIComponent(messageId)}/attachments?$top=100`;
  for (let page = 0; page < 5 && next; page++) {
    const result: { value?: GraphAttachment[]; "@odata.nextLink"?: string } = await providerFetch(next, token, "microsoft");
    for (const attachment of result.value ?? []) {
      if (!attachment.name || !isSupportedAttachment(attachment.name) || attachment.isInline || attachment["@odata.type"] !== "#microsoft.graph.fileAttachment") continue;
      attachments.push({
        id: attachment.id, name: attachment.name, size: attachment.size ?? 0,
        download: async () => {
          if ((attachment.size ?? 0) > MAX_ATTACHMENT_BYTES) throw new Error("Attachment exceeds 10 MB maximum");
          const detail = await providerFetch<GraphAttachment>(`${graph}messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachment.id)}`, token, "microsoft");
          if (!detail.contentBytes || detail.contentBytes.length > Math.ceil(MAX_ATTACHMENT_BYTES * 4 / 3) + 8) throw new Error("Attachment missing or oversized");
          return Buffer.from(detail.contentBytes, "base64");
        },
      });
    }
    next = result["@odata.nextLink"];
    if (!next) break;
    if (page === 4) throw new Error("Too many Microsoft attachments to scan");
  }
  return {
    id: message.id,
    sender: message.from?.emailAddress?.address ?? "",
    subject: message.subject ?? "",
    receivedAt: message.receivedDateTime ? new Date(message.receivedDateTime) : new Date(),
    attachments,
  };
}

export async function microsoftIdentity(token: string): Promise<string> {
  const profile = await providerFetch<{ mail?: string; userPrincipalName?: string }>("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", token, "microsoft");
  const address = profile.mail || profile.userPrincipalName;
  if (!address) throw new Error("Microsoft account address unavailable");
  return address.toLowerCase();
}
