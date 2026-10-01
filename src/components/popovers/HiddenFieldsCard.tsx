"use client";

import { CircleHelp, GripVertical, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { FieldIcon, type FieldDef } from "./fields";
import styles from "./popovers.module.css";

export const HIDDEN_CARD_WIDTH = 340;
export const HIDDEN_CARD_HEIGHT = 657;

/** Field visibility manager — Cards:Modals/fields-hidden-manager-card.png. */
export function HiddenFieldsCard({ fields }: { fields: FieldDef[] }) {
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState<Record<string, boolean>>(() => Object.fromEntries(fields.map((f) => [f.name, true])));
  const shown = useMemo(() => fields.filter((f) => f.name.toLowerCase().includes(query.trim().toLowerCase())), [fields, query]);
  const setAll = (value: boolean) => setVisible(Object.fromEntries(fields.map((f) => [f.name, value])));

  return (
    <>
      <div className={styles.managerHead}>
        <Search size={20} className={styles.help} aria-hidden />
        <input className={styles.managerSearch} placeholder="Find a field" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find a field" />
        <CircleHelp size={22} className={styles.help} aria-hidden />
      </div>
      <ul className={styles.managerList}>
        {shown.map((f) => (
          <li key={f.name} className={styles.managerRow}>
            <button
              type="button"
              role="switch"
              aria-checked={visible[f.name]}
              aria-label={`Show ${f.name}`}
              className={cn(styles.toggle, visible[f.name] && styles.toggleOn)}
              onClick={() => setVisible((v) => ({ ...v, [f.name]: !v[f.name] }))}
            />
            <span className={styles.fieldIcon}>
              <FieldIcon kind={f.kind} style="manager" size={20} />
            </span>
            <span className={styles.managerLabel}>{f.name}</span>
            {/* Reordering is implied by the drag handle but not designed. */}
            <span className={styles.grip} aria-hidden>
              <GripVertical size={16} />
            </span>
          </li>
        ))}
      </ul>
      <div className={styles.managerFoot}>
        <button type="button" className={styles.footBtn} onClick={() => setAll(false)}>
          Hide all
        </button>
        <button type="button" className={styles.footBtn} onClick={() => setAll(true)}>
          Show all
        </button>
      </div>
    </>
  );
}
