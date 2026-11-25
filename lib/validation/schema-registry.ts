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
) {
  const schema = schemas[documentType.trim().toLowerCase()];
  // Unknown document types use configured required fields in the mapping,
  // rather than failing every row simply because no custom schema exists.
  return schema ? (schema.parse(value) as Record<string, unknown>) : value;
}
