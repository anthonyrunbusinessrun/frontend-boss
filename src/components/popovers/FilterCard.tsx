"use client";

import { Check, ChevronDown, CircleHelp, Copy, GripVertical, Info, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { fieldType, OPS_BY_TYPE, OPS_WITHOUT_VALUE, type FilterCondition, type FilterOp } from "@/components/table/tableState";
import { cn } from "@/lib/cn";
import type { FieldDef } from "./fields";
import styles from "./popovers.module.css";

export const FILTER_CARD_WIDTH = 608;

/** Conditions drawn in the design (Profiles). Used by the dev gallery and as the Profiles starting point. */
export const DESIGN_FILTER: FilterCondition[] = [
  { id: 1, join: "and", field: "Team", op: "is", value: true },
  { id: 2, join: "and", field: "Inactive", op: "is", value: false },
];

interface FilterCardProps {
  fields: FieldDef[];
  /** Controlled conditions. When omitted the card keeps its own state (dev gallery). */
  conditions?: FilterCondition[];
  onChange?: (conditions: FilterCondition[]) => void;
}

function defaultCondition(id: number, f: FieldDef | undefined): FilterCondition {
  const type = f ? fieldType(f) : "text";
  return { id, join: "and", field: f?.name ?? "", op: OPS_BY_TYPE[type][0].op, value: type === "boolean" ? true : "" };
}

/** Filter — Cards:Modals/filter-inactive-card.png. Conditions are applied to the table as they are edited. */
export function FilterCard({ fields, conditions: controlled, onChange }: FilterCardProps) {
  const [own, setOwn] = useState<FilterCondition[]>(DESIGN_FILTER);
  const rows = controlled ?? own;
  const setRows = (next: FilterCondition[]) => (onChange ? onChange(next) : setOwn(next));
  const nextId = () => rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;
  const byName = new Map(fields.map((f) => [f.name, f]));

  const update = (id: number, patch: Partial<FilterCondition>) => setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const changeField = (r: FilterCondition, name: string) => {
    const f = byName.get(name);
    const next = defaultCondition(r.id, f);
    update(r.id, { field: name, op: next.op, value: next.value });
  };

  return (
    <>
      <div className={styles.banner}>
        <Info size={20} className={styles.bannerIcon} aria-hidden />
        <p>
          The following 3 linked record fields are using this view&apos;s filter conditions for record selection:{" "}
          <span className={styles.bannerStrong}>Team Link</span> (from <span style={{ color: "var(--accent-cyan)", fontWeight: 700 }}>BOSS</span>) ,{" "}
          <span className={styles.bannerStrong}>Cord</span> (from <span style={{ color: "#3b82c4", fontWeight: 700 }}>Folios</span>) ,{" "}
          <span className={styles.bannerStrong}>QA</span> (from <span style={{ color: "var(--brand-red)", fontWeight: 700 }}>Actions</span>)
        </p>
      </div>
      <div className={styles.filterBody}>
        <h2 className={styles.filterTitle}>
          Filter
          <span className={styles.help}>
            <CircleHelp size={18} strokeWidth={1.75} aria-hidden />
          </span>
        </h2>
        {/* AI prompt: no behaviour is designed for it. */}
        <label className={styles.prompt}>
          <Sparkles size={22} className={styles.promptIcon} aria-hidden />
          <input className={styles.promptInput} placeholder="Describe what you want to see…" aria-label="Describe what you want to see" />
        </label>
        <p className={styles.muted}>{rows.length === 0 ? "No filter conditions are applied. Add one to narrow this view." : "In this view, show records"}</p>
        <div className={styles.conditions}>
          {rows.map((r, i) => {
            const f = byName.get(r.field);
            const type = f ? fieldType(f) : "text";
            const ops = OPS_BY_TYPE[type];
            return (
              <div className={styles.condRow} key={r.id}>
                {i === 0 ? (
                  <span className={styles.condLead}>Where</span>
                ) : (
                  <label className={cn(styles.select, styles.condLead)} style={{ width: 59, padding: "0 8px 0 12px", textAlign: "left", color: "#fff" }}>
                    <select aria-label="Join" value={r.join} onChange={(e) => update(r.id, { join: e.target.value as "and" | "or" })} style={{ all: "unset", flex: 1, cursor: "pointer" }}>
                      <option value="and">and</option>
                      <option value="or">or</option>
                    </select>
                    <ChevronDown size={14} aria-hidden />
                  </label>
                )}
                <label className={cn(styles.select, styles.selectField)}>
                  <select aria-label="Field" value={r.field} onChange={(e) => changeField(r, e.target.value)} style={{ all: "unset", flex: 1, cursor: "pointer", minWidth: 0 }}>
                    {fields.map((x) => (
                      <option key={x.name} value={x.name}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} aria-hidden />
                </label>
                {type === "boolean" ? (
                  <>
                    <span className={cn(styles.select, styles.selectOp)}>is</span>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={r.value === true}
                      aria-label={`${r.field} value`}
                      className={cn(styles.select, styles.selectValue)}
                      onClick={() => update(r.id, { value: r.value !== true })}
                    >
                      <span className={cn(styles.cb, r.value === true && styles.cbOn)}>{r.value === true ? <Check size={14} strokeWidth={3} /> : null}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <label className={cn(styles.select, styles.selectOpWide)}>
                      <select aria-label="Operator" value={r.op} onChange={(e) => update(r.id, { op: e.target.value as FilterOp })} style={{ all: "unset", flex: 1, cursor: "pointer", minWidth: 0 }}>
                        {ops.map((o) => (
                          <option key={o.op} value={o.op}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} aria-hidden />
                    </label>
                    {OPS_WITHOUT_VALUE.has(r.op) ? (
                      <span className={styles.selectValue} aria-hidden />
                    ) : (
                      <input
                        className={cn(styles.select, styles.selectValue, styles.valueInput)}
                        aria-label={`${r.field} filter value`}
                        type={type === "number" ? "number" : type === "date" ? "date" : "text"}
                        value={String(r.value)}
                        placeholder="Enter a value"
                        onChange={(e) => update(r.id, { value: e.target.value })}
                      />
                    )}
                  </>
                )}
                <button type="button" className={styles.condDelete} aria-label="Delete condition" onClick={() => setRows(rows.filter((x) => x.id !== r.id))}>
                  <Trash2 size={16} strokeWidth={1.75} />
                </button>
                <span className={styles.grip} aria-hidden>
                  <GripVertical size={16} />
                </span>
              </div>
            );
          })}
        </div>
        <div className={styles.filterFoot}>
          <button type="button" className={styles.cyanLink} onClick={() => setRows([...rows, defaultCondition(nextId(), fields.find((f) => f.key !== undefined || f.get !== undefined) ?? fields[0])])}>
            <Plus size={16} strokeWidth={2.5} aria-hidden /> Add condition
          </button>
          {/* NEEDS CLARIFICATION: condition groups are not designed beyond this link. */}
          <button type="button" className={styles.cyanLink}>
            <Plus size={16} strokeWidth={2.5} aria-hidden /> Add condition group
            <CircleHelp size={14} className={styles.help} aria-hidden />
          </button>
          {rows.length > 0 ? (
            <button type="button" className={cn(styles.ghostLink, styles.footSpacer)} onClick={() => setRows([])}>
              <Trash2 size={16} strokeWidth={1.75} aria-hidden /> Clear all
            </button>
          ) : (
            <button type="button" className={cn(styles.ghostLink, styles.footSpacer)}>
              <Copy size={16} strokeWidth={1.75} aria-hidden /> Copy from another view
            </button>
          )}
        </div>
      </div>
    </>
  );
}
