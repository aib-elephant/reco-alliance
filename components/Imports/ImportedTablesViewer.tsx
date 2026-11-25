"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SourceTable = {
  _id: string;
  sheetName: string;
  tableIndex: number;
  headerRow: number;
  headers: string[];
  rowCount: number;
};
type SourceRow = {
  _id: string;
  rowNumber: number;
  rowType: "detail" | "subtotal" | "grand_total";
  rawData: Record<string, unknown>;
};
type ApiResult = {
  tables: SourceTable[];
  selectedTableId: string | null;
  rows: SourceRow[];
  page: number;
  limit: number;
  totalRows: number;
  error?: string;
};
function display(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function ImportedTablesViewer({ importId }: { importId: string }) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    fetch(`/api/imports/${encodeURIComponent(importId)}/tables?${params}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json()) as ApiResult;
        if (!response.ok) throw new Error(data.error ?? "Unable to fetch table data");
        return data;
      })
      .then((data) => { setResult(data); setError(""); })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to fetch table data");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [importId, page]);

  const current = result?.tables.find((table) => String(table._id) === result.selectedTableId);
  const pageCount = Math.max(1, Math.ceil((result?.totalRows ?? 0) / 50));
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <Link className="text-sm text-blue-700 underline" href="/imports">← Back to imports</Link>
        <h1 className="mt-3 text-2xl font-bold">Original imported table</h1>
        <p className="mt-1 text-sm text-slate-600">
          Only the first table is stored, including its subtotals and grand total.
          Only detail rows are mapped into invoice records; all original columns are shown here.
        </p>
      </div>

      {error && <p role="alert" className="text-red-700">{error}</p>}
      {loading && <p>Loading table data…</p>}
      {!loading && result && !result.tables.length && <p>No saved table data for this import.</p>}

      {!loading && current && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4 text-sm text-slate-600">
            {current.sheetName} · {current.headers.length} columns · {current.rowCount} original rows
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border-b p-3 whitespace-nowrap">Excel row</th>
                  <th className="border-b p-3 whitespace-nowrap">Kind</th>
                  {current.headers.map((header, index) => (
                    <th className="border-b p-3 whitespace-nowrap" key={`${header}:${index}`}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result?.rows.map((row) => (
                  <tr key={row._id} className={row.rowType !== "detail" ? "bg-amber-50" : "even:bg-slate-50"}>
                    <td className="border-b p-3">{row.rowNumber}</td>
                    <td className="border-b p-3">{row.rowType.replace("_", " ")}</td>
                    {current.headers.map((header, index) => (
                      <td className="border-b p-3" key={`${header}:${index}`}>{display(row.rawData[header])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t p-4 text-sm">
            <button type="button" disabled={page <= 1} onClick={() => setPage((v) => v - 1)}
              className="rounded border px-3 py-1 disabled:opacity-40">Previous</button>
            <span>Page {page} of {pageCount}</span>
            <button type="button" disabled={page >= pageCount} onClick={() => setPage((v) => v + 1)}
              className="rounded border px-3 py-1 disabled:opacity-40">Next</button>
          </div>
        </section>
      )}
    </main>
  );
}
