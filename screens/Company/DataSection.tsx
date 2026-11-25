"use client";

import { useState } from "react";
import { LuCheck, LuCopy } from "react-icons/lu";
import { avatarPalettes, getInitials } from "@/lib/utils";
import { HiOutlineBuildingOffice2 } from "react-icons/hi2";
import { Company } from "@/lib/utils/types";

const DataTableSection = ({
  companies,
}: {
  companies: Company[] | undefined;
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);

  const escapeHtml = (unsafe: any) => {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const handleCopySlug = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // const toggleStatus = (id: string) => {
  //   setCompanies((prev) =>
  //     prev.map((c) =>
  //       c._id === id
  //         ? { ...c, status: c.status === "active" ? "inactive" : "active" }
  //         : c,
  //     ),
  //   );
  // };

  const filteredCompanies = companies
    ? companies.filter((c) => {
        const matchesSearch =
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.slug.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus =
          statusFilter === "all" || c.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
    : [];

  return (
    <section
      aria-labelledby="companies-list-heading"
      className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden"
    >
      {/* <!-- Table Toolbar (Title, Count Badge, Search & Filter) --> */}
      <div className="p-4 sm:px-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white">
        <div className="flex items-center gap-2.5">
          <h2
            id="companies-list-heading"
            className="text-base font-semibold text-slate-900"
          >
            Registered Organizations
          </h2>
          <span
            id="company-count-badge"
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/70"
          >
            {filteredCompanies.length} total
          </span>
        </div>

        {/* <!-- Search & Status Filter Controls --> */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* <!-- Search Input --> */}
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

          {/* <!-- Status Filter Select --> */}
          <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-lg self-start sm:self-auto">
            {(["all", "active", "inactive"] as const).map((status) => (
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
            ))}
          </div>
        </div>
      </div>

      {/* <!-- Responsive Table Wrapper --> */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50/80">
            <tr>
              <th
                scope="col"
                className="py-3.5 pl-4 pr-3 sm:pl-6 text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Name
              </th>
              <th
                scope="col"
                className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Slug
              </th>
              <th
                scope="col"
                className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Status
              </th>
              <th
                scope="col"
                className="py-3.5 pl-3 pr-4 sm:pr-6 text-right text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody
            id="companies-table-body"
            className="divide-y divide-slate-200/80 bg-white"
          >
            {filteredCompanies.map((company, i) => {
              const isActive = company.status === "active";
              return (
                <tr
                  key={i}
                  className="hover:bg-slate-50/80 transition-colors group"
                >
                  <td className="py-3.5 pl-4 pr-3 sm:pl-6 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-semibold shrink-0 ${avatarPalettes[i % avatarPalettes.length]}`}
                      >
                        {getInitials(company.name)}
                      </div>
                      <span className="text-sm font-medium text-slate-900">
                        {escapeHtml(company.name)}
                      </span>
                    </div>
                  </td>

                  <td className="px-3 py-3.5 whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5 bg-slate-100/90 hover:bg-slate-200/70 border border-slate-200/80 rounded-md px-2.5 py-1 transition-colors">
                      <code className="text-xs font-mono text-slate-700">
                        {escapeHtml(company.slug)}
                      </code>
                      <button
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
                      </button>
                    </div>
                  </td>

                  <td className="px-3 py-3.5 whitespace-nowrap">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        Inactive
                      </span>
                    )}
                  </td>

                  <td className="py-3.5 pl-3 pr-4 sm:pr-6 whitespace-nowrap text-right text-sm font-medium">
                    <div className="inline-flex items-center justify-end gap-2">
                      <button
                        type="button"
                        // onClick={() => toggleStatus(company._id)}
                        className="px-2.5 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                                    isActive 
                                    ? 'text-slate-600 bg-white border-slate-200 hover:bg-slate-50 hover:text-slate-900' 
                                    : 'text-emerald-700 bg-emerald-50/60 border-emerald-200 hover:bg-emerald-100/80'
                                }"
                      >
                        {isActive ? "Deactivate" : "Activate"}
                      </button>
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

      {/* <!-- Empty State (Hidden by default) --> */}
      {filteredCompanies.length === 0 && (
        <div className=" py-12 px-4 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <HiOutlineBuildingOffice2 size={24} className="text-slate-400" />
          </div>
          <h3 className="text-sm font-medium text-slate-900">
            No companies found
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Try adjusting your search or filter, or add a new company above.
          </p>
          <button
            id="reset-filters-btn"
            type="button"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("all");
            }}
            className="mt-4 inline-flex items-center px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors"
          >
            Clear search & filters
          </button>
        </div>
      )}
    </section>
  );
};

export default DataTableSection;
