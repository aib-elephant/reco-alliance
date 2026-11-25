import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCompanyAdmin } from "@/lib/auth/require-company-admin";
import { processBufferImport } from "@/lib/ingestion/process-import";

const RequestSchema = z.object({
  companyId: z.string().regex(/^[a-f\d]{24}$/i),
  documentType: z.string().min(1).max(80),
  fileName: z.string().min(1).max(255),
  contentBase64: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = RequestSchema.parse(await request.json());
    if (!(await requireCompanyAdmin(body.companyId))) {
      return NextResponse.json({ error: "Forbidden: configure admin access" }, { status: 403 });
    }
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(body.contentBase64) || body.contentBase64.length > 14_000_000) {
      return NextResponse.json({ error: "Invalid or oversized base64 file" }, { status: 400 });
    }
    const buffer = Buffer.from(body.contentBase64, "base64");

    if (buffer.byteLength > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File exceeds 10 MB limit" },
        { status: 413 },
      );
    }

    const result = await processBufferImport({
      companyId: body.companyId,
      documentType: body.documentType,
      fileName: body.fileName,
      buffer,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
