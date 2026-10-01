"use client";

import { CircleHelp, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { FieldIcon, type FieldDef } from "./fields";
import styles from "./popovers.module.css";

export const SORT_CARD_WIDTH = 340;
export const SORT_CARD_HEIGHT = 640;

/** "Sort within groups by" — Cards:Modals/action-sort-card.png. */
export function SortCard({ fields }: { fields: FieldDef[] }) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => fields.filter((f) => f.name.toLowerCase().includes(query.trim().toLowerCase())), [fields, query]);
  return (
    <>
      <div className={styles.header}>
        <span className={styles.title}>
          Sort within groups by
          <span className={styles.help}>
            <CircleHelp size={16} strokeWidth={1.75} aria-hidden />
          </span>
        </span>
        {/* NEEDS CLARIFICATION: "Copy from a view" target is not designed. */}
        <button type="button" className={styles.headerLink}>
          Copy from a view
        </button>
      </div>
      <div className={styles.sortBody}>
        <label className={styles.search}>
          <Search size={18} className={styles.searchIcon} aria-hidden />
          <input className={styles.searchInput} placeholder="Find a field" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find a field" />
        </label>
        <ul className={styles.fieldList}>
          {shown.map((f) => (
            <li key={f.name}>
              <button type="button" className={styles.fieldItem}>
                <span className={styles.fieldIcon}>
                  <FieldIcon kind={f.kind} style="sort" size={18} />
                </span>
                {f.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
