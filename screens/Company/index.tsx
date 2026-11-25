"use client";
import { useState } from "react";
import Link from "next/link";
import DataTableSection from "./DataSection";
import AddCompanyModal from "@/components/Modal/AddCompanyModal";
import { HiOutlineUpload } from "react-icons/hi";
import { HiPlus } from "react-icons/hi2";
import { getCompanies } from "@/lib/queries/companiesQuery";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import PageHeading from "@/components/PageHeading";

export default function CompaniesScreen() {
  const [addCompanyModal, setAddCompanyModal] = useState(false);

  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: getCompanies,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  return (
    <main className="mx-auto max-w-6xl w-full space-y-5 p-6">
      <PageHeading
        name="Companies"
        subtitle="Manage registered organizations and workspace slugs"
        actionButtons={[
          {
            name: "Go to imports",
            icon: HiOutlineUpload,
            iconSize: 18,
            type: "link",
            url: "/imports",
          },
          {
            name: "Add Company",
            icon: HiPlus,
            iconSize: 16,
            type: "button",
            onClick: () => setAddCompanyModal(true),
            iconProps: { strokeWidth: 1 },
          },
        ]}
      />

      <DataTableSection companies={companies?.data} />

      <AddCompanyModal
        show={addCompanyModal}
        onClose={() => setAddCompanyModal(false)}
        companies={companies?.data}
      />
    </main>
  );
}
