"use client";

import { Check, Flag, FileText, Paperclip } from "lucide-react";
import { displayText, fieldValue, formatNumber, linkIds, type LinkLookup } from "@/lib/base/compute";
import { isImageAttachment, readAttachments } from "@/lib/base/fields";
import type { FieldDef, RecordRow } from "@/lib/base/types";
import { formatDate } from "@/lib/dates";
import s from "./base.module.css";
import { Avatar, Chip, colorOf } from "./ui";

const STOCK_COLOR = { "In stock": "green", "Low stock": "orange", "Out of stock": "red", "Original uploaded": "green", "Generated only": "orange", "No PDF": "gray" } as const;

/** Read-only rendering of one field value. Used by grids, cards, lists and the drawer. */
export function CellValue({ field, row, linked, compact }: { field: FieldDef; row: RecordRow; linked: LinkLookup; compact?: boolean }) {
  const v = fieldValue(field, row, linked);
  switch (field.type) {
    case "checkbox":
      return v ? (
        field.options.icon === "flag" ? <Flag size={16} className={s.flag} aria-label="Yes" /> : <Check size={16} className={s.check} aria-label="Yes" />
      ) : null;
    case "singleSelect":
      return v ? <Chip color={colorOf(String(v), field.options.choices)}>{String(v)}</Chip> : null;
    case "multiSelect": {
      const list = Array.isArray(v) ? v.map(String) : [];
      return list.length ? (
        <span className={s.chips}>
          {list.map((x) => (
            <Chip key={x} color={colorOf(x, field.options.choices)}>
              {x}
            </Chip>
          ))}
        </span>
      ) : null;
    }
    case "number":
      return <span className={s.num}>{formatNumber(field, v)}</span>;
    case "autonumber":
      return <span className={s.num}>{v === null || v === undefined ? "" : String(v)}</span>;
    case "computed": {
      if (Array.isArray(v)) return v.length ? <span className={s.chips}>{v.map((x) => <Chip key={String(x)} color="purple">{String(x)}</Chip>)}</span> : null;
      if (typeof v === "string" && v in STOCK_COLOR) return <Chip color={STOCK_COLOR[v as keyof typeof STOCK_COLOR]}>{v}</Chip>;
      return v === null || v === undefined ? null : <span className={s.num}>{String(v)}</span>;
    }
    case "date":
      return typeof v === "string" && v ? <span>{formatDate(v.slice(0, 10))}</span> : null;
    case "url": {
      if (typeof v !== "string" || !v) return null;
      const href = /^[a-z]+:/i.test(v) || v.startsWith("/") ? v : `https://${v}`;
      return (
        <a className={s.link} href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
          {v}
        </a>
      );
    }
    case "email":
      return typeof v === "string" && v ? (
        <a className={s.link} href={`mailto:${v}`} onClick={(e) => e.stopPropagation()}>
          {v}
        </a>
      ) : null;
    case "attachment": {
      const list = readAttachments(v);
      if (list.length === 0) return null;
      return (
        <span className={s.thumbs}>
          {list.slice(0, compact ? 1 : 4).map((a, i) =>
            isImageAttachment(a) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={a.url + i} src={a.url} alt={a.name} className={s.thumb} loading="lazy" />
            ) : (
              <span key={a.url + i} className={s.fileChip} title={a.name}>
                <FileText size={12} /> {a.name}
              </span>
            ),
          )}
          {list.length > (compact ? 1 : 4) && <span className={s.more}>+{list.length - (compact ? 1 : 4)}</span>}
        </span>
      );
    }
    case "link": {
      const ids = linkIds(v);
      const table = field.options.linkTable ? linked[field.options.linkTable] : undefined;
      if (ids.length === 0) {
        const legacy = field.options.legacyKey ? row[field.options.legacyKey] : undefined;
        // Text from before this field became a relationship: shown until it is linked, never dropped.
        return typeof legacy === "string" && legacy ? <span className={s.legacy} title="Not linked to a record yet. Choose one to link it.">{legacy}</span> : null;
      }
      return (
        <span className={s.chips}>
          {ids.map((id) => {
            const rec = table?.records.find((r) => r.id === id);
            return (
              <span key={id} className={s.linkChip}>
                {table?.slug === "profiles" && <Avatar name={rec?.label ?? "?"} src={rec?.photo} size={18} />}
                {rec?.label ?? "Deleted record"}
              </span>
            );
          })}
        </span>
      );
    }
    case "longText":
      return <span className={compact ? s.clamp2 : undefined}>{displayText(field, row, linked)}</span>;
    default:
      return <span>{displayText(field, row, linked)}</span>;
  }
}

export function PaperclipIcon() {
  return <Paperclip size={14} aria-hidden />;
}
