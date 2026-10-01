"use client";

import { Check, ChevronDown, CircleHelp, Copy, GripVertical, Info, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import type { FieldDef } from "./fields";
import styles from "./popovers.module.css";

export const FILTER_CARD_WIDTH = 608;

interface Condition {
  id: number;
  join: "and" | "or";
  field: string;
  value: boolean;
}

/** Filter — Cards:Modals/filter-inactive-card.png. */
export function FilterCard({ fields }: { fields: FieldDef[] }) {
  const checkboxFields = fields.filter((f) => f.kind === "checkbox");
  const [rows, setRows] = useState<Condition[]>([
    { id: 1, join: "and", field: "Team", value: true },
    { id: 2, join: "and", field: "Inactive", value: false },
  ]);
  const [nextId, setNextId] = useState(3);

  const update = (id: number, patch: Partial<Condition>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

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
        <p className={styles.muted}>In this view, show records</p>
        <div className={styles.conditions}>
          {rows.map((r, i) => (
            <div className={styles.condRow} key={r.id}>
              {i === 0 ? (
                <span className={styles.condLead}>Where</span>
              ) : (
                <label className={cn(styles.select, styles.condLead)} style={{ width: 59, padding: "0 8px 0 12px", textAlign: "left", color: "#fff" }}>
                  <select
                    aria-label="Join"
                    value={r.join}
                    onChange={(e) => update(r.id, { join: e.target.value as "and" | "or" })}
                    style={{ all: "unset", flex: 1, cursor: "pointer" }}
                  >
                    <option value="and">and</option>
                    <option value="or">or</option>
                  </select>
                  <ChevronDown size={14} aria-hidden />
                </label>
              )}
              <label className={cn(styles.select, styles.selectField)}>
                <select
                  aria-label="Field"
                  value={r.field}
                  onChange={(e) => update(r.id, { field: e.target.value })}
                  style={{ all: "unset", flex: 1, cursor: "pointer" }}
                >
                  {checkboxFields.map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} aria-hidden />
              </label>
              <span className={cn(styles.select, styles.selectOp)}>is</span>
              <button
                type="button"
                role="checkbox"
                aria-checked={r.value}
                aria-label={`${r.field} value`}
                className={cn(styles.select, styles.selectValue)}
                onClick={() => update(r.id, { value: !r.value })}
              >
                <span className={cn(styles.cb, r.value && styles.cbOn)}>{r.value ? <Check size={14} strokeWidth={3} /> : null}</span>
              </button>
              <button type="button" className={styles.condDelete} aria-label="Delete condition" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>
                <Trash2 size={16} strokeWidth={1.75} />
              </button>
              <span className={styles.grip} aria-hidden>
                <GripVertical size={16} />
              </span>
            </div>
          ))}
        </div>
        <div className={styles.filterFoot}>
          <button
            type="button"
            className={styles.cyanLink}
            onClick={() => {
              setRows((rs) => [...rs, { id: nextId, join: "and", field: checkboxFields[0]?.name ?? "Team", value: false }]);
              setNextId((n) => n + 1);
            }}
          >
            <Plus size={16} strokeWidth={2.5} aria-hidden /> Add condition
          </button>
          {/* NEEDS CLARIFICATION: condition groups are not designed beyond this link. */}
          <button type="button" className={styles.cyanLink}>
            <Plus size={16} strokeWidth={2.5} aria-hidden /> Add condition group
            <CircleHelp size={14} className={styles.help} aria-hidden />
          </button>
          <button type="button" className={cn(styles.ghostLink, styles.footSpacer)}>
            <Copy size={16} strokeWidth={1.75} aria-hidden /> Copy from another view
          </button>
        </div>
      </div>
    </>
  );
}
