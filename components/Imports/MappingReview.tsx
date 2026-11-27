"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CANONICAL_FIELDS } from "@/lib/import/canonical-fields";
import Link from "next/link";
import Select from "../Ui/Select";
import { LuCircleAlert, LuCircleCheck } from "react-icons/lu";
import Input from "../Ui/Input";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getMappedKeys } from "@/lib/queries/mappedKeyQuery";

type MappingDraft = {
  id: string;
  companyId: string;
  documentType: string;
  version: number;
  status: "draft" | "active" | "archived";
  format: "csv" | "xlsx";
  formatFingerprint: string;
  detectedHeaders: string[];
  columnMappings: Record<string, string[]>;
  requiredFields: string[];
  fileRules: {
    headerRow: number;
    dataStartRow?: number;
    sheetName?: string;
    delimiter?: string;
    stopAtLabels?: string[];
  };
};

type Props = {
  companyId: string;
  mappingId: string;
  onApproved?: (mappingId: string) => void;
};

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export default function MappingReview({
  companyId,
  mappingId,
  onApproved,
}: Props) {
  const [draft, setDraft] = useState<MappingDraft | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [headerRow, setHeaderRow] = useState(1);
  const [dataStartRow, setDataStartRow] = useState(2);
  const [stopLabels, setStopLabels] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { data: mappedKeys, isPending: mappedKeysPending } = useQuery({
    queryKey: ["mappedKeys"],
    queryFn: getMappedKeys,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const lookup = useMemo(() => {
    const mapped = new Map<string, string>();

    for (const { mapped_columns, source_field } of mappedKeys?.data ?? []) {
      for (const col of mapped_columns) {
        mapped.set(normalize(col.key), source_field);
      }
    }

    return mapped;
  }, [mappedKeys?.data]);

  const endpoint =
    `/api/companies/${encodeURIComponent(companyId)}` +
    `/mappings/${encodeURIComponent(mappingId)}`;

  const loadDraft = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to load mapping");
      }

      const data = body as MappingDraft;
      setDraft(data);

      // const initial: Record<string, string> = {};

      // for (const field of CANONICAL_FIELDS) {
      //   const aliases = data.columnMappings[field.key] ?? [];

      //   const match = data.detectedHeaders.find((header) => {
      //     const mappedKey = lookup.get(normalize(header));
      //     return aliases.some((alias) => normalize(alias) === mappedKey);
      //   });

      //   initial[field.key] = match ?? "";
      // }

      // setSelected(initial);
      setHeaderRow(data.fileRules.headerRow);
      setDataStartRow(
        data.fileRules.dataStartRow ?? data.fileRules.headerRow + 1,
      );
      setStopLabels((data.fileRules.stopAtLabels ?? []).join("\n"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load mapping");
    } finally {
      setLoading(false);
    }
  }, [endpoint, lookup]);

  useEffect(() => {
    void loadDraft();
  }, [loadDraft]);

  const initializedDraft = useRef<MappingDraft | null>(null);

  useEffect(() => {
    if (!draft || mappedKeysPending) return;
    if (initializedDraft.current === draft) return; // run once per loaded draft
    initializedDraft.current = draft;

    const initial: Record<string, string> = {};
    const used = new Set<string>(); // don't assign one header to two fields

    for (const field of CANONICAL_FIELDS) {
      const fieldNames = [normalize(field.key), normalize(field.label)];
      const aliases = draft.columnMappings[field.key] ?? [];

      const match = draft.detectedHeaders.find((header) => {
        if (!header || used.has(header)) return false;

        const h = normalize(header);

        // 1. header -> source_field (from mappedKeys) equals the canonical key/label
        const sourceField = lookup.get(h);
        if (sourceField && fieldNames.includes(normalize(sourceField)))
          return true;

        // 2. header already equals the canonical key/label
        if (fieldNames.includes(h)) return true;

        // 3. header matches a saved alias for this field
        return aliases.some((alias) => normalize(alias) === h);
      });

      if (match) used.add(match);
      initial[field.key] = match ?? "";
    }

    setSelected(initial);
  }, [draft, lookup, mappedKeysPending]);

  const required = useMemo(() => new Set(draft?.requiredFields ?? []), [draft]);

  const assigned = useMemo(
    () => Object.values(selected).filter(Boolean),
    [selected],
  );

  const duplicates = useMemo(() => {
    const counts = new Map<string, number>();

    for (const source of assigned) {
      const key = normalize(source);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([key]) => key);
  }, [assigned]);

  const missingRequired = useMemo(
    () => [...required].filter((field) => !selected[field]),
    [required, selected],
  );

  const unmappedHeaders = useMemo(
    () =>
      (draft?.detectedHeaders ?? []).filter(
        (header) => !assigned.includes(header),
      ),
    [draft, assigned],
  );

  const valid =
    draft?.status === "draft" &&
    assigned.length > 0 &&
    duplicates.length === 0 &&
    missingRequired.length === 0 &&
    Number.isInteger(headerRow) &&
    headerRow >= 1 &&
    Number.isInteger(dataStartRow) &&
    dataStartRow > headerRow;

  async function approve() {
    if (!draft || !valid || saving) return;

    setSaving(true);
    setError("");
    setSuccess("");

    const columnMappings: Record<string, string[]> = {};

    for (const [field, source] of Object.entries(selected)) {
      if (source) {
        columnMappings[field] = [source];
      }
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          columnMappings,
          requiredFields: draft.requiredFields,
          fileRules: {
            headerRow,
            dataStartRow,
            stopAtLabels: stopLabels
              .split("\n")
              .map((value) => value.trim())
              .filter(Boolean),
          },
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Approval failed");
      }

      setSuccess("Mapping approved. Future matching files can reuse it.");
      setDraft((current) =>
        current ? { ...current, status: "active" } : current,
      );
      onApproved?.(body.mappingId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="p-6 text-sm">Loading mapping review...</p>;
  }

  if (!draft) {
    return (
      <div className="rounded-lg border p-6 text-red-600">
        {error || "Mapping not found"}
      </div>
    );
  }

  const fields = draft.detectedHeaders
    .filter(Boolean)
    .map((h) => ({ label: h, value: h }));

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200/80 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl flex items-center gap-2 font-bold tracking-tight text-slate-900">
            <span>Review File Mapping</span>
            {draft.status === "active" ? (
              <strong className="text-emerald-400 text-sm tracking-wide font-semibold bg-emerald-100 px-1 py-0.5 rounded capitalize">
                {draft.status}
              </strong>
            ) : (
              <strong className="text-amber-400 text-sm tracking-wide font-semibold bg-amber-100 px-1 py-0.5 rounded capitalize">
                {draft.status}
              </strong>
            )}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {draft.documentType} · {draft.format.toUpperCase()} · Version{" "}
            {draft.version}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/imports"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 hover:text-slate-900 focus:outline-none transition-all"
          >
            <svg
              className="w-4 h-4 text-slate-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            <span className="whitespace-nowrap">Go to Imports</span>
          </Link>
          {/* <button
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-900/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 active:bg-indigo-800 transition-all cursor-pointer"
            onClick={() => setAddCompanyModal(true)}
          >
            <svg
              className="w-4 h-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            <span className=" whitespace-nowrap">Add company</span>
          </button> */}
        </div>
      </header>

      <section className="bg-white rounded-xl p-5 sm:p-6  border border-slate-200/90 shadow-sm overflow-hidden">
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          Detected File Format
        </h2>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <span className="text-sm text-gray-500">Worksheet</span>
            <p>{draft.fileRules.sheetName ?? "CSV file"}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Detected Columns</span>
            <p>{draft.detectedHeaders.length}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Assigned Fields</span>
            <p>{assigned.length}</p>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-slate-200/90 shadow-sm">
        <div className="p-4 sm:px-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-t-xl">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Column Mapping
            </h2>
            <p className="text-sm text-gray-500">
              Confirm which source column supplies each field. Unused columns
              can remain unmapped.
            </p>
          </div>
        </div>

        <div className="rounded-b-xl">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50/80">
              <tr>
                <th
                  scope="col"
                  className="py-3.5 pl-4 pr-3 sm:pl-6 text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  Canonical Field
                </th>
                <th
                  scope="col"
                  className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  Source Column
                </th>
                <th
                  scope="col"
                  className="py-3.5 pl-3 pr-4 sm:pr-6 text-right text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  Requirement
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 bg-white">
              {CANONICAL_FIELDS.map((field) => {
                const value = selected[field.key] ?? "";
                const duplicate = duplicates.includes(normalize(value));

                return (
                  <tr
                    key={field.key}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    <td className="py-3.5 pl-4 pr-3 sm:pl-6 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-900">
                        {field.label}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <Select
                        label={field.label}
                        disabled={draft.status !== "draft"}
                        options={fields}
                        value={
                          draft
                            ? (fields?.find((f) => f.value === value) as {
                                label: string;
                                value: any;
                              })
                            : null
                        }
                        onSelect={(event: any) =>
                          setSelected((current) => ({
                            ...current,
                            [field.key]: event.value,
                          }))
                        }
                      />
                      {duplicate && (
                        <div className=" col-span-6 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                          <LuCircleAlert className="w-4 h-4 shrink-0" />
                          <span>Already assigned to another field</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 pl-3 pr-4 sm:pr-6 whitespace-nowrap text-right text-sm font-medium">
                      {required.has(field.key) ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          Required
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                          Optional
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white rounded-xl p-5 sm:p-6  border border-slate-200/90 shadow-sm overflow-hidden">
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          File Parsing Rules
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Input
              label="Header Row"
              type="number"
              min={1}
              value={headerRow}
              disabled={draft.status !== "draft"}
              onChange={(event) => setHeaderRow(event.target.valueAsNumber)}
              readOnly
              inputClassName="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Input
              label="First Data Row"
              type="number"
              min={2}
              value={dataStartRow}
              disabled={draft.status !== "draft"}
              onChange={(event) => setDataStartRow(event.target.valueAsNumber)}
              inputClassName="text-sm"
            />
          </div>
        </div>

        <label className="mt-4 block space-y-1 text-sm">
          <span className="bg-white translate-y-2.25 text-gray translate-x-0.75 text-xs px-0.75 inline-block relative z-10">
            Stop at Summary/Footer Labels
          </span>
          <textarea
            value={stopLabels}
            disabled={draft.status !== "draft"}
            onChange={(event) => setStopLabels(event.target.value)}
            rows={4}
            placeholder={"Grand Total\nNet Payable\nSummary"}
            className="w-full rounded-md border border-light-gray p-2"
          />
          <span className="block text-xs text-gray-500">
            One exact label per line. The import parser must enforce these
            rules.
          </span>
        </label>
      </section>

      <section className="bg-white rounded-xl p-5 sm:p-6  border border-slate-200/90 shadow-sm overflow-hidden">
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          Unmapped Source Columns ({unmappedHeaders.length})
        </h2>

        <div className="flex flex-wrap gap-2">
          {unmappedHeaders.length ? (
            unmappedHeaders.map((header) => (
              <span
                key={header}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                {header}
              </span>
            ))
          ) : (
            <p className="text-sm text-gray-500">
              All detected columns have assignments.
            </p>
          )}
        </div>
      </section>

      {missingRequired.length > 0 && (
        <div className=" col-span-6 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          <LuCircleAlert className="w-4 h-4 shrink-0" />
          <span>Missing required fields: {missingRequired.join(", ")}</span>
        </div>
      )}
      {error && (
        <div className=" col-span-6 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          <LuCircleAlert className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div
          role="status"
          className=" col-span-6 flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg"
        >
          <LuCircleCheck className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => void loadDraft()}
          className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 hover:text-slate-900 focus:outline-none transition-all"
        >
          Reload
        </button>

        <button
          type="button"
          disabled={!valid || saving}
          onClick={() => void approve()}
          className="px-4 py-2.5 disabled:cursor-not-allowed text-sm font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-900/90 focus:outline-none transition-all cursor-pointer"
        >
          {saving ? "Approving..." : "Approve Mapping"}
        </button>
      </div>
    </div>
  );
}
