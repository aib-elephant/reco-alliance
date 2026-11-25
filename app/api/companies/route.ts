import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import Company from "@/models/Company";

// export const runtime = "nodejs";

// GET /api/companies
// Optional filters:
// /api/companies?status=active
// /api/companies?status=disabled
// /api/companies?slug=abc-industries
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");
    const slug = searchParams.get("slug")?.trim().toLowerCase();

    if (status && !["active", "disabled"].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          message: "Status must be 'active' or 'disabled'",
        },
        { status: 400 },
      );
    }

    const filter: Record<string, string> = {};

    if (status) filter.status = status;
    if (slug) filter.slug = slug;

    const companies = await Company.find(filter).sort({ name: 1 }).lean();

    return NextResponse.json(
      {
        success: true,
        count: companies.length,
        data: companies,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /api/companies error:", error);

    return NextResponse.json(
      { success: false, message: "Failed to fetch companies" },
      { status: 500 },
    );
  }
}

// POST /api/companies
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, message: "Request body must be a JSON object" },
        { status: 400 },
      );
    }

    const input = body as Record<string, unknown>;

    const name = typeof input.name === "string" ? input.name.trim() : "";

    const slug =
      typeof input.slug === "string" ? input.slug.trim().toLowerCase() : "";

    const status = input.status ?? "active";

    const normalizeStringArray = (
      value: unknown,
      fieldName: string,
    ): string[] | null => {
      if (value === undefined) return [];

      if (
        !Array.isArray(value) ||
        !value.every((item) => typeof item === "string")
      ) {
        throw new Error(`${fieldName} must be an array of strings`);
      }

      return [
        ...new Set(
          value
            .map((item: string) => item.trim().toLowerCase())
            .filter(Boolean),
        ),
      ];
    };

    if (!name || !slug) {
      return NextResponse.json(
        {
          success: false,
          message: "Both name and slug are required",
        },
        { status: 400 },
      );
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Slug must contain lowercase letters, numbers, and single hyphens between words",
        },
        { status: 400 },
      );
    }

    if (status !== "active" && status !== "disabled") {
      return NextResponse.json(
        {
          success: false,
          message: "Status must be 'active' or 'disabled'",
        },
        { status: 400 },
      );
    }

    let senderEmails: string[];
    let allowedDomains: string[];

    try {
      senderEmails =
        normalizeStringArray(input.senderEmails, "senderEmails") ?? [];
      allowedDomains =
        normalizeStringArray(input.allowedDomains, "allowedDomains") ?? [];
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message:
            error instanceof Error ? error.message : "Invalid array fields",
        },
        { status: 400 },
      );
    }

    const invalidEmail = senderEmails.find(
      (email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    );

    if (invalidEmail) {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid sender email: ${invalidEmail}`,
        },
        { status: 400 },
      );
    }

    const invalidDomain = allowedDomains.find(
      (domain) =>
        !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(
          domain,
        ),
    );

    if (invalidDomain) {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid allowed domain: ${invalidDomain}`,
        },
        { status: 400 },
      );
    }

    await connectDB();

    const existingCompany = await Company.findOne({ slug }).lean();

    if (existingCompany) {
      return NextResponse.json(
        {
          success: false,
          message: "A company with this slug already exists",
        },
        { status: 409 },
      );
    }

    const company = await Company.create({
      name,
      slug,
      status,
      senderEmails,
      allowedDomains,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Company created successfully",
        data: company,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request body" },
        { status: 400 },
      );
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      return NextResponse.json(
        { success: false, message: "Company slug already exists" },
        { status: 409 },
      );
    }

    console.error("POST /api/companies error:", error);

    return NextResponse.json(
      { success: false, message: "Failed to create company" },
      { status: 500 },
    );
  }
}
