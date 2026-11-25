import { api } from "../db/api";
import { MappedField } from "../utils/types";

export const getMappedKeys = async () =>
  api<{ success: boolean; count: number; data: MappedField[] }>("/api/keymap");
