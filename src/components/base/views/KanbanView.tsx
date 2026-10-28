"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { missingSetup } from "@/lib/base/viewDefaults";
import type { RecordRow } from "@/lib/base/types";
import { cn } from "@/lib/cn";
import { CellValue } from "../cells";
import { messageOf, useTable } from "../TableProvider";
import { Chip } from "../ui";
import s from "../base.module.css";
import { SetupNeeded } from "./SetupNeeded";
import { cardFields, useTitle } from "./shared";
import type { ViewProps } from "./types";

const NONE = "__none__";

export function KanbanView({ rows, onOpen, onCreate, onAddField }: ViewProps) {
  const t = useTable();
  const toast = useToast();
  const title = useTitle();
  const [over, setOver] = useState<string | null>(null);
  const setup = missingSetup("kanban", t.config, t.fields);
  const stack = t.config.stackField ? t.fieldMap.get(t.config.stackField) : undefined;
  if (setup || !stack) return setup ? <SetupNeeded setup={setup} onAddField={onAddField} /> : null;

  const choices = stack.options.choices ?? [];
  const known = new Set(choices.map((c) => c.name));
  const colKey = (r: RecordRow) => {
    const v = r[stack.key];
    return typeof v === "string" && known.has(v) ? v : NONE;
  };
  const columns = [...choices.map((c) => ({ key: c.name, label: c.name, color: c.color })), { key: NONE, label: "No value", color: undefined }];
  const fields = cardFields(t.fields, t.config.hidden, [stack.key, t.config.titleField, t.fields.find((f) => f.primary)?.key], 3);

  const move = async (id: string, to: string) => {
    const r = t.records.find((x) => x.id === id);
    if (!r || colKey(r) === to) return;
    try {
      await t.updateRecord(id, { [stack.key]: to === NONE ? null : to });
    } catch (e) {
      toast.error(`Couldn’t move the card. ${messageOf(e)}`);
    }
  };

  const order = columns.map((c) => c.key);
  return (
    <div className={s.kanban}>
      {columns
        .filter((c) => !(t.config.hideEmptyStacks && !rows.some((r) => colKey(r) === c.key)) && !(c.key === NONE && !rows.some((r) => colKey(r) === NONE)))
        .map((c) => {
          const cards = rows.filter((r) => colKey(r) === c.key);
          return (
            <section
              key={c.key}
              className={cn(s.kanCol, over === c.key && s.kanOver)}
              aria-label={`${c.label}, ${cards.length} cards`}
              onDragOver={(e) => { e.preventDefault(); setOver(c.key); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }}
              onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/plain"); if (id) void move(id, c.key); }}
            >
              <header className={s.kanHead}>
                {c.color ? <Chip color={c.color}>{c.label}</Chip> : <span className={s.kanNone}>{c.label}</span>}
                <span className={s.groupCount}>{cards.length}</span>
              </header>
              <div className={s.kanCards}>
                {cards.map((r) => (
                  <div
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    draggable
                    className={s.kanCard}
                    aria-label={`${title(r)}. Press Enter to open, or the left and right arrow keys to move between columns.`}
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", r.id); e.dataTransfer.effectAllowed = "move"; }}
                    onClick={() => onOpen(r.id)}
                    onKeyDown={(e) => {
                      const i = order.indexOf(colKey(r));
                      if (e.key === "Enter") onOpen(r.id);
                      else if (e.key === "ArrowRight" && i < order.length - 1) { e.preventDefault(); void move(r.id, order[i + 1]); }
                      else if (e.key === "ArrowLeft" && i > 0) { e.preventDefault(); void move(r.id, order[i - 1]); }
                    }}
                  >
                    <strong className={s.cardName}>{title(r)}</strong>
                    {fields.map((f) => (
                      <span key={f.key} className={s.cardField}>
                        <small>{f.name}</small>
                        <CellValue field={f} row={r} linked={t.linked} compact />
                      </span>
                    ))}
                  </div>
                ))}
                <button type="button" className={s.kanAdd} onClick={() => onCreate({ [stack.key]: c.key === NONE ? null : c.key })}>
                  <Plus size={14} /> Add card
                </button>
              </div>
            </section>
          );
        })}
    </div>
  );
}

