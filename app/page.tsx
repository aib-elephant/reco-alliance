import Card from "@/components/Card";
import PageHeading from "@/components/PageHeading";
import Button from "@/components/Ui/Button";
import { HiDocumentArrowDown, HiOutlineBuildingOffice2 } from "react-icons/hi2";
import { MdOutlineMail } from "react-icons/md";
import { BiSitemap } from "react-icons/bi";

export default function Home() {
  return (
    <>
      <PageHeading
        name="Data Reconciliation Solution"
        subtitle="Manage companies, upload CSV / Excel files, approve new mappings and
            browse import jobs."
      />
      <div className="grid grid-cols-1 md:grid-col-2 lg:grid-cols-4 gap-4">
        <Card classname="sm:p-4 flex flex-col justify-between hover:border-blue-900/50 hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group">
          <div>
            <div className="w-12 h-12 rounded-full bg-blue-900/10 flex items-center justify-center mb-1">
              <HiOutlineBuildingOffice2 size={24} className="text-blue-900" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-2">
              Company
            </h3>
            <p className="text-sm text-slate-400">
              Manage entities and reconciliation rules.
            </p>
          </div>
          <div className="text-end mt-8">
            <Button
              name="Manage"
              type="link"
              className="text-sm border-0 shadow-none py-1 group-hover:text-blue-900"
              url="/companies"
            />
          </div>
        </Card>
        <Card classname="sm:p-4 flex flex-col justify-between hover:border-blue-900/50 hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group">
          <div>
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-1">
              <HiDocumentArrowDown size={24} className="text-blue-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-2">
              Import
            </h3>
            <p className="text-sm text-slate-400">
              Upload CSV/Excel files via browse recent import jobs.
            </p>
          </div>
          <div className="text-end mt-8">
            <Button
              name="Upload"
              type="link"
              className="text-sm border-0 shadow-none py-1 group-hover:text-blue-900"
              url="/imports"
            />
          </div>
        </Card>
        <Card classname="sm:p-4 flex flex-col justify-between hover:border-blue-900/50 hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group">
          <div>
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-1">
              <BiSitemap size={24} className="text-amber-800" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-2">
              Key Mapper
            </h3>
            <p className="text-sm text-slate-400">
              Configure mappings for incoming file layouts.
            </p>
          </div>
          <div className="text-end mt-8">
            <Button
              name="Configure"
              type="link"
              className="text-sm border-0 shadow-none py-1 group-hover:text-blue-900"
              url="/keymap"
            />
          </div>
        </Card>
        <Card classname="sm:p-4 flex flex-col justify-between hover:border-blue-900/50 hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group">
          <div>
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-1">
              <MdOutlineMail size={24} className="text-green-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-2">
              Automated Email Extraction
            </h3>
            <p className="text-sm text-slate-400">
              Connect authorized mailboxes{" "}
              <code className="bg-slate-100 py-0.5 px-1 rounded">(/email)</code>{" "}
              to automatically scan and extract spreadsheet attachments.
            </p>
          </div>
          <div className="text-end mt-8">
            <Button
              name="Manage"
              type="link"
              className="text-sm border-0 shadow-none py-1 group-hover:text-blue-900"
              url="/email"
            />
          </div>
        </Card>
      </div>
    </>
  );
}
