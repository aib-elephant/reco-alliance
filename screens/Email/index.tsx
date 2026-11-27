"use client";

import Card from "@/components/Card";
import PageHeading from "@/components/PageHeading";
import Button from "@/components/Ui/Button";
import { Connection, EmailJob, Unmatched } from "@/lib/utils/types";
import { useEffect, useState } from "react";
import { HiOutlineRefresh } from "react-icons/hi";
import { MdOutlineAttachEmail, MdOutlineRefresh } from "react-icons/md";
import { BsEnvelopeSlash } from "react-icons/bs";

const EmailPageScreen = () => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [jobs, setJobs] = useState<EmailJob[]>([]);
  const [unmatched, setUnmatched] = useState<Unmatched[]>([]);
  const [documentType, setDocumentType] = useState("invoice");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const [connectionResponse, jobsResponse] = await Promise.all([
        fetch("/api/email/connections", { cache: "no-store" }),
        fetch("/api/email/jobs", { cache: "no-store" }),
      ]);
      if (!connectionResponse.ok || !jobsResponse.ok)
        throw new Error("Could not load email data (check authorization)");
      const connectionData = await connectionResponse.json();
      const jobData = await jobsResponse.json();
      setConnections(connectionData.data ?? []);
      setJobs(jobData.jobs ?? []);
      setUnmatched(jobData.unmatched ?? []);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not load email status",
      );
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected"))
      setMessage(`Connected: ${params.get("connected")}`);
    if (params.get("error")) setMessage(params.get("error") ?? "OAuth error");
    void load();
  }, []);

  async function action(url: string, id: string) {
    setBusy(id);
    setMessage("");
    try {
      const response = await fetch(url, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Action failed");
      setMessage(
        `Result: ${result.status ?? "accepted"}${result.scanned === undefined ? "" : `; ${result.scanned} messages scanned, ${result.completed} attachments imported, ${result.needsReview} require review, ${result.failed} failed`}`,
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-7">
      <PageHeading
        name="Automated Email Extraction"
        subtitle="Connect a mailbox, import CSV/XLSX attachments, and review new
          spreadsheet layouts. A mailbox can receive files for multiple
          companies; routing uses each company's sender rules."
        actionButtons={[
          {
            name: "Home",
            type: "link",
            url: "/",
          },
          {
            name: "Companies",
            type: "link",
            url: "/companies",
          },
          {
            name: "Import",
            type: "link",
            url: "/imports",
          },
        ]}
      />

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <h2 className="font-semibold text-xl">Connect a mailbox</h2>
          {/* <p className="text-sm text-slate-600">
            Set the document type to match your mapping configuration, then
            authorize read-only email access. No mailbox password is stored.
          </p> */}
          <label className="hidden text-sm font-medium text-slate-700">
            Document type
            <input
              className="mt-1 block w-full max-w-xs rounded border border-slate-300 px-3 py-2"
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
              placeholder="invoice"
            />
          </label>
          <div className="flex flex-wrap gap-3 my-4">
            <Button
              name="Connect Gmail"
              type="link"
              url={`/api/email/oauth/gmail/start?documentType=${encodeURIComponent(documentType || "invoice")}`}
              variant="filled"
            />

            <Button
              name="Connect Microsoft 365"
              type="link"
              url={`/api/email/oauth/microsoft/start?documentType=${encodeURIComponent(documentType || "invoice")}`}
              variant="filled"
            />
          </div>
          <p className="text-xs text-slate-500">
            Requires provider OAuth credentials, a 32-byte mailbox encryption
            key, and development administrator access. Production needs
            session-based authentication.
          </p>
        </Card>
        <Card>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="font-semibold text-xl">Connected mailboxes</h2>
            <Button
              type="button"
              name="Refresh"
              className="text-xs gap-1 py-1 px-1.5 bg-blue-900/5 text-blue-900/70 border-blue-900/10 hover:text-blue-900 hover:bg-blue-700/5"
              icon={MdOutlineRefresh}
              iconSize={16}
              onClick={() => void load()}
            />
          </div>
          {connections.length === 0 ? (
            <div className="py-6 px-4 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <BsEnvelopeSlash size={24} className="text-slate-400" />
              </div>
              <h3 className="text-sm font-medium text-slate-900">
                No connected mailboxes yet.
              </h3>
            </div>
          ) : (
            <div className="space-y-3">
              {connections.map((connection) => (
                <div
                  key={connection._id}
                  className="flex flex-wrap items-center justify-between gap-3 bg-green-50 border border-green-200 rounded-lg py-2 px-3"
                >
                  <div className="text-sm">
                    <p className="font-medium mb-1 inline-block text-slate-800 rounded-md">
                      {connection.mailboxAddress}
                    </p>
                    <p className="text-green-600 capitalize text-xs">
                      {connection.provider} ·{" "}
                      {/* {connection.documentType || "invoice"} ·{" "} */}
                      {/* {connection.status} ·  */}
                      Last sync:{" "}
                      {connection.lastSyncedAt
                        ? new Date(connection.lastSyncedAt).toLocaleString()
                        : "Never"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    name={busy === connection._id ? "Syncing…" : "Sync"}
                    onClick={() =>
                      void action(
                        `/api/email/connections/${connection._id}/sync`,
                        connection._id,
                      )
                    }
                    disabled={Boolean(busy)}
                    icon={HiOutlineRefresh}
                    className={
                      "text-xs py-1 px-2 border-emerald-200 shadow-none"
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {message && (
        <p
          role="status"
          className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700 font-medium"
        >
          {message}
        </p>
      )}

      <Card classname="sm:p-0 overflow-hidden">
        <div className="p-4 sm:px-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white">
          <div className="flex items-center gap-2.5">
            <h2
              id="companies-list-heading"
              className="text-base font-semibold text-slate-900"
            >
              Email attachment import jobs
            </h2>
            <span
              id="job-count-badge"
              className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium bg-blue-900/10 text-blue-900 border border-blue-900/30"
            >
              {jobs.length} total
            </span>
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
                  Attachment
                </th>
                <th
                  scope="col"
                  className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  Rows
                </th>
                <th
                  scope="col"
                  className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 bg-white">
              {jobs.map((job) => (
                <tr
                  key={job._id}
                  className="hover:bg-slate-50/80 transition-colors group"
                >
                  <td className="py-3.5 pl-4 pr-3 sm:pl-6 whitespace-nowrap capitalize">
                    <p className="text-sm font-medium text-slate-900">
                      {job.attachmentName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {job.provider} ·{" "}
                      {new Date(job.createdAt).toLocaleString()}
                    </p>
                  </td>
                  <td className="px-3 py-3.5 whitespace-nowrap">
                    <p className="text-sm font-medium text-slate-400 capitalize">
                      {job.status}
                    </p>
                  </td>
                  <td className="px-3 py-3.5 whitespace-nowrap">
                    <p className="text-sm font-medium text-slate-400 capitalize">
                      {job.successfulRows || 0} / {job.failedRows || 0} (success
                      / failed)
                    </p>
                  </td>
                  <td className="py-3.5 pl-3 pr-4 sm:pr-6 whitespace-nowrap">
                    {job.status === "needs_review" &&
                    job.companyId &&
                    job.mappingConfigId ? (
                      <Button
                        type="link"
                        name="Review Mapping"
                        variant="filled"
                        className="px-2 py-1 font-normal mr-3 text-xs"
                        url={`/companies/${job.companyId}/mappings/${job.mappingConfigId}`}
                      />
                    ) : null}
                    {["needs_review", "failed"].includes(job.status) &&
                    job.companyId ? (
                      <Button
                        type="button"
                        name={busy === job._id ? "Retrying…" : "Retry"}
                        className="px-2 py-1 font-normal mr-3 text-xs"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          void action(
                            `/api/email/imports/${job._id}/retry`,
                            job._id,
                          )
                        }
                      />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {jobs.length === 0 && (
            <div className=" py-12 px-4 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <MdOutlineAttachEmail size={24} className="text-slate-400" />
              </div>
              <h3 className="text-sm font-medium text-slate-900">
                No email attachments imported yet.
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Try to re-sync email, or wait for new email.
              </p>
            </div>
          )}
        </div>
      </Card>

      {unmatched.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-white p-5 space-y-2">
          <h2 className="font-semibold text-xl">
            Emails without a company match
          </h2>
          <p className="text-sm text-slate-600">
            Update company sender-email or allowed-domain rules, then rescan the
            email. These messages were not imported.
          </p>
          {unmatched.map((email) => (
            <p key={email._id} className="text-sm border-b py-2">
              {email.sender || "Unknown sender"} ·{" "}
              {email.subject || "No subject"} — {email.lastError}{" "}
              <button
                disabled={Boolean(busy)}
                onClick={() =>
                  void action(
                    `/api/email/messages/${email._id}/retry`,
                    email._id,
                  )
                }
                className="ml-3 text-blue-900 underline disabled:opacity-50"
              >
                {busy === email._id ? "Retrying…" : "Retry routing"}
              </button>
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmailPageScreen;
