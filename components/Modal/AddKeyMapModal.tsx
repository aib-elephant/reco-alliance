"use client";
import { useState } from "react";
import Modal from ".";
import { LuCircleX } from "react-icons/lu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createField } from "@/lib/mutations/mappedKeyMutation";
import toast from "react-hot-toast";
import { Company } from "@/lib/utils/types";
import Select from "../Ui/Select";
import Input from "../Ui/Input";

interface AFProps {
  show: boolean;
  onClose: () => void;
  companies: Company[];
}

const AddFieldModal = ({ show, onClose, companies }: AFProps) => {
  const queryClient = useQueryClient();

  const [sourceField, setSourceField] = useState("");
  const [fieldKey, setFieldKey] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<{
    label: string;
    value: string;
  } | null>(null);

  const addKeyMutation = useMutation({
    mutationFn: createField,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mappedKeys"] });
      toast.success("Field created successfully!");
      setSourceField("");
      setFieldKey("");
      setSelectedCompany(null);
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

  const handleMappedKey = (e: React.FormEvent) => {
    e.preventDefault();

    if (!sourceField.trim()) {
      toast.error("Source field is required.");
      return;
    }
    const payload = {
      source_field: sourceField,
      mapped_columns: [{ key: fieldKey, companyId: selectedCompany?.value! }],
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
              <Input
                label="Source Field"
                value={sourceField}
                onChange={(e) => setSourceField(e.target.value)}
                required
              />
            </div>

            <div className="md:col-span-12">
              <Select
                label="Company"
                options={
                  companies.map((c) => ({
                    label: c.name,
                    value: c._id,
                  })) as { label: string; value: string }[]
                }
                value={selectedCompany}
                onSelect={(val) => setSelectedCompany(val)}
                required
              />
            </div>

            <div className="md:col-span-12">
              <Input
                label="Mapped Key"
                value={fieldKey}
                onChange={(e) => setFieldKey(e.target.value)}
                required
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
