"use client";
import Card from "@/components/Card";
import AddFieldModal from "@/components/Modal/AddKeyMapModal";
import PageHeading from "@/components/PageHeading";
import Input from "@/components/Ui/Input";
import { deleteField, updateField } from "@/lib/mutations/mappedKeyMutation";
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

  const { data } = useQuery({
    queryKey: ["mappedKeys"],
    queryFn: getMappedKeys,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const updateKeyMutation = useMutation({
    mutationFn: ({ id, newData }: { id: string; newData: { key: string } }) =>
      updateField(id, newData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mappedKeys"] });
      toast.success("Key added successfully!");
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message || error?.message || "Failed to add key";
      toast.error(errorMessage);
    },
  });

  const removeKeyMutation = useMutation({
    mutationFn: ({ id, newData }: { id: string; newData: { key: string } }) =>
      deleteField(id, newData),
    onSuccess: () => {
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
    const payload = { id, newData: { key: mapped_key } };

    updateKeyMutation.mutate(payload);

    setInputs((prev) => ({
      ...prev,
      [id]: "",
    }));
  };

  const removeKey = (id: string, mapped_key: string) => {
    const payload = { id, newData: { key: mapped_key } };

    removeKeyMutation.mutate(payload);
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeading
        name="Mapped Keys"
        subtitle="here you can manage all field and keys"
        actionButtons={[
          {
            name: "Add Key",
            type: "button",
            onClick: () => setShowModal(true),
          },
        ]}
      />
      <Card classname="sm:p-0 overflow-hidden">
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
              {data?.data.map((field) => {
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
                        {field.mapped_columns.map((key, i) => (
                          <div
                            key={`${key}${i}`}
                            className="inline-flex items-center gap-1.5 bg-slate-100/90 hover:bg-slate-200/70 border border-slate-200/80 rounded-md px-2.5 py-1 transition-colors"
                          >
                            <code className="text-xs font-mono text-slate-700">
                              {key}
                            </code>
                            <button
                              type="button"
                              title="remove key"
                              onClick={() => removeKey(field._id, key)}
                              className="text-slate-400 hover:text-indigo-600 focus:outline-none p-0.5 rounded transition-colors cursor-pointer"
                            >
                              <LuX className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-3">
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

      <AddFieldModal show={showModal} onClose={() => setShowModal(false)} />
    </main>
  );
};

export default KeyMapScreen;
