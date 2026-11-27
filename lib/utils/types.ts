import { IconBaseProps, IconType } from "react-icons";
import { ClassNameValue } from "tailwind-merge";

export type CreateCompany = {
  name: string;
  slug: string;
  status: string;
  senderEmails: string[];
  allowedDomains: string[];
};
export type Company = {
  _id: string;
  createdAt: Date;
  updateAt: Date;
} & CreateCompany;

export type Job = {
  _id: string;
  attachmentName: string;
  documentType: string;
  status: string;
  totalRows: number;
  tableCount?: number;
  savedTableRows?: number;
  successfulRows: number;
  failedRows: number;
};

export type CreateMappedField = {
  source_field: string;
  mapped_columns: { key: string; companyId: string }[];
  // deleted_keys: { key: string; companyId: string };
};

export type MappedField = {
  _id: string;
  source_field: string;
  mapped_columns: { key: string; companyId: string }[];
  deleted_keys: { key: string; companyId: string }[];
  createAt: Date;
  updatedAt: Date;
};

export type ButtonProps = {
  name: string;
  type: "button" | "link";
  onClick?: () => void;
  url?: string;
  className?: ClassNameValue;
  icon?: IconType;
  iconSize?: number;
  iconPosition?: "before" | "after";
  iconProps?: IconBaseProps;
  variant?: "filled" | "outlined";
  disabled?: boolean;
};

export type Connection = {
  _id: string;
  provider: "gmail" | "microsoft";
  mailboxAddress: string;
  documentType?: string;
  status: string;
  lastSyncedAt?: string;
};
export type EmailJob = {
  _id: string;
  companyId?: string;
  provider: string;
  attachmentName: string;
  status: string;
  mappingConfigId?: string;
  successfulRows: number;
  failedRows: number;
  createdAt: string;
};
export type Unmatched = {
  _id: string;
  sender?: string;
  subject?: string;
  lastError?: string;
};
