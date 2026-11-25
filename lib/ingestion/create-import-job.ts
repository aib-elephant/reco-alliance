import { connectDB } from "@/lib/db/mongoose";
import { ImportJob } from "@/models/ImportJob";

export async function createImportJob(input: {
  companyId: string;
  processedEmailId: string;
  provider: "gmail" | "microsoft";
  mailboxAddress: string;
  providerMessageId: string;
  attachmentId: string;
  attachmentName: string;
  documentType: string;
}) {
  await connectDB();
  const key = {
    provider: input.provider,
    mailboxAddress: input.mailboxAddress,
    providerMessageId: input.providerMessageId,
    attachmentId: input.attachmentId,
  };
  try {
    return await ImportJob.findOneAndUpdate(
      key,
      { $setOnInsert: { ...input, ...key, status: "queued", attempts: 0 } },
      { upsert: true, returnDocument: "after" },
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000
    ) {
      const existing = await ImportJob.findOne(key);
      if (existing) return existing;
    }
    throw error;
  }
}
