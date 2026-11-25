"use client";

import React from "react";
import { ClassNameValue, twMerge } from "tailwind-merge";

interface ModalProps {
  show: boolean;
  children: React.ReactNode;
  wrapperClassName?: string;
}

const Modal: React.FC<ModalProps> = ({ show, children, wrapperClassName }) => {
  return (
    <div
      className={`bg-black/50 backdrop-blur-xs overscroll-contain fixed flex w-full h-screen top-0 left-0 justify-center items-center z-9999 ${
        show ? "block" : "hidden"
      }`}
    >
      <div
        className={twMerge(
          `bg-white rounded-[10px] shadow`,
          wrapperClassName as ClassNameValue,
        )}
      >
        {children}
      </div>
    </div>
  );
};

export default Modal;
