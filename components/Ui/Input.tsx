"use client";

import { InputHTMLAttributes, useState } from "react";
import { ClassNameValue, twMerge } from "tailwind-merge";

type InputProps = {
  label: string;
  className?: ClassNameValue;
  inputClassName?: ClassNameValue;
} & InputHTMLAttributes<HTMLInputElement>;

const Input = ({
  label,
  inputClassName,
  className,
  ...restProps
}: InputProps) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <label className={twMerge("block relative", className)}>
      <span
        className={`text-gray whitespace-nowrap transition-all transition-discrete ease-in-out absolute left-3.25 ${isOpen || restProps.value ? "bg-white top-0 -translate-y-2 -translate-x-0.75 text-xs px-0.75" : "text-sm top-1/2 translate-x-0 -translate-y-1/2"}`}
      >
        {label} {restProps.required && <span className="text-rose-500">*</span>}
      </span>
      <input
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        className={twMerge(
          "peer w-full focus:outline-2 text-sm focus:outline-blue-900 border border-light-gray rounded-md p-3.25",
          inputClassName,
        )}
        {...restProps}
      />
    </label>
  );
};

export default Input;

type FileInputProps = {
  label: string;
  fileData: File | null;
  className?: ClassNameValue;
  inputClassName?: ClassNameValue;
} & InputHTMLAttributes<HTMLInputElement>;

export const FileInput = ({
  label,
  inputClassName,
  className,
  fileData,
  ...restProps
}: FileInputProps) => {
  return (
    <label
      className={twMerge(
        "block relative border border-light-gray rounded-lg cursor-pointer p-2.75",
        className,
      )}
    >
      <span
        className={`text-gray whitespace-nowrap transition-all transition-discrete ease-in-out left-3.25 ${fileData ? "absolute bg-white top-0 -translate-y-2 -translate-x-0.75 text-xs px-0.75" : "static text-sm top-1/2 translate-x-0 -translate-y-1/2"}`}
      >
        {label} {restProps.required && <span className="text-rose-500">*</span>}
      </span>
      {fileData && <p className="text-sm">{fileData.name}</p>}
      <input type="file" {...restProps} />
    </label>
  );
};
