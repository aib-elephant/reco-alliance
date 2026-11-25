export type ColumnMappings = Record<string, string[]>;

function normalizeHeader(header: string) {
  return header.normalize("NFKC").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function mapRow(
  row: Record<string, unknown>,
  mappings: ColumnMappings
): Record<string, unknown> {
  const originalHeaders = Object.keys(row);
  const normalizedHeaderLookup = new Map(
    originalHeaders.map((header) => [normalizeHeader(header), header])
  );

  const output: Record<string, unknown> = {};

  for (const [targetField, aliases] of Object.entries(mappings)) {
    for (const alias of aliases) {
      const actualHeader = normalizedHeaderLookup.get(normalizeHeader(alias));
      if (actualHeader !== undefined) {
        output[targetField] = row[actualHeader];
        break;
      }
    }
  }

  return output;
}

export function validateRequiredFields(
  row: Record<string, unknown>,
  requiredFields: string[]
): string[] {
  return requiredFields.filter((field) => {
    const value = row[field];
    return value === undefined || value === null || value === "";
  });
}
