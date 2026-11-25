import { connectDB } from "@/lib/db/mongoose";
import { MappedKey } from "@/models/KeyMapping";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await connectDB();

    const mappedKey = await MappedKey.find();

    return NextResponse.json(
      { success: true, count: mappedKey.length, data: mappedKey },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Failed to fetch keys" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();

    const body = await req.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, message: "Request body must be a JSON object" },
        { status: 400 },
      );
    }

    const { source_field, mapped_columns } = body;

    const createField = await MappedKey.create({
      source_field,
      mapped_columns,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Field created successfully!",
        data: createField,
      },
      { status: 201 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 },
    );
  }
}
