"use client";

import { ChevronDown, Search, Upload, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { linkIds, type LinkLookup } from "@/lib/base/compute";
import { isImageAttachment, readAttachments } from "@/lib/base/fields";
import type { AttachmentValue, FieldDef, LinkedRecord } from "@/lib/base/types";
import { cn } from "@/lib/cn";
import { messageOf } from "./TableProvider";
import s from "./base.module.css";
import { Avatar, Chip, colorOf, FloatingPanel } from "./ui";

export interface InputProps {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  linked: LinkLookup;
  upload: (file: File | Blob, name?: string) => Promise<AttachmentValue>;
  invalid?: boolean;
  autoFocus?: boolean;
  id?: string;
  onCommit?: () => void;
}

/** Candidates for a link field: honours the field's filter and hides inactive records unless already chosen. */
export function linkCandidates(field: FieldDef, linked: LinkLookup, current: string[]): LinkedRecord[] {
  const table = field.options.linkTable ? linked[field.options.linkTable] : undefined;
  if (!table) return [];
  const rule = field.options.linkFilter;
  return table.records.filter((r) => current.includes(r.id) || ((!rule || r.filter[rule.key] === rule.equals) && r.filter.inactive !== true));
}

export function LinkInput({ field, value, onChange, linked, invalid, id, autoFocus, onCommit }: InputProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const ids = linkIds(value);
  const multiple = field.options.multiple === true;
  const table = field.options.linkTable ? linked[field.options.linkTable] : undefined;
  const options = linkCandidates(field, linked, ids).filter((r) => r.label.toLowerCase().includes(q.trim().toLowerCase()) || (r.sub ?? "").toLowerCase().includes(q.trim().toLowerCase()));
  const close = () => {
    setOpen(false);
    setQ("");
    onCommit?.();
  };
  const pick = (r: LinkedRecord) => {
    if (multiple) onChange(ids.includes(r.id) ? ids.filter((x) => x !== r.id) : [...ids, r.id]);
    else {
      onChange(r.id);
      setOpen(false);
      setQ("");
      onCommit?.();
    }
  };
  return (
    <>
      <button ref={setAnchor} id={id} type="button" className={cn(s.input, s.pickerBtn, invalid && s.invalid)} aria-haspopup="listbox" aria-expanded={open} autoFocus={autoFocus} onClick={() => setOpen((o) => !o)}>
        <span className={s.pickerValue}>
          {ids.length === 0 ? (
            <span className={s.placeholder}>Select {table?.name.toLowerCase().replace(/s$/, "") ?? "record"}…</span>
          ) : (
            ids.map((x) => {
              const r = table?.records.find((t) => t.id === x);
              return (
                <span key={x} className={s.linkChip}>
                  {table?.slug === "profiles" && <Avatar name={r?.label ?? "?"} src={r?.photo} size={18} />}
                  {r?.label ?? "Deleted record"}
                </span>
              );
            })
          )}
        </span>
        <ChevronDown size={14} aria-hidden />
      </button>
      <FloatingPanel anchor={anchor} open={open} onClose={close} width={Math.max(280, anchor?.offsetWidth ?? 0)}>
        <label className={s.panelSearch}>
          <Search size={14} aria-hidden />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find ${table?.name.toLowerCase() ?? "record"}`} aria-label="Search records" />
        </label>
        <ul className={s.optionList} role="listbox" aria-label={field.name}>
          {!multiple && ids.length > 0 && !field.required && (
            <li>
              <button type="button" className={s.option} onClick={() => { onChange(null); close(); }}>
                <X size={14} aria-hidden /> Clear
              </button>
            </li>
          )}
          {options.map((r) => (
            <li key={r.id}>
              <button type="button" role="option" aria-selected={ids.includes(r.id)} className={cn(s.option, ids.includes(r.id) && s.optionOn)} onClick={() => pick(r)}>
                {table?.slug === "profiles" && <Avatar name={r.label} src={r.photo} size={24} />}
                <span className={s.optionMain}>
                  <span>{r.label}</span>
                  {r.sub && <small>{r.sub}</small>}
                </span>
              </button>
            </li>
          ))}
          {options.length === 0 && <li className={s.optionEmpty}>{q ? "No matches" : field.options.linkFilter ? "No team members yet. Mark a profile as Team first." : "Nothing to link yet"}</li>}
        </ul>
      </FloatingPanel>
    </>
  );
}

export function AttachmentInput({ field, value, onChange, upload, id }: InputProps) {
  const list = readAttachments(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const added: AttachmentValue[] = [];
      for (const f of Array.from(files)) {
        if (field.options.imagesOnly && !f.type.startsWith("image/")) throw new Error(`“${f.name}” is not an image.`);
        if (f.size > 5 * 1024 * 1024) throw new Error(`“${f.name}” is larger than 5 MB.`);
        added.push(await upload(f));
      }
      onChange([...list, ...added]);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className={s.attachments}>
      {list.length > 0 && (
        <ul className={s.attachList}>
          {list.map((a, i) => (
            <li key={a.url + i} className={s.attachItem}>
              {isImageAttachment(a) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt="" className={s.attachThumb} />
              ) : (
                <span className={s.attachThumb} aria-hidden>
                  {a.name.split(".").pop()}
                </span>
              )}
              <a href={a.url} target="_blank" rel="noopener noreferrer" className={s.attachName}>
                {a.name}
              </a>
              <button type="button" className={s.iconBtn} aria-label={`Remove ${a.name}`} onClick={() => onChange(list.filter((_, j) => j !== i))}>
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" id={id} className={s.uploadBtn} disabled={busy} onClick={() => input.current?.click()}>
        <Upload size={14} aria-hidden /> {busy ? "Uploading…" : list.length ? "Add another file" : field.options.imagesOnly ? "Upload image" : "Upload file"}
      </button>
      <input ref={input} type="file" hidden multiple={field.key !== "photo" && field.key !== "pic"} accept={field.options.imagesOnly ? "image/png,image/jpeg,image/gif,image/webp,image/avif" : undefined} onChange={(e) => void add(e.target.files)} />
      {error && (
        <p className={s.fieldError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function MultiInput({ field, value, onChange, id }: InputProps) {
  const selected = Array.isArray(value) ? value.map(String) : [];
  const [text, setText] = useState("");
  const names = [...new Set([...(field.options.choices?.map((c) => c.name) ?? []), ...selected])];
  const toggle = (n: string) => onChange(selected.includes(n) ? selected.filter((x) => x !== n) : [...selected, n]);
  const addTag = () => {
    const t = text.trim();
    if (t && !selected.includes(t)) onChange([...selected, t]);
    setText("");
  };
  return (
    <div className={s.multi} id={id}>
      <div className={s.multiChips} role="group" aria-label={field.name}>
        {names.map((n) => (
          <button key={n} type="button" aria-pressed={selected.includes(n)} className={cn(s.togglePill, selected.includes(n) && s.togglePillOn)} onClick={() => toggle(n)}>
            <Chip color={selected.includes(n) ? colorOf(n, field.options.choices) : "gray"}>{n}</Chip>
          </button>
        ))}
        {names.length === 0 && !field.options.allowOther && <span className={s.placeholder}>No options yet. Add them in the field settings.</span>}
      </div>
      {field.options.allowOther && (
        <input
          className={s.input}
          value={text}
          placeholder="Type a tag and press Enter"
          aria-label={`Add to ${field.name}`}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag();
            }
          }}
          onBlur={addTag}
        />
      )}
    </div>
  );
}

/** The input control for one field. Computed and autonumber fields are not editable and render nothing here. */
export function FieldInput(p: InputProps) {
  const { field, value, onChange, invalid, id, autoFocus, onCommit } = p;
  const common = { id, autoFocus, "aria-invalid": invalid || undefined, className: cn(s.input, invalid && s.invalid) };
  switch (field.type) {
    case "longText":
      return <textarea {...common} rows={4} value={(value as string) ?? ""} placeholder={field.options.placeholder} onChange={(e) => onChange(e.target.value)} />;
    case "number":
      return <input {...common} type="number" inputMode="decimal" step={field.options.format === "integer" ? 1 : "any"} min={field.options.min} max={field.options.max} value={value === null || value === undefined ? "" : String(value)} placeholder={field.options.placeholder} onChange={(e) => onChange(e.target.value)} />;
    case "date":
      return <input {...common} type="date" value={typeof value === "string" ? value.slice(0, 10) : ""} onChange={(e) => onChange(e.target.value)} />;
    case "checkbox":
      return (
        <label className={s.checkRow}>
          <input id={id} type="checkbox" checked={value === true} onChange={(e) => { onChange(e.target.checked); onCommit?.(); }} />
          <span>{value === true ? "Yes" : "No"}</span>
        </label>
      );
    case "singleSelect":
      return (
        <span className={s.selectWrap}>
          <select {...common} value={typeof value === "string" ? value : ""} onChange={(e) => { onChange(e.target.value === "" ? null : e.target.value); onCommit?.(); }}>
            <option value="">{field.required ? "Choose…" : "None"}</option>
            {field.options.choices?.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown size={14} aria-hidden />
        </span>
      );
    case "multiSelect":
      return <MultiInput {...p} />;
    case "link":
      return <LinkInput {...p} />;
    case "attachment":
      return <AttachmentInput {...p} />;
    case "email":
    case "url":
    case "phone":
    case "text":
    default:
      return (
        <input
          {...common}
          type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
          value={(value as string) ?? ""}
          placeholder={field.options.placeholder ?? (field.type === "url" ? "https://" : undefined)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

/** Label + control + help/error, the layout used by the drawer and form views. */
export function FieldRow({ field, label, help, required, error, children, id }: { field: FieldDef; label?: string; help?: string; required?: boolean; error?: string; children: React.ReactNode; id: string }) {
  const hint = help ?? field.options.help;
  return (
    <div className={cn(s.fieldRow, (field.type === "longText" || field.type === "attachment" || field.type === "multiSelect") && s.fieldWide)}>
      <label htmlFor={id} className={s.fieldLabel}>
        {label ?? field.name}
        {required && <span className={s.req} aria-hidden> *</span>}
      </label>
      {children}
      {error ? (
        <p className={s.fieldError} role="alert">
          {error}
        </p>
      ) : (
        hint && <p className={s.fieldHint}>{hint}</p>
      )}
    </div>
  );
}

export function useFieldId() {
  return useId();
}
