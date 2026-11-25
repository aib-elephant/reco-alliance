import { api } from "../db/api";
import { CreateCompany } from "../utils/types";

export const createCompany = (data: CreateCompany) =>
  api<CreateCompany>("/api/companies", {
    method: "POST",
    data,
  });
