"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import styles from "./ui.module.css";

interface CheckboxProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}

export function Checkbox({ checked, onChange, label }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className={cn(styles.checkbox, checked && styles.checkboxOn)}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
    >
      {checked ? <Check size={10} strokeWidth={3.5} /> : null}
    </button>
  );
}
