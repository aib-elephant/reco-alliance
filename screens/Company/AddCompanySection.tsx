"use client";

import { createCompany } from "@/lib/mutations/companiesMutation";
import { Company } from "@/lib/utils/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import toast from "react-hot-toast";

interface FormData {
  name: string;
  slug: string;
  status: "active" | "disabled";
  senderEmails: string;
  allowedDomains: string;
}

const AddCompanySection = ({
  companies,
  onClose,
}: {
  companies: Company[] | undefined;
  onClose?: () => void;
}) => {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<FormData>({
    name: "",
    slug: "",
    status: "active",
    senderEmails: "",
    allowedDomains: "",
  });
  const [isSlugEdited, setIsSlugEdited] = useState(false);

  const addCompanyMutation = useMutation({
    mutationFn: createCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Company added successfully!");
      setFormData({
        name: "",
        slug: "",
        status: "active",
        senderEmails: "",
        allowedDomains: "",
      });
      setIsSlugEdited(false);
      onClose && onClose();
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to add company";
      toast.error(errorMessage);
    },
  });

  const generateSlug = (text: string) =>
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === "name") {
      if (!isSlugEdited) {
        setFormData((prev) => ({
          ...prev,
          slug: generateSlug(value),
        }));
      }
    }

    if (name === "slug") {
      setIsSlugEdited(true);
      setFormData((prev) => ({
        ...prev,
        slug: generateSlug(value),
      }));
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddCompany = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.slug.trim()) {
      toast.error("Both company name and slug are required.");
      return;
    }
    if (companies && companies.some((c) => c.slug === formData.slug)) {
      toast.error("A company with this slug already exists.");
      return;
    }

    const payload = {
      ...formData,
      senderEmails: formData.senderEmails.split(",").map((e) => e.trim()),
      allowedDomains: formData.allowedDomains.split(",").map((a) => a.trim()),
    };

    addCompanyMutation.mutate(payload);
  };

  return (
    <section
      aria-labelledby="add-company-heading"
      className="bg-white rounded-xl p-5 sm:p-6"
    >
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">
          Add new company
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Create a new organization tenant. The URL slug will auto-generate from
          the name.
        </p>
      </div>

      <form
        className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end"
        onSubmit={handleAddCompany}
      >
        <div className="md:col-span-12">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Company name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            placeholder="e.g. Acme Corporation"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="md:col-span-12">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Company slug <span className="text-rose-500">*</span>
            </label>
            <span className="text-[11px] font-medium text-slate-400">
              Auto-generated
            </span>
          </div>
          <div className="flex rounded-lg shadow-sm overflow-hidden border border-slate-300">
            {/* <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 text-slate-500 text-xs font-mono select-none">
              app.io/
            </span> */}
            <input
              type="text"
              name="slug"
              placeholder="acme-corporation"
              required
              value={formData.slug}
              onChange={handleChange}
              className="flex-1 min-w-0 block w-full px-3 py-2.5 rounded-none rounded-r-lg text-sm font-mono text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>
        <div className="md:col-span-12">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Sender Emails <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            name="senderEmails"
            placeholder="e.g. example@test.com, example@test.com"
            value={formData.senderEmails}
            onChange={handleChange}
            required
            className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
          />
        </div>
        <div className="md:col-span-12">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Allow Domains <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            name="allowedDomains"
            placeholder="e.g. test.com, example.com"
            value={formData.allowedDomains}
            onChange={handleChange}
            required
            className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="md:col-span-4">
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-900/90 focus:outline-none transition-all cursor-pointer"
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
            <span>Add company</span>
          </button>
        </div>
        {/* {error && (
          <div className=" col-span-12 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
            <LuCircleAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )} */}
      </form>
    </section>
  );
};

export default AddCompanySection;
