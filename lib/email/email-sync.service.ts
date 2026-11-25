import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { EmailConnection } from "@/models/EmailConnection";
import { ProcessedEmail } from "@/models/ProcessedEmail";
import { ImportJob } from "@/models/ImportJob";
import { MappingConfig } from "@/models/MappingConfig";
import { resolveCompany } from "./company-resolver";
import { assertAttachmentSize } from "./attachment.service";
import { createImportJob } from "@/lib/ingestion/create-import-job";
import { processBufferImport } from "@/lib/ingestion/process-import";
import {
  getGmailMessage,
  listGmailMessageIds,
  type ConnectionAuth,
  type MailMessage,
  type MailAttachment,
} from "./gmail.client";
import {
  getMicrosoftMessage,
  listMicrosoftMessageIds,
} from "./microsoft.client";
import type { MailProvider } from "./oauth";

type StoredConnection = ConnectionAuth & {
  status: string;
  documentType: string;
  lastSyncedAt?: Date;
};
type JobSummary = {
  scanned: number;
  completed: number;
  needsReview: number;
  failed: number;
  skipped: number;
};
const LOCK_MS = 30 * 60_000;

async function connectionById(connectionId: string): Promise<StoredConnection> {
  if (!Types.ObjectId.isValid(connectionId))
    throw new Error("Invalid connection ID");
  const connection = await EmailConnection.findById(connectionId).select(
    "+encryptedCredentials",
  );
  if (!connection || connection.status !== "active")
    throw new Error("Active email connection not found");
  return connection as StoredConnection;
}

function providerAdapters(connection: StoredConnection) {
  return connection.provider === "gmail"
    ? { list: listGmailMessageIds, get: getGmailMessage }
    : { list: listMicrosoftMessageIds, get: getMicrosoftMessage };
}

async function markMessageStatus(messageId: string) {
  const jobs = await ImportJob.find({ processedEmailId: messageId })
    .select("status")
    .lean();
  const statuses = jobs.map((job) => job.status);
  const status = statuses.includes("needs_review")
    ? "needs_review"
    : statuses.includes("failed")
      ? "failed"
      : statuses.includes("processing") || statuses.includes("queued")
        ? "processing"
        : "completed";
  await ProcessedEmail.findByIdAndUpdate(messageId, { status });
}

async function ingestAttachment(
  connection: StoredConnection,
  processedEmailId: string,
  message: MailMessage,
  attachment: MailAttachment,
  companyId: string,
  existingJobId?: string,
) {
  const job = existingJobId
    ? await ImportJob.findById(existingJobId)
    : await createImportJob({
        companyId,
        processedEmailId,
        provider: connection.provider as MailProvider,
        mailboxAddress: connection.mailboxAddress,
        providerMessageId: message.id,
        attachmentId: attachment.id,
        attachmentName: attachment.name,
        documentType: connection.documentType || "invoice",
      });
  if (!job) throw new Error("Could not create attachment import job");
  if (["completed", "partially_completed"].includes(job.status))
    return "skipped" as const;

  const claimed = await ImportJob.findOneAndUpdate(
    { _id: job._id, status: { $in: ["queued", "failed", "needs_review"] } },
    {
      $set: { status: "processing", startedAt: new Date() },
      $inc: { attempts: 1 },
    },
    { returnDocument: "after" },
  );
  if (!claimed) return "skipped" as const;
  try {
    const buffer = await attachment.download();
    assertAttachmentSize(buffer);
    const result = await processBufferImport({
      companyId,
      documentType: claimed.documentType,
      fileName: attachment.name,
      buffer,
      source: {
        importJobId: String(job._id),
        processedEmailId,
        provider: connection.provider as MailProvider,
        mailboxAddress: connection.mailboxAddress,
        providerMessageId: message.id,
        attachmentId: attachment.id,
      },
    });
    return result.status === "mapping_review_required"
      ? ("needsReview" as const)
      : result.status === "failed"
        ? ("failed" as const)
        : ("completed" as const);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unknown import failure";
    await ImportJob.findByIdAndUpdate(job._id, {
      status: "failed",
      completedAt: new Date(),
      errors: [{ message: reason.slice(0, 1000) }],
    });
    return "failed" as const;
  }
}

async function scanMessage(
  connection: StoredConnection,
  message: MailMessage,
  summary: JobSummary,
) {
  const processed = await ProcessedEmail.findOneAndUpdate(
    {
      provider: connection.provider,
      mailboxAddress: connection.mailboxAddress,
      providerMessageId: message.id,
    },
    {
      $setOnInsert: {
        provider: connection.provider,
        mailboxAddress: connection.mailboxAddress,
        providerMessageId: message.id,
        sender: message.sender,
        subject: message.subject,
        receivedAt: message.receivedAt,
        status: "discovered",
      },
    },
    { upsert: true, returnDocument: "after" },
  );
  if (["completed", "needs_review"].includes(processed.status)) {
    summary.skipped++;
    return;
  }
  const decision = await resolveCompany({
    sender: message.sender,
    documentType: connection.documentType || "invoice",
  });
  if (decision.status !== "matched") {
    await ProcessedEmail.findByIdAndUpdate(processed._id, {
      status: "needs_review",
      lastError: decision.reason,
    });
    summary.needsReview++;
    return;
  }
  await ProcessedEmail.findByIdAndUpdate(processed._id, {
    status: "processing",
    companyId: decision.companyId,
    lastError: null,
  });
  if (message.attachments.length === 0) {
    await ProcessedEmail.findByIdAndUpdate(processed._id, {
      status: "completed",
    });
    summary.skipped++;
    return;
  }
  for (const attachment of message.attachments) {
    const result = await ingestAttachment(
      connection,
      String(processed._id),
      message,
      attachment,
      decision.companyId,
    );
    if (result === "completed") summary.completed++;
    else if (result === "needsReview") summary.needsReview++;
    else if (result === "failed") summary.failed++;
    else summary.skipped++;
  }
  await markMessageStatus(String(processed._id));
}

/** Re-fetch from the provider after a mapping was approved; raw attachments aren't stored. */
export async function retryImportJob(importJobId: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(importJobId))
    throw new Error("Invalid import ID");
  const job = await ImportJob.findById(importJobId);
  if (!job || !["gmail", "microsoft"].includes(job.provider))
    throw new Error("Email import not found");
  if (!["failed", "needs_review", "queued"].includes(job.status))
    return { status: job.status, skipped: true };
  const connection = (await EmailConnection.findOne({
    provider: job.provider,
    mailboxAddress: job.mailboxAddress,
    status: "active",
  }).select("+encryptedCredentials")) as StoredConnection | null;
  if (!connection) throw new Error("No active mailbox connection is available");
  const message = await providerAdapters(connection).get(
    connection,
    job.providerMessageId,
  );
  const attachment = message.attachments.find(
    (item) => item.id === job.attachmentId,
  );
  if (!attachment)
    throw new Error("Attachment is no longer available at the provider");
  const result = await ingestAttachment(
    connection,
    String(job.processedEmailId),
    message,
    attachment,
    String(job.companyId),
    String(job._id),
  );
  if (job.processedEmailId)
    await markMessageStatus(String(job.processedEmailId));
  return { status: result, skipped: result === "skipped" };
}

async function retryApprovedMappings(
  connection: StoredConnection,
  summary: JobSummary,
) {
  const pending = await ImportJob.find({
    provider: connection.provider,
    mailboxAddress: connection.mailboxAddress,
    status: "needs_review",
    mappingConfigId: { $exists: true },
  })
    .sort({ createdAt: 1 })
    .limit(30)
    .lean();
  for (const job of pending) {
    const approved = await MappingConfig.exists({
      _id: job.mappingConfigId,
      status: "active",
    });
    if (!approved) continue;
    try {
      const result = await retryImportJob(String(job._id));
      if (result.status === "completed") summary.completed++;
      else if (result.status === "failed") summary.failed++;
      else if (result.status === "needsReview") summary.needsReview++;
    } catch {
      summary.failed++;
    }
  }
}

export async function syncMailbox(input: {
  connectionId: string;
  provider?: MailProvider;
}) {
  await connectDB();
  const connection = await connectionById(input.connectionId);
  if (input.provider && input.provider !== connection.provider)
    throw new Error("Mailbox provider mismatch");
  const now = new Date();
  const claimed = await EmailConnection.findOneAndUpdate(
    {
      _id: connection._id,
      status: "active",
      $or: [
        { syncLockUntil: { $exists: false } },
        { syncLockUntil: { $lte: now } },
      ],
    },
    { $set: { syncLockUntil: new Date(now.getTime() + LOCK_MS) } },
    { returnDocument: "after" },
  );
  if (!claimed)
    return { status: "already_syncing", connectionId: input.connectionId };
  const summary: JobSummary = {
    scanned: 0,
    completed: 0,
    needsReview: 0,
    failed: 0,
    skipped: 0,
  };
  try {
    await retryApprovedMappings(connection, summary);
    // A two-day overlap protects against provider indexing delays. On a first
    // run, only the previous 30 days are scanned; older mail needs explicit backfill.
    const since = connection.lastSyncedAt
      ? new Date(connection.lastSyncedAt.getTime() - 48 * 60 * 60_000)
      : new Date(Date.now() - 30 * 24 * 60 * 60_000);
    const adapters = providerAdapters(connection);
    const messageIds = await adapters.list(connection, since);
    for (const messageId of messageIds) {
      const message = await adapters.get(connection, messageId);
      summary.scanned++;
      try {
        await scanMessage(connection, message, summary);
      } catch (error) {
        summary.failed++;
        await ProcessedEmail.updateOne(
          {
            provider: connection.provider,
            mailboxAddress: connection.mailboxAddress,
            providerMessageId: message.id,
          },
          {
            $set: {
              status: "failed",
              lastError: (error instanceof Error
                ? error.message
                : "Unexpected error"
              ).slice(0, 1000),
            },
          },
        );
      }
    }
    // Never move the watermark after the scan throws or pagination is incomplete.
    await EmailConnection.findByIdAndUpdate(connection._id, {
      lastSyncedAt: now,
    });
    return {
      status: "completed",
      connectionId: input.connectionId,
      ...summary,
    };
  } finally {
    await EmailConnection.findByIdAndUpdate(connection._id, {
      $unset: { syncLockUntil: 1 },
    });
  }
}

/** Retry a message whose sender rules were previously unmatched or ambiguous. */
export async function retryUnmatchedEmail(processedEmailId: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(processedEmailId))
    throw new Error("Invalid email ID");
  const processed = await ProcessedEmail.findById(processedEmailId);
  if (
    !processed ||
    processed.companyId ||
    processed.status !== "needs_review"
  ) {
    throw new Error("Unmatched email not found");
  }
  const connection = (await EmailConnection.findOne({
    provider: processed.provider,
    mailboxAddress: processed.mailboxAddress,
    status: "active",
  }).select("+encryptedCredentials")) as StoredConnection | null;
  if (!connection) throw new Error("No active mailbox connection");
  const message = await providerAdapters(connection).get(
    connection,
    processed.providerMessageId,
  );
  const company = await resolveCompany({
    sender: message.sender,
    documentType: connection.documentType || "invoice",
  });
  if (company.status !== "matched")
    return { status: company.status, reason: company.reason };
  await ProcessedEmail.findByIdAndUpdate(processedEmailId, {
    status: "discovered",
    lastError: null,
  });
  const summary: JobSummary = {
    scanned: 1,
    completed: 0,
    needsReview: 0,
    failed: 0,
    skipped: 0,
  };
  await scanMessage(connection, message, summary);
  return { status: "retried", ...summary };
}
