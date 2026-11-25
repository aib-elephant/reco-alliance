import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { EmailConnection } from "@/models/EmailConnection";
import { inngest } from "@/inngest/client";

export const runtime = "nodejs";
/** Optional external scheduler: POST with Authorization: Bearer <CRON_SECRET>. */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || !bearer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supplied = Buffer.from(bearer);
  const expected = Buffer.from(secret);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const connections = await EmailConnection.find({ status: "active" }).select("provider").lean();
  if (connections.length) await inngest.send(connections.map((connection) => ({
    name: "email/mailbox.changed" as const,
    data: { connectionId: String(connection._id), provider: connection.provider },
  })));
  return NextResponse.json({ queued: connections.length });
}
