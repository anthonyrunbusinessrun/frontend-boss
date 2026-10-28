"use client";

import { ChevronRight, List as ListIcon, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { applyGroups } from "@/lib/base/query";
import type { RecordRow } from "@/lib/base/types";
import { cn } from "@/lib/cn";
import { CellValue } from "../cells";
import { useTable } from "../TableProvider";
import s from "../base.module.css";
import { cardFields, useTitle } from "./shared";
import type { ViewProps } from "./types";

export function ListView({ rows, onOpen, onCreate }: ViewProps) {
  const t = useTable();
  const title = useTitle();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const groups = useMemo(() => applyGroups(rows, t.config.groupBy, t.fields, t.linked), [rows, t.config.groupBy, t.fields, t.linked]);
  const primaryKey = t.fields.find((f) => f.primary)?.key;
  const summary = cardFields(t.fields, t.config.hidden, [t.config.titleField, primaryKey], 3);
  const detail = cardFields(t.fields, t.config.hidden, [], 100);

  const toggle = (id: string) => setOpen((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const item = (r: RecordRow) => {
    const expanded = open.has(r.id);
    return (
      <li key={r.id} className={cn(s.listItem, expanded && s.listItemOpen)}>
        <div className={s.listRow}>
          <button type="button" className={s.iconBtn} aria-expanded={expanded} aria-label={`${expanded ? "Collapse" : "Expand"} ${title(r)}`} onClick={() => toggle(r.id)}>
            <ChevronRight size={14} className={cn(s.chev, expanded && s.chevOpen)} />
          </button>
          <button type="button" className={s.listTitle} onClick={() => toggle(r.id)}>{title(r)}</button>
          <span className={s.listMeta}>
            {summary.map((f) => (
              <span key={f.key} className={s.listField}><CellValue field={f} row={r} linked={t.linked} compact /></span>
            ))}
          </span>
          <Button variant="secondary" size="sm" onClick={() => onOpen(r.id)}>Open</Button>
        </div>
        {expanded && (
          <dl className={s.listDetail}>
            {detail.map((f) => (
              <div key={f.key}><dt>{f.name}</dt><dd><CellValue field={f} row={r} linked={t.linked} /></dd></div>
            ))}
          </dl>
        )}
      </li>
    );
  };

  if (rows.length === 0)
    return (
      <EmptyState icon={<ListIcon size={22} />} title="No records to show" description="Add a record, or change the filters on this view.">
        <Button size="md" icon={<Plus size={14} />} onClick={() => onCreate()}>Add record</Button>
      </EmptyState>
    );

  return (
    <div className={s.listWrap}>
      {groups.map((g) => (
        <section key={g.key}>
          {g.label && <h3 className={s.groupTitle}>{g.field?.name}: {g.label} <span className={s.groupCount}>{g.rows.length}</span></h3>}
          <ul className={s.listUl}>{(g.children ? g.children.flatMap((c) => c.rows) : g.rows).map(item)}</ul>
        </section>
      ))}
      <button type="button" className={s.addRowBtn} onClick={() => onCreate()}><Plus size={14} /> Add record</button>
    </div>
  );
}
