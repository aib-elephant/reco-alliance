import { api } from "../db/api";
import { Company } from "../utils/types";

export const getCompanies = async () =>
  api<{ success: boolean; count: number; data: Company[] }>("/api/companies");
