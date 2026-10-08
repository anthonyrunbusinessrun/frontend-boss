"use client";

import { CircleHelp, GripVertical, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { FieldIcon, type FieldDef } from "./fields";
import styles from "./popovers.module.css";

export const HIDDEN_CARD_WIDTH = 340;
export const HIDDEN_CARD_HEIGHT = 657;

interface HiddenFieldsCardProps {
  fields: FieldDef[];
  /** Names of the fields currently hidden. When omitted the card keeps its own state (dev gallery). */
  hidden?: ReadonlySet<string>;
  onChange?: (hidden: Set<string>) => void;
}

/** Field visibility manager — Cards:Modals/fields-hidden-manager-card.png. */
export function HiddenFieldsCard({ fields, hidden: controlled, onChange }: HiddenFieldsCardProps) {
  const [own, setOwn] = useState<ReadonlySet<string>>(() => new Set());
  const hidden = controlled ?? own;
  const setHidden = (next: Set<string>) => (onChange ? onChange(next) : setOwn(next));

  const [query, setQuery] = useState("");
  const shown = useMemo(() => fields.filter((f) => f.name.toLowerCase().includes(query.trim().toLowerCase())), [fields, query]);

  const toggle = (name: string) => {
    const next = new Set(hidden);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setHidden(next);
  };

  return (
    <>
      <div className={styles.managerHead}>
        <Search size={20} className={styles.help} aria-hidden />
        <input className={styles.managerSearch} placeholder="Find a field" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find a field" />
        <CircleHelp size={22} className={styles.help} aria-hidden />
      </div>
      <ul className={styles.managerList}>
        {shown.map((f) => {
          const visible = !hidden.has(f.name);
          return (
            <li key={f.name} className={styles.managerRow}>
              <button type="button" role="switch" aria-checked={visible} aria-label={`Show ${f.name}`} className={cn(styles.toggle, visible && styles.toggleOn)} onClick={() => toggle(f.name)} />
              <span className={styles.fieldIcon}>
                <FieldIcon kind={f.kind} style="manager" size={20} />
              </span>
              <span className={styles.managerLabel}>{f.name}</span>
              {/* Reordering is implied by the drag handle but not designed. */}
              <span className={styles.grip} aria-hidden>
                <GripVertical size={16} />
              </span>
            </li>
          );
        })}
        {shown.length === 0 && <li className={styles.fieldEmpty}>No matching fields</li>}
      </ul>
      <div className={styles.managerFoot}>
        <button type="button" className={styles.footBtn} onClick={() => setHidden(new Set(fields.map((f) => f.name)))}>
          Hide all
        </button>
        <button type="button" className={styles.footBtn} onClick={() => setHidden(new Set())}>
          Show all
        </button>
      </div>
    </>
  );
}
