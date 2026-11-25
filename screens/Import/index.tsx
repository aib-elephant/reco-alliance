"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LuCircleAlert } from "react-icons/lu";
import { avatarPalettes, getInitials } from "@/lib/utils";
import { HiDocumentArrowDown } from "react-icons/hi2";
import { HiOutlineUpload } from "react-icons/hi";
import Select from "@/components/Ui/Select";
import Input, { FileInput } from "@/components/Ui/Input";
import { Company, Job } from "@/lib/utils/types";

const ImportScreen = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<{
    label: string;
    value: any;
  } | null>(null);
  const [documentType, setDocumentType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [review, setReview] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "archived" | "draft"
  >("all");

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((b) => {
        setCompanies(b.data ?? []);
      })
      .catch((e) => setMessage(String(e)));
  }, []);

  useEffect(() => {
    if (!selectedCompany) {
      setJobs([]);
      return;
    }
    fetch(`/api/imports?companyId=${encodeURIComponent(selectedCompany.value)}`)
      .then((r) => r.json())
      .then((b) => setJobs(b.data ?? []))
      .catch((e) => setMessage(String(e)));
  }, [selectedCompany]);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file || !selectedCompany) return;
    setBusy(true);
    setMessage("");
    setReview("");
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("File exceeds 10 MB");
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const response = await fetch("/api/imports/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: selectedCompany.value,
          documentType,
          fileName: file.name,
          contentBase64: btoa(binary),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Upload failed");
      if (data.status === "mapping_review_required") {
        setReview(
          `/companies/${selectedCompany.value}/mappings/${data.mappingId}`,
        );
        setMessage(
          "New file layout detected. Review and approve the mapping, then upload this file again.",
        );
      } else {
        setMessage(
          `Import ${data.status}: ${data.successfulRows} successful rows, ${data.failedRows} failed rows.`,
        );
        const jobsResponse = await fetch(
          `/api/imports?companyId=${selectedCompany.value}`,
        );
        setJobs((await jobsResponse.json()).data ?? []);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200/80 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Manual CSV / Excel Import
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Choose a company, enter the document type, and upload a CSV or XLSX
            file. New layouts require mapping approval before importing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/companies"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 hover:text-slate-900 focus:outline-none transition-all"
          >
            <HiOutlineUpload size={18} className="text-slate-500" />
            <span className="whitespace-nowrap">Go to Company</span>
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

      <section className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/90 shadow-sm overflow-hidden">
        <div>
          <form
            onSubmit={upload}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end"
          >
            <div>
              <Select
                label="Select Company"
                required
                value={selectedCompany}
                options={companies
                  .filter((c) => c.status === "active")
                  .map((c) => ({ label: c.name, value: c._id }))}
                onSelect={(val) => setSelectedCompany(val)}
              />
            </div>
            <div>
              <Input
                label="Document Type"
                type="text"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                required
              />
            </div>
            <div className="md:col-span-2">
              <FileInput
                label="Upload CSV or XLSX"
                fileData={file}
                accept=".csv,.xlsx"
                required
                hidden
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={busy || !file || !selectedCompany}
                className="w-2/5 px-4 py-2.5 text-sm font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-900/90 transition-all cursor-pointer"
              >
                {busy ? "Processing..." : "Upload and process"}
              </button>
            </div>
            {message && (
              <div className=" col-span-2 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                <LuCircleAlert className="w-4 h-4 shrink-0" />
                <span>{message}</span>
              </div>
            )}

            {review && (
              <Link className="font-bold text-blue-700 underline" href={review}>
                Review detected mapping
              </Link>
            )}
          </form>
        </div>
      </section>

      <section
        aria-labelledby="companies-list-heading"
        className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden"
      >
        <div className="p-4 sm:px-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white">
          <div className="flex items-center gap-2.5">
            <h2
              id="companies-list-heading"
              className="text-base font-semibold text-slate-900"
            >
              Recent imports
            </h2>
            <span
              id="company-count-badge"
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/70"
            >
              {jobs.length} total
            </span>
          </div>

          {/* <!-- Search & Status Filter Controls --> */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg
                  className="h-4 w-4 text-slate-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
              </div>
              <input
                type="text"
                id="search-input"
                placeholder="Search name or slug..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 pl-9 pr-3 py-1.5 text-sm text-slate-900 bg-slate-50/70 border border-slate-300 rounded-lg placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-lg self-start sm:self-auto">
              {(["all", "active", "archived", "draft"] as const).map(
                (status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-all cursor-pointer ${
                      statusFilter === status
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {status}
                  </button>
                ),
              )}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50/80">
              <tr>
                <th
                  scope="col"
                  className="py-3.5 pl-4 pr-3 sm:pl-6 text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  File
                </th>
                <th
                  scope="col"
                  className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  Type
                </th>
                <th
                  scope="col"
                  className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="py-3.5 pl-3 pr-4 sm:pr-6 text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  Rows
                </th>
              </tr>
            </thead>
            <tbody
              id="companies-table-body"
              className="divide-y divide-slate-200/80 bg-white"
            >
              {jobs.map((job, i) => {
                return (
                  <tr
                    key={job._id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    <td className="py-3.5 pl-4 pr-3 sm:pl-6 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-semibold shrink-0 ${avatarPalettes[i % avatarPalettes.length]}`}
                        >
                          {getInitials(job.attachmentName)}
                        </div>
                        <span className="text-sm font-medium text-slate-900">
                          {job.attachmentName}
                        </span>
                        {job.tableCount ? (
                          <Link
                            className="text-xs text-blue-700 underline"
                            href={`/imports/${job._id}`}
                          >
                            View original table
                          </Link>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 bg-slate-100/90 hover:bg-slate-200/70 border border-slate-200/80 rounded-md px-2.5 py-1 transition-colors">
                        <code className="text-xs font-mono text-slate-700">
                          {job.documentType}
                        </code>
                        {/* <button
                        type="button"
                        onClick={() =>
                          handleCopySlug(company._id, company.slug)
                        }
                        title="Copy slug"
                        className="text-slate-400 hover:text-indigo-600 focus:outline-none p-0.5 rounded transition-colors cursor-pointer"
                      >
                        {copiedId === company._id ? (
                          <LuCheck className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <LuCopy className="w-3.5 h-3.5" />
                        )}
                      </button> */}
                      </div>
                    </td>

                    <td className="px-3 py-3.5 whitespace-nowrap">
                      {job.status === "active" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Active
                        </span>
                      ) : job.status === "archived" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-emerald-700 border border-blue-200/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                          Archived
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                          Draft
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 pl-3 pr-4 sm:pr-6 whitespace-nowrap text-sm font-medium">
                      {job.successfulRows}/{job.totalRows} mapped
                      {job.savedTableRows !== undefined && (
                        <div className="text-xs font-normal text-slate-500">
                          {job.savedTableRows} source rows
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 pl-3 pr-4 sm:pr-6 whitespace-nowrap text-right text-sm font-medium">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          type="button"
                          // onClick="openDeleteModal('${company.id}')"
                          title="Delete company"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                        >
                          <svg
                            className="w-4 h-4"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="1.8"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {jobs.length === 0 && (
          <div className=" py-12 px-4 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <HiDocumentArrowDown size={24} className="text-slate-400" />
            </div>
            <h3 className="text-sm font-medium text-slate-900">
              No imports found
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Try adjusting your search or filter, or add a new import above.
            </p>
            <button
              id="reset-filters-btn"
              type="button"
              className="mt-4 inline-flex items-center px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors"
            >
              Clear search & filters
            </button>
          </div>
        )}
      </section>
    </main>
  );
};

export default ImportScreen;
