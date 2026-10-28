"use client";

import { Plus } from "lucide-react";
import { useMemo } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { applyGroups } from "@/lib/base/query";
import { isImageAttachment, readAttachments } from "@/lib/base/fields";
import type { RecordRow } from "@/lib/base/types";
import { CellValue } from "../cells";
import { useTable } from "../TableProvider";
import { Avatar } from "../ui";
import s from "../base.module.css";
import { cardFields, useTitle } from "./shared";
import type { ViewProps } from "./types";
import { LayoutGrid } from "lucide-react";

export function GalleryView({ rows, onOpen, onCreate }: ViewProps) {
  const t = useTable();
  const title = useTitle();
  const cover = t.config.coverField;
  const fields = cardFields(t.fields, t.config.hidden, [cover, t.config.titleField, t.fields.find((f) => f.primary)?.key], 4);
  const groups = useMemo(() => applyGroups(rows, t.config.groupBy, t.fields, t.linked), [rows, t.config.groupBy, t.fields, t.linked]);
  const size = t.config.cardSize ?? "medium";

  const card = (r: RecordRow) => {
    const img = cover ? readAttachments(r[cover]).find(isImageAttachment) : undefined;
    return (
      <button key={r.id} type="button" className={s.card2} onClick={() => onOpen(r.id)}>
        <span className={s.cardCover}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {img ? <img src={img.url} alt="" loading="lazy" /> : <Avatar name={title(r)} size={56} />}
        </span>
        <span className={s.cardBody}>
          <strong className={s.cardName}>{title(r)}</strong>
          {fields.map((f) => (
            <span key={f.key} className={s.cardField}>
              <small>{f.name}</small>
              <CellValue field={f} row={r} linked={t.linked} compact />
            </span>
          ))}
        </span>
      </button>
    );
  };

  if (rows.length === 0)
    return (
      <EmptyState icon={<LayoutGrid size={22} />} title="No records to show" description="Add a record, or change the filters on this view.">
        <button type="button" className={s.linkBtn} onClick={() => onCreate()}><Plus size={14} /> Add record</button>
      </EmptyState>
    );

  return (
    <div className={s.galleryWrap}>
      {groups.map((g) => (
        <section key={g.key} aria-label={g.label || "All records"}>
          {g.label && <h3 className={s.groupTitle}>{g.field?.name}: {g.label} <span className={s.groupCount}>{g.rows.length}</span></h3>}
          <div className={s.gallery} data-size={size}>
            {(g.children ? g.children.flatMap((c) => c.rows) : g.rows).map(card)}
            {!g.label && (
              <button type="button" className={s.addCard} onClick={() => onCreate()}>
                <Plus size={18} /> Add record
              </button>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
