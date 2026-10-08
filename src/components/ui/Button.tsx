import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import styles from "./ui.module.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "link";
  size?: "block" | "auth" | "auto" | "md" | "sm";
  /** Always show the red glow (the design draws it on some "Create new …" buttons). */
  glow?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = "primary", size = "auto", glow, icon, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        styles.btn,
        styles[variant],
        size === "block" && styles.sizeBlock,
        size === "auth" && styles.sizeAuth,
        size === "md" && styles.sizeMd,
        size === "sm" && styles.sizeSm,
        glow && styles.glow,
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
