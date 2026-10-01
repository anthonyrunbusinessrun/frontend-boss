"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import styles from "./ui.module.css";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Adds the trailing cyan eye toggle used by password fields. */
  reveal?: boolean;
}

export function TextField({ label, reveal, type = "text", className, ...rest }: TextFieldProps) {
  const id = useId();
  const [shown, setShown] = useState(false);
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={styles.inputWrap}>
        <input
          id={id}
          type={reveal ? (shown ? "text" : "password") : type}
          className={cn(styles.input, reveal && styles.inputPassword, className)}
          {...rest}
        />
        {reveal && (
          <button type="button" className={styles.eye} aria-label={shown ? "Hide password" : "Show password"} onClick={() => setShown((s) => !s)}>
            {shown ? <EyeOff size={22} strokeWidth={1.75} /> : <Eye size={22} strokeWidth={1.75} />}
          </button>
        )}
      </div>
    </div>
  );
}
