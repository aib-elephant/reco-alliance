export function normalizeValues(row: Record<string, unknown>) {
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    if (typeof value === "string") {
      output[key] = value.trim();
    } else {
      output[key] = value;
    }
  }

  // Extend with explicit, document-type-specific date/decimal/currency conversions.
  return output;
}
