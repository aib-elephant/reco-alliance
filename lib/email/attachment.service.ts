export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const SUPPORTED_EXTENSIONS = new Set(["csv", "xlsx"]);

export function isSupportedAttachment(fileName: string) {
  const extension = fileName.toLowerCase().split(".").pop();
  return Boolean(extension && SUPPORTED_EXTENSIONS.has(extension));
}

export function assertAttachmentSize(buffer: Buffer): void {
  if (buffer.length === 0) throw new Error("Attachment is empty");
  if (buffer.length > MAX_ATTACHMENT_BYTES) throw new Error("Attachment exceeds 10 MB maximum");
}

export function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}
