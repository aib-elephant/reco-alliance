import { connectDB } from "@/lib/db/mongoose";
import { EmailConnection } from "@/models/EmailConnection";
import { syncMailbox } from "@/lib/email/email-sync.service";
import { inngest } from "./client";

type SyncEvent = { connectionId: string; provider: "gmail" | "microsoft" };

export const mailboxSyncFunction = inngest.createFunction(
  { id: "mailbox-sync", triggers: [{ event: "email/mailbox.changed" }], retries: 3 },
  async ({ event, step }) => {
    const data = event.data as SyncEvent;
    if (!data.connectionId || !["gmail", "microsoft"].includes(data.provider)) throw new Error("Invalid mailbox event");
    return step.run("sync-mailbox", () => syncMailbox(data));
  },
);

export const mailboxSchedulerFunction = inngest.createFunction(
  { id: "mailbox-scheduler", triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) => {
    const connections = await step.run("list-mailboxes", async () => {
      await connectDB();
      const entries = await EmailConnection.find({ status: "active" }).select("provider").lean();
      return entries.map((entry) => ({ connectionId: String(entry._id), provider: entry.provider as "gmail" | "microsoft" }));
    });
    if (connections.length) await step.sendEvent("enqueue-mailbox-sync", connections.map((data) => ({
      name: "email/mailbox.changed" as const, data,
    })));
    return { queued: connections.length };
  },
);
