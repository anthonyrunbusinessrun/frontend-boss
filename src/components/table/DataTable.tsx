"use client";

import { ChevronDown } from "lucide-react";
import { Fragment, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { AddRowButton } from "@/components/ui/AddRowButton";
import { Checkbox } from "@/components/ui/Checkbox";
import { cn } from "@/lib/cn";
import type { RecordGroup } from "@/types";
import styles from "./table.module.css";
import { themeToStyle, type TableTheme } from "./theme";

function padStyle(left?: number, right?: number): CSSProperties | undefined {
  if (left === undefined && right === undefined) return undefined;
  return {
    ...(left !== undefined ? { paddingLeft: left } : {}),
    ...(right !== undefined ? { paddingRight: right } : {}),
  };
}

export interface Column<T> {
  key: string;
  header?: ReactNode;
  /** Column width in CSS px. Omit on the last column to let it absorb free space. */
  width?: number;
  align?: "left" | "center" | "right";
  /** Override of the default 16px left padding on the first column / 0 elsewhere. */
  padLeft?: number;
  /** Override of the default right padding (16px, 0 when centred). */
  padRight?: number;
  /** Header-only overrides, for screens where header text is offset from cell text. */
  headPadLeft?: number;
  headPadRight?: number;
  /** Allow multi-line content (chips wrapping). Default is single-line with ellipsis. */
  wrap?: boolean;
  render: (row: T, ctx: { index: number; selected: boolean }) => ReactNode;
}

export interface SelectionConfig<T = never> {
  width: number;
  /** Left padding of the checkbox cell. */
  padLeft?: number;
  /** Extra content after the checkbox, e.g. the row number. */
  after?: (row: T, index: number) => ReactNode;
  /** Row ids selected initially (the designs show some pre-checked rows). */
  initial?: string[];
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  groups: RecordGroup<T>[];
  rowKey: (row: T) => string;
  rowLabel: (row: T) => string;
  theme?: TableTheme;
  selection?: SelectionConfig<T>;
  collapsed: ReadonlySet<string>;
  onToggleGroup: (id: string) => void;
  /** Group header content (label + count badge). */
  renderGroupLabel?: (group: RecordGroup<T>) => ReactNode;
  /** Cell content for the per-group sum row; label goes in the first data column. */
  sumRow?: { label: ReactNode; labelColumn: string; render: (group: RecordGroup<T>, column: Column<T>) => ReactNode };
  /** Show an "Add row" line under a group. */
  addRow?: { tone: "red" | "blue"; show?: (group: RecordGroup<T>, index: number) => boolean };
  /** Inside the bordered container, e.g. the pagination strip. */
  footer?: ReactNode;
  /** Fixed horizontal scroll width override (tables wider than the viewport). */
  className?: string;
}

/**
 * Generic grouped data table. All view-specific appearance comes from the
 * `theme` and column definitions, so every screen reuses this one component.
 */
export function DataTable<T>({
  columns,
  groups,
  rowKey,
  rowLabel,
  theme,
  selection,
  collapsed,
  onToggleGroup,
  renderGroupLabel,
  sumRow,
  addRow,
  footer,
}: DataTableProps<T>) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(selection?.initial ?? []));
  const allRows = useMemo(() => groups.flatMap((g) => g.rows), [groups]);
  const allSelected = allRows.length > 0 && allRows.every((r) => selected.has(rowKey(r)));
  const colCount = columns.length + (selection ? 1 : 0);
  // The last column may be unsized (it absorbs free space); reserve a minimum for it.
  const totalWidth = (selection?.width ?? 0) + columns.reduce((sum, c) => sum + (c.width ?? 120), 0);

  const toggleRow = (id: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  let runningIndex = -1;

  return (
    <div className={styles.wrap} style={{ ...themeToStyle(theme), minWidth: totalWidth + 2 }}>
      <table className={styles.table}>
        <colgroup>
          {selection && <col style={{ width: selection.width }} />}
          {columns.map((c) => (
            <col key={c.key} style={c.width ? { width: c.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {selection && (
              <th className={styles.th} style={{ ...padStyle(selection.padLeft ?? 16, 0) }} scope="col">
                <Checkbox
                  checked={allSelected}
                  label="Select all rows"
                  onChange={(on) => setSelected(on ? new Set(allRows.map(rowKey)) : new Set())}
                />
              </th>
            )}
            {columns.map((c, i) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  styles.th,
                  i === 0 && !selection && c.align !== "center" && styles.thFirst,
                  c.align === "center" && styles.alignCenter,
                  c.align === "right" && styles.alignRight,
                )}
                style={padStyle(c.headPadLeft ?? c.padLeft, c.headPadRight ?? c.padRight)}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group, gi) => {
            const isCollapsed = collapsed.has(group.id);
            return (
              <Fragment key={group.id}>
                {group.label !== undefined && (
                  <tr>
                    <td className={styles.groupTd} colSpan={colCount}>
                      <button type="button" className={styles.groupBtn} aria-expanded={!isCollapsed} onClick={() => onToggleGroup(group.id)}>
                        <ChevronDown size={14} strokeWidth={2.5} className={cn(styles.chev, isCollapsed && styles.chevClosed)} aria-hidden />
                        {renderGroupLabel ? renderGroupLabel(group) : group.label}
                      </button>
                    </td>
                  </tr>
                )}
                {group.rows.map((row) => {
                  runningIndex += 1;
                  const index = runningIndex;
                  if (isCollapsed) return null;
                  const id = rowKey(row);
                  const isSel = selected.has(id);
                  return (
                    <tr key={id} className={cn(styles.row, index % 2 === 0 ? styles.rowA : styles.rowB, isSel && selection && styles.rowSelected)}>
                      {selection && (
                        <td className={styles.td} style={padStyle(selection.padLeft ?? 16, 0)}>
                          <span className={styles.selCell}>
                            <Checkbox checked={isSel} label={`Select ${rowLabel(row)}`} onChange={(on) => toggleRow(id, on)} />
                            {selection.after?.(row, index)}
                          </span>
                        </td>
                      )}
                      {columns.map((c, ci) => (
                        <td
                          key={c.key}
                          className={cn(
                            styles.td,
                            ci === 0 && !selection && c.align !== "center" && styles.tdFirst,
                            c.wrap && styles.tdWrap,
                            c.align === "center" && styles.alignCenter,
                            c.align === "right" && styles.alignRight,
                          )}
                          style={padStyle(c.padLeft, c.padRight)}
                        >
                          {c.render(row, { index, selected: isSel })}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {!isCollapsed && sumRow && group.sums && (
                  <tr>
                    {selection && <td className={styles.sumTd} />}
                    {columns.map((c, ci) => (
                      <td
                        key={c.key}
                        className={cn(styles.sumTd, ci === 0 && !selection && styles.tdFirst, c.align === "right" && styles.alignRight, c.align === "center" && styles.alignCenter)}
                        style={padStyle(c.padLeft, c.padRight)}
                      >
                        {c.key === sumRow.labelColumn ? <span className={styles.sumLabel}>{sumRow.label}</span> : sumRow.render(group, c)}
                      </td>
                    ))}
                  </tr>
                )}
                {!isCollapsed && addRow && (addRow.show ? addRow.show(group, gi) : true) && (
                  <tr>
                    <td className={styles.addTd} colSpan={colCount}>
                      <AddRowButton tone={addRow.tone} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {footer}
    </div>
  );
}

export function TableFooter({ children, inside = true }: { children: ReactNode; inside?: boolean }) {
  return <div className={cn(styles.footer, inside ? styles.footerInside : styles.footerOutside)}>{children}</div>;
}
