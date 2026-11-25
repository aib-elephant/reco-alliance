import AddCompanySection from "@/screens/Company/AddCompanySection";
import Modal from ".";
import { LuCircleX } from "react-icons/lu";
import { Company } from "@/lib/utils/types";

const AddCompanyModal = ({
  show,
  onClose,
  companies,
}: {
  show: boolean;
  onClose: () => void;
  companies: Company[] | undefined;
}) => {
  return (
    <Modal show={show} wrapperClassName="absolute right-0 top-0 h-full w-2/5">
      <div className="relative">
        <div className="absolute top-1 right-1">
          <button onClick={onClose} className="p-3 text-slate-400">
            <LuCircleX size={25} />
          </button>
        </div>

        <AddCompanySection companies={companies} onClose={onClose} />
      </div>
    </Modal>
  );
};

export default AddCompanyModal;
