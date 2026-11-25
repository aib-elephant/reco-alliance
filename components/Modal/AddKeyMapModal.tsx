"use client";
import { useState } from "react";
import Modal from ".";
import { LuCircleX } from "react-icons/lu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CreateMappedField } from "@/lib/utils/types";
import { createField } from "@/lib/mutations/mappedKeyMutation";
import toast from "react-hot-toast";

interface AFProps {
  show: boolean;
  onClose: () => void;
}

const DEFAULT_FIELD = {
  source_field: "",
  mapped_columns: "",
  deleted_keys: "",
};

const AddFieldModal = ({ show, onClose }: AFProps) => {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState(DEFAULT_FIELD);

  const addKeyMutation = useMutation({
    mutationFn: createField,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mappedKeys"] });
      toast.success("Field created successfully!");
      setFormData(DEFAULT_FIELD);
      onClose();
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to create field";
      toast.error(errorMessage);
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleMappedKey = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.source_field.trim()) {
      toast.error("Source field is required.");
      return;
    }
    // if (companies && companies.some((c) => c.slug === formData.slug)) {
    //   toast.error("A company with this slug already exists.");
    //   return;
    // }

    const payload = {
      ...formData,
      mapped_columns: formData.mapped_columns.split(",").map((v) => v.trim()),
    };

    addKeyMutation.mutate(payload);
  };

  return (
    <Modal show={show} wrapperClassName="absolute right-0 top-0 h-full w-2/5">
      <div className="relative">
        <div className="absolute top-1 right-1">
          <button onClick={onClose} className="p-3 text-slate-400">
            <LuCircleX size={25} />
          </button>
        </div>

        <section
          aria-labelledby="add-company-heading"
          className="bg-white rounded-xl p-5 sm:p-6"
        >
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Add new field
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Create a new field to mapped other file header keys to source
              field
            </p>
          </div>

          <form
            className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end"
            onSubmit={handleMappedKey}
          >
            <div className="md:col-span-12">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Source Field <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="source_field"
                placeholder="e.g. Acme Corporation"
                value={formData.source_field}
                onChange={handleChange}
                required
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="md:col-span-12">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Sender Emails <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="mapped_columns"
                placeholder="e.g. example, example 1"
                value={formData.mapped_columns}
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
                <span>Create Field</span>
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
      </div>
    </Modal>
  );
};

export default AddFieldModal;
