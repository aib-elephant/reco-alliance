import { connectDB } from "@/lib/db/mongoose";
import { MappedKey } from "@/models/KeyMapping";
import { NextResponse } from "next/server";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PUT(req: Request, { params }: Params) {
  try {
    await connectDB();
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 401 });
    }

    const body = await req.json();

    const { key } = body;

    const updatedField = await MappedKey.findByIdAndUpdate(id, {
      $push: { mapped_columns: key },
    });
    return NextResponse.json(
      { success: true, message: "Key added successfully!", data: updatedField },
      { status: 200 },
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    await connectDB();
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 401 });
    }

    const body = await req.json();

    const { key } = body;

    const deletedKey = await MappedKey.findByIdAndUpdate(id, {
      $pull: { mapped_columns: key },
      $push: { deleted_keys: key },
    });

    return NextResponse.json(
      { success: true, message: "Key removed successfully!", data: deletedKey },
      { status: 200 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 },
    );
  }
}
