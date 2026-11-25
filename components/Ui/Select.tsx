import { useEffect, useMemo, useRef, useState } from "react";
import { MdCheckBox, MdCheckBoxOutlineBlank } from "react-icons/md";
import { PiCaretDownBold } from "react-icons/pi";
import Input from "./Input";

interface Selection {
  label: string;
  value: any;
}

interface BaseSelectProps {
  options: Selection[];
  label: string;
  isSearchEnable?: boolean;
  isAllEnable?: boolean;
  disabled?: boolean;
  title?: string;
  required?: boolean;
}

type SelectProps = BaseSelectProps &
  (
    | {
        isMulti: true;
        value: Selection[];
        onSelect: (val: Selection[]) => void;
      }
    | {
        isMulti?: false;
        value: Selection | null;
        onSelect: (val: Selection | null) => void;
      }
  );

const Select = (props: SelectProps) => {
  const {
    options,
    label,
    isSearchEnable = false,
    isAllEnable = false,
    disabled = false,
    required = false,
    title,
  } = props;

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const containerRef = useRef<any>(null);
  const selectedOptionRef = useRef<any>(null);

  const close = () => {
    setIsOpen(false);
    setSearch("");
  };

  const selectedValues = useMemo<Selection[]>(
    () => (props.isMulti ? props.value : props.value ? [props.value] : []),
    [props.value, props.isMulti],
  );

  const hasValue = selectedValues.length > 0;

  const displayValue = selectedValues.map((item) => item.label).join(", ");

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const isOptionSelected = (option: Selection) =>
    selectedValues.some((item) => Object.is(item.value, option.value));

  const handleSelect = (option: Selection) => {
    if (props.isMulti) {
      const exists = props.value.some((item) =>
        Object.is(item.value, option.value),
      );

      const updatedValues = exists
        ? props.value.filter((item) => !Object.is(item.value, option.value))
        : [...props.value, option];

      props.onSelect(updatedValues);
    } else {
      props.onSelect(option);
      close();
    }
  };

  const handleClear = () => {
    if (props.isMulti) {
      props.onSelect([]);
    } else {
      props.onSelect(null);
    }

    close();
  };

  useEffect(() => {
    if (isOpen) {
      selectedOptionRef.current?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: any) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        close();
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={title}
        disabled={disabled}
        onClick={() => (isOpen ? close() : setIsOpen(true))}
        className={`w-full disabled:cursor-default cursor-pointer disabled:bg-gray-100 focus:outline-0 focus:shadow-none relative border capitalize rounded-md p-3.25 flex items-center justify-between gap-3 ${isOpen ? "border-blue-900" : "border-light-gray hover:border-blue-900 disabled:hover:border-light-gray"}`}
      >
        <span
          className={`text-gray flex gap-1 whitespace-nowrap transition-all transition-discrete ease-in-out ${isOpen || hasValue ? "absolute bg-white -translate-y-5.5 -translate-x-0.75 text-xs px-0.75" : "text-sm"}`}
        >
          {label}
          {required && <span className="text-rose-500">*</span>}
        </span>

        <span className="text-sm text-start font-normal text-[#161B24] h-5 w-full whitespace-nowrap overflow-hidden text-ellipsis">
          {displayValue}
        </span>
        <PiCaretDownBold size={16} className="text-gray min-w-4" />
      </button>
      {isOpen && (
        <div
          role="listbox"
          aria-multiselectable={!!props.isMulti}
          className={`bg-white [&::-webkit-scrollbar]:hidden rounded-lg z-999 w-full max-h-40 overflow-y-auto border border-light-gray absolute top-14 shadow-lg`}
        >
          {isSearchEnable && (
            <div className="p-3 border-b border-light-gray">
              <Input
                label="Search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                inputClassName="lowercase"
              />
            </div>
          )}
          {isAllEnable && (
            <button
              type="button"
              role="option"
              aria-selected={!hasValue}
              onClick={handleClear}
              className={`w-full wrap-break-word text-start text-sm cursor-pointer py-2 px-3 hover:bg-light-gray/30`}
            >
              All
            </button>
          )}
          {filteredOptions.length === 0 && (
            <p className="py-2 px-3 text-sm text-gray">No results found</p>
          )}
          {filteredOptions.map((option) => {
            const isSelected = isOptionSelected(option);
            return (
              <button
                role="option"
                aria-selected={isSelected}
                key={String(option.value)}
                ref={isSelected ? selectedOptionRef : undefined}
                onClick={() => handleSelect(option)}
                className={`w-full flex items-center gap-1 text-sm cursor-pointer py-2 px-3 ${isSelected ? "bg-blue-900 text-white" : "hover:bg-light-gray/30"}`}
              >
                {props.isMulti && (
                  <span>
                    {isSelected ? (
                      <MdCheckBox className="text-white" size={19} />
                    ) : (
                      <MdCheckBoxOutlineBlank
                        className="text-blue-900"
                        size={19}
                      />
                    )}
                  </span>
                )}

                <span className="wrap-break-word text-start">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Select;
