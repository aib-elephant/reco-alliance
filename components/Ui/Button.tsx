import { ButtonProps } from "@/lib/utils/types";
import Link from "next/link";
import { twMerge } from "tailwind-merge";

const Button = ({
  name,
  type,
  onClick,
  url = "#",
  className,
  icon,
  iconSize,
  iconPosition = "before",
  iconProps,
  variant = "outlined",
  disabled,
}: ButtonProps) => {
  const btnStyle =
    variant === "filled"
      ? "text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-900/90"
      : "text-slate-500 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 hover:text-slate-900";

  return type === "link" ? (
    <Link
      href={url}
      className={twMerge(
        `inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium focus:outline-none transition-all ${btnStyle}`,
        className,
      )}
    >
      {icon &&
        iconPosition === "before" &&
        icon({
          size: iconSize,
          ...iconProps,
        })}
      <span className="whitespace-nowrap">{name}</span>
      {icon &&
        iconPosition === "after" &&
        icon({
          size: iconSize,
          ...iconProps,
        })}
    </Link>
  ) : (
    <button
      className={twMerge(
        `inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium focus:outline-none transition-all cursor-pointer ${btnStyle}`,
        className,
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {icon &&
        iconPosition === "before" &&
        icon({
          size: iconSize,
          ...iconProps,
        })}
      <span className=" whitespace-nowrap">{name}</span>
      {icon &&
        iconPosition === "after" &&
        icon({
          size: iconSize,
          ...iconProps,
        })}
    </button>
  );
};

export default Button;
