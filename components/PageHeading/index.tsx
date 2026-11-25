"use client";

import { ButtonProps } from "@/lib/utils/types";
import Button from "../Ui/Button";

interface headingProps {
  name: string;
  subtitle?: string;
  actionButtons?: ButtonProps[];
}

const PageHeading = ({ name, subtitle, actionButtons }: headingProps) => {
  return (
    <>
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200/80 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        {actionButtons && (
          <div className="flex items-center gap-2">
            {actionButtons?.map((btn, i) => {
              return <Button key={String(i)} {...btn} />;
            })}
          </div>
        )}
      </header>
    </>
  );
};

export default PageHeading;
