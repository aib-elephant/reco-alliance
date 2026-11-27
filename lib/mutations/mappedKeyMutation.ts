import { api } from "../db/api";
import { CreateMappedField } from "../utils/types";

export const createField = (data: CreateMappedField) =>
  api<CreateMappedField>("/api/keymap", {
    method: "POST",
    data,
  });

export const updateField = (
  id: string,
  data: { key: string; companyId: string },
) =>
  api<CreateMappedField>(`/api/keymap/${id}`, {
    method: "PUT",
    data,
  });

export const deleteField = (
  id: string,
  data: { key: string; companyId: string },
) =>
  api<CreateMappedField>(`/api/keymap/${id}`, {
    method: "DELETE",
    data,
  });
