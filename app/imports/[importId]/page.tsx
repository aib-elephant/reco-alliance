import ImportedTablesViewer from "@/components/Imports/ImportedTablesViewer";

export default async function ImportTablesPage({
  params,
}: {
  params: Promise<{ importId: string }>;
}) {
  const { importId } = await params;
  return <ImportedTablesViewer importId={importId} />;
}
