"use client";

import { ArrowDownAZ, ArrowUpAZ, CircleHelp, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { fieldType, isEvaluable, type SortRule } from "@/components/table/tableState";
import { cn } from "@/lib/cn";
import { FieldIcon, type FieldDef } from "./fields";
import styles from "./popovers.module.css";

export const SORT_CARD_WIDTH = 340;
export const SORT_CARD_HEIGHT = 640;

const DIR_LABEL = {
  text: { asc: "A → Z", desc: "Z → A" },
  number: { asc: "1 → 9", desc: "9 → 1" },
  date: { asc: "Oldest first", desc: "Newest first" },
  boolean: { asc: "Unchecked first", desc: "Checked first" },
  list: { asc: "A → Z", desc: "Z → A" },
} as const;

interface SortCardProps {
  fields: FieldDef[];
  /** Controlled rules. When omitted the card keeps its own state (dev gallery). */
  rules?: SortRule[];
  onChange?: (rules: SortRule[]) => void;
}

/** "Sort within groups by" — Cards:Modals/action-sort-card.png. Picking a field adds a sort rule. */
export function SortCard({ fields, rules: controlled, onChange }: SortCardProps) {
  const [own, setOwn] = useState<SortRule[]>([]);
  const rules = controlled ?? own;
  const setRules = (next: SortRule[]) => (onChange ? onChange(next) : setOwn(next));

  const [query, setQuery] = useState("");
  const used = useMemo(() => new Set(rules.map((r) => r.field)), [rules]);
  const shown = useMemo(() => fields.filter((f) => !used.has(f.name) && f.name.toLowerCase().includes(query.trim().toLowerCase())), [fields, query, used]);
  const byName = useMemo(() => new Map(fields.map((f) => [f.name, f])), [fields]);

  return (
    <>
      <div className={styles.header}>
        <span className={styles.title}>
          Sort within groups by
          <span className={styles.help}>
            <CircleHelp size={16} strokeWidth={1.75} aria-hidden />
          </span>
        </span>
        {rules.length > 0 ? (
          <button type="button" className={styles.headerLink} onClick={() => setRules([])}>
            Clear sort
          </button>
        ) : (
          <span className={styles.headerHint}>Pick a field</span>
        )}
      </div>
      <div className={styles.sortBody}>
        {rules.length > 0 && (
          <ul className={styles.sortRules} aria-label="Active sorts">
            {rules.map((r, i) => {
              const f = byName.get(r.field);
              const labels = DIR_LABEL[f ? fieldType(f) : "text"];
              return (
                <li key={r.field} className={styles.sortRule}>
                  <span className={styles.sortRuleName}>
                    {i + 1}. {r.field}
                  </span>
                  <button
                    type="button"
                    className={styles.dirBtn}
                    aria-label={`${r.field}: ${labels[r.dir]}. Change direction`}
                    onClick={() => setRules(rules.map((x) => (x.field === r.field ? { ...x, dir: x.dir === "asc" ? "desc" : "asc" } : x)))}
                  >
                    {r.dir === "asc" ? <ArrowUpAZ size={14} aria-hidden /> : <ArrowDownAZ size={14} aria-hidden />}
                    {labels[r.dir]}
                  </button>
                  <button type="button" className={styles.dirRemove} aria-label={`Remove sort by ${r.field}`} onClick={() => setRules(rules.filter((x) => x.field !== r.field))}>
                    <X size={14} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <label className={styles.search}>
          <Search size={18} className={styles.searchIcon} aria-hidden />
          <input className={styles.searchInput} placeholder="Find a field" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find a field" />
        </label>
        <ul className={styles.fieldList}>
          {shown.map((f) => {
            const ok = isEvaluable(f);
            return (
              <li key={f.name}>
                <button
                  type="button"
                  className={cn(styles.fieldItem, !ok && styles.fieldItemOff)}
                  disabled={!ok}
                  title={ok ? `Sort by ${f.name}` : "This field is not available for sorting in this view"}
                  onClick={() => setRules([...rules, { field: f.name, dir: "asc" }])}
                >
                  <span className={styles.fieldIcon}>
                    <FieldIcon kind={f.kind} style="sort" size={18} />
                  </span>
                  {f.name}
                </button>
              </li>
            );
          })}
          {shown.length === 0 && <li className={styles.fieldEmpty}>No matching fields</li>}
        </ul>
      </div>
    </>
  );
}
