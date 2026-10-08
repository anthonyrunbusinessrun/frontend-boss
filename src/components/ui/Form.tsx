"use client";

import { ChevronDown, CircleAlert } from "lucide-react";
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import styles from "./form.module.css";

interface FieldShellProps {
  label: string;
  required?: boolean;
  error?: string | null;
  hint?: string;
  wide?: boolean;
  /** Visually hide the label (it stays available to assistive tech), e.g. inside table cells. */
  hideLabel?: boolean;
}

interface ShellInternal extends FieldShellProps {
  id: string;
  children: ReactNode;
}

function FieldShell({ id, label, required, error, hint, wide, hideLabel, children }: ShellInternal) {
  return (
    <div className={cn(styles.field, wide && styles.fieldWide)}>
      <label htmlFor={id} className={styles.label} style={hideLabel ? { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" } : undefined}>
        {label}
        {required && (
          <span className={styles.req} aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className={styles.error} role="alert">
          <CircleAlert size={13} aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const describedBy = (id: string, error?: string | null, hint?: string) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

type InputProps = FieldShellProps & Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & { prefixText?: string; align?: "left" | "right" };

export function TextInput({ label, required, error, hint, wide, hideLabel, prefixText, align, className, ...rest }: InputProps) {
  const id = useId();
  const control = (
    <input
      id={id}
      className={cn(styles.control, error && styles.invalid, prefixText && styles.withPrefix, align === "right" && styles.right, rest.type === "number" && styles.num, className)}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(id, error, hint)}
      aria-required={required || undefined}
      {...rest}
    />
  );
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint} wide={wide} hideLabel={hideLabel}>
      {prefixText ? (
        <div className={styles.prefixWrap}>
          <span className={styles.prefix} aria-hidden>
            {prefixText}
          </span>
          {control}
        </div>
      ) : (
        control
      )}
    </FieldShell>
  );
}

type TextAreaProps = FieldShellProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id">;

export function TextArea({ label, required, error, hint, wide, hideLabel, className, ...rest }: TextAreaProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint} wide={wide} hideLabel={hideLabel}>
      <textarea
        id={id}
        className={cn(styles.control, styles.textarea, error && styles.invalid, className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        aria-required={required || undefined}
        {...rest}
      />
    </FieldShell>
  );
}

export type SelectOption = string | { value: string; label: string; disabled?: boolean };

type SelectProps = FieldShellProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & { options: readonly SelectOption[]; placeholder?: string };

export function SelectInput({ label, required, error, hint, wide, hideLabel, options, placeholder, className, ...rest }: SelectProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint} wide={wide} hideLabel={hideLabel}>
      <div className={styles.selectWrap}>
        <select
          id={id}
          className={cn(styles.control, styles.select, error && styles.invalid, className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          aria-required={required || undefined}
          {...rest}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => {
            const opt = typeof o === "string" ? { value: o, label: o } : o;
            return (
              <option key={opt.value} value={opt.value} disabled={"disabled" in opt ? opt.disabled : undefined}>
                {opt.label}
              </option>
            );
          })}
        </select>
        <ChevronDown size={15} className={styles.selectChev} aria-hidden />
      </div>
    </FieldShell>
  );
}

export function CheckField({ label, checked, onChange, hint, wide }: { label: string; checked: boolean; onChange: (next: boolean) => void; hint?: string; wide?: boolean }) {
  const id = useId();
  return (
    <div className={cn(styles.field, wide && styles.fieldWide)}>
      <label htmlFor={id} className={styles.checkRow}>
        <input id={id} type="checkbox" className={styles.checkBox} checked={checked} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}

export function FormGrid({ columns = 2, children }: { columns?: 1 | 2 | 3; children: ReactNode }) {
  return <div className={cn(styles.grid, columns === 1 && styles.grid1, columns === 2 && styles.grid2, columns === 3 && styles.grid3)}>{children}</div>;
}

export function FormSection({ title, description, children }: { title?: string; description?: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      {title && <h3 className={styles.sectionTitle}>{title}</h3>}
      {description && <p className={styles.sectionDesc}>{description}</p>}
      {children}
    </section>
  );
}

type BannerTone = "error" | "info" | "ok" | "warn";

/** Inline status message used inside forms (validation summary, balance state, locked records). */
export function Banner({ tone = "error", children, id }: { tone?: BannerTone; children: ReactNode; id?: string }) {
  return (
    <div id={id} className={cn(styles.banner, tone === "info" && styles.bannerInfo, tone === "ok" && styles.bannerOk, tone === "warn" && styles.bannerWarn)} role={tone === "error" ? "alert" : "status"}>
      <CircleAlert size={16} aria-hidden />
      <div>{children}</div>
    </div>
  );
}

/** Read-only label/value grid for the "view" mode of a record. */
export function DetailList({ items }: { items: Array<{ label: string; value: ReactNode; wide?: boolean }> }) {
  return (
    <dl className={styles.detailGrid}>
      {items.map((it) => (
        <div key={it.label} className={it.wide ? styles.detailWide : undefined}>
          <dt>{it.label}</dt>
          <dd>{it.value === null || it.value === undefined || it.value === "" ? <span className={styles.dim}>-</span> : it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
