"use client";
import Card from "@/components/Card";
import AddFieldModal from "@/components/Modal/AddKeyMapModal";
import PageHeading from "@/components/PageHeading";
import Input from "@/components/Ui/Input";
import Select from "@/components/Ui/Select";
import { deleteField, updateField } from "@/lib/mutations/mappedKeyMutation";
import { getCompanies } from "@/lib/queries/companiesQuery";
import { getMappedKeys } from "@/lib/queries/mappedKeyQuery";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import toast from "react-hot-toast";
import { LuX } from "react-icons/lu";

const KeyMapScreen = () => {
  const queryClient = useQueryClient();

  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [showModal, setShowModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<
    Record<
      string,
      {
        label: string;
        value: string;
      } | null
    >
  >({});
  const [filterCompany, setFilterCompany] = useState<{
    label: string;
    value: string;
  } | null>(null);

  // <Record<string, string>>

  const { data: mappedKeys } = useQuery({
    queryKey: ["mappedKeys"],
    queryFn: getMappedKeys,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const { data: companies, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: getCompanies,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const updateKeyMutation = useMutation({
    mutationFn: ({
      id,
      newData,
    }: {
      id: string;
      newData: { key: string; companyId: string };
    }) => updateField(id, newData),
    onSuccess: (data: any) => {
      const { data: mapped } = data;
      queryClient.invalidateQueries({ queryKey: ["mappedKeys"] });
      setSelectedCompany((prev) => ({ ...prev, [mapped._id]: null }));
      toast.success("Key added successfully!");
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message || error?.message || "Failed to add key";
      toast.error(errorMessage);
    },
  });

  const removeKeyMutation = useMutation({
    mutationFn: ({
      id,
      newData,
    }: {
      id: string;
      newData: { key: string; companyId: string };
    }) => deleteField(id, newData),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["mappedKeys"] });
      toast.success("Key removed successfully!");
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to remove key";
      toast.error(errorMessage);
    },
  });

  const addKey = (id: string, mapped_key: string) => {
    const payload = {
      id,
      newData: { key: mapped_key, companyId: selectedCompany[id]?.value! },
    };

    updateKeyMutation.mutate(payload);

    setInputs((prev) => ({
      ...prev,
      [id]: "",
    }));
  };

  const removeKey = (id: string, mapped_key: string, companyId: string) => {
    const payload = {
      id,
      newData: { key: mapped_key, companyId },
    };

    removeKeyMutation.mutate(payload);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <main className="space-y-6">
      <PageHeading
        name="Mapped Keys"
        subtitle="here you can manage all field and keys"
        actionButtons={[
          {
            name: "Add Field",
            type: "button",
            onClick: () => setShowModal(true),
          },
        ]}
      />
      <Card classname="sm:p-0 overflow-hidden">
        <div className="p-4 sm:px-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white">
          <div className="flex items-center gap-2.5">
            <h2
              id="companies-list-heading"
              className="text-base font-semibold text-slate-900"
            >
              Mapped Keys
            </h2>
            <span
              id="company-count-badge"
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/70"
            >
              {mappedKeys?.count} total
            </span>
          </div>

          {/* <!-- Search & Status Filter Controls --> */}
          <div className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-2.5 w-1/3">
            {/* <!-- Status Filter Select --> */}
            <div className="flex items-center gap-1.5 p-1 w-full rounded-lg self-start sm:self-auto">
              <div className="w-full">
                <Select
                  label="Company"
                  options={
                    companies?.data.map((c) => ({
                      label: c.name,
                      value: c._id,
                    })) as { label: string; value: string }[]
                  }
                  value={filterCompany}
                  onSelect={(val) => setFilterCompany(val)}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-xl">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50/80">
              <tr>
                <th
                  scope="col"
                  className="py-3.5 pl-4 pr-3 sm:pl-6 text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  Source Field
                </th>
                <th
                  scope="col"
                  className="py-3.5 pl-3 pr-4 sm:pr-6 text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  Mapped Columns
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 bg-white">
              {mappedKeys?.data.slice(0, 3).map((field) => {
                return (
                  <tr
                    key={field._id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    <td className="py-3.5 pl-4 pr-3 sm:pl-6 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-900">
                        {field.source_field}
                      </span>
                    </td>
                    <td className="py-3.5 pl-3 pr-4 sm:pr-6 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex flex-wrap gap-2 mb-3">
                        {field.mapped_columns
                          .filter((col) =>
                            filterCompany
                              ? col.companyId === filterCompany?.value
                              : col,
                          )
                          .map((col, i) => (
                            <div
                              key={`${col.key}${i}`}
                              className="inline-flex items-center gap-1.5 bg-slate-100/90 hover:bg-slate-200/70 border border-slate-200/80 rounded-md px-2.5 py-1 transition-colors"
                            >
                              <code className="text-xs font-mono text-slate-700">
                                {col.key}
                              </code>
                              <button
                                type="button"
                                title="remove key"
                                onClick={() =>
                                  removeKey(field._id, col.key, col.companyId)
                                }
                                className="text-slate-400 hover:text-indigo-600 focus:outline-none p-0.5 rounded transition-colors cursor-pointer"
                              >
                                <LuX className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-full">
                          <Select
                            label="Company"
                            options={
                              companies?.data.map((c) => ({
                                label: c.name,
                                value: c._id,
                              })) as { label: string; value: string }[]
                            }
                            value={selectedCompany[field._id]}
                            onSelect={(val) =>
                              setSelectedCompany((prev) => ({
                                ...prev,
                                [field._id]: val,
                              }))
                            }
                          />
                        </div>
                        <Input
                          label="Add Key"
                          value={inputs[field._id] ?? ""}
                          onChange={(e) =>
                            setInputs((prev) => ({
                              ...prev,
                              [field._id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) =>
                            e.key === "Enter" &&
                            addKey(field._id, inputs[field._id])
                          }
                          className="w-full"
                        />
                        <button
                          onClick={() => {
                            addKey(field._id, inputs[field._id]);
                          }}
                          className="px-6.5 py-3.25 bg-blue-900 text-white text-sm rounded-lg"
                        >
                          Add
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <AddFieldModal
        show={showModal}
        onClose={() => setShowModal(false)}
        companies={companies?.data!}
      />
    </main>
  );
};

export default KeyMapScreen;
