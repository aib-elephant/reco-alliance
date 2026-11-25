import { z } from "zod";

const InvoiceSchema = z
  .object({
    // customerName: z.string().trim().min(1),
    // invoiceNumber: z.string().trim().min(1),
    // netAmount: z.coerce.number(),
    "Policy Number": z.string().trim().min(1),
    "Co-Insurer: Insurer Name": z.string().trim(),
    "Share Premium": z.number().min(1),
    "Co-Insurer: Total Brokerage": z.number().min(1),
    "Total Brokerage": z.number().min(1),
    "R C Date": z.date(),
    "Expiry Date": z.date(),
  })
  .loose();

const schemas: Record<string, z.ZodTypeAny> = { invoice: InvoiceSchema };
export function validateNormalizedRecord(
  documentType: string,
  value: Record<string, unknown>,
  options: { mappedFields?: string[] } = {},
) {
  const type = documentType.trim().toLowerCase();
  const schema = schemas[type];
  if (!schema) return value;

  // This legacy schema only applies to the exact co-insurance invoice format.
  // An invoice report with different columns must use its approved per-file
  // requiredFields rules rather than rejecting every row as a schema mismatch.
  if (type === "invoice") {
    const requiredSchemaFields = Object.keys(InvoiceSchema.shape);
    const mapped = new Set(options.mappedFields ?? Object.keys(value));
    if (!requiredSchemaFields.every((field) => mapped.has(field))) return value;
  }
  return schema.parse(value) as Record<string, unknown>;
}
