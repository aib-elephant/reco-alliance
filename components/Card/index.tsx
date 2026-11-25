"use client";

import { HTMLAttributes } from "react";
import { ClassNameValue, twMerge } from "tailwind-merge";

type cardProps = {
  children: React.ReactNode;
  classname?: ClassNameValue;
  onClick?: () => void;
} & HTMLAttributes<HTMLElement>;

const Card = ({ children, classname, ...restProps }: cardProps) => {
  return (
    <section
      className={twMerge(
        "bg-white rounded-xl p-5 sm:p-6 border border-slate-200/90 shadow-sm",
        classname,
      )}
      {...restProps}
    >
      {children}
    </section>
  );
};

export default Card;
