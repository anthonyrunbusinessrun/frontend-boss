"use client";

import { ArrowDown, ArrowUp, ChevronDown } from "lucide-react";
import { Fragment, useMemo, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { AddRowButton } from "@/components/ui/AddRowButton";
import { Checkbox } from "@/components/ui/Checkbox";
import { SkeletonBar } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import type { RecordGroup } from "@/types";
import { useRecordActions, RowContext } from "./RecordContext";
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
  /** Column keys hidden through the "Hide fields" card. */
  hiddenColumns?: ReadonlySet<string>;
  /** Controlled selection. Without it the table keeps its own state. */
  selected?: ReadonlySet<string>;
  onSelectedChange?: (next: Set<string>) => void;
  /** Column keys that can be sorted by clicking their header, and the current sort. */
  sortableColumns?: ReadonlySet<string>;
  sortState?: { column: string; dir: "asc" | "desc" } | null;
  onSortColumn?: (columnKey: string) => void;
  /** Opens the record when a row (not one of its controls) is clicked / Enter is pressed. */
  onRowClick?: (row: T) => void;
  /** Shown instead of rows when there is nothing to display. */
  empty?: ReactNode;
  loading?: boolean;
  /** Added to the row index handed to column renderers (pagination). */
  indexOffset?: number;
}

/** Cells cut off with an ellipsis show their full text as a tooltip. */
function revealIfTruncated(e: MouseEvent<HTMLTableCellElement>) {
  const td = e.currentTarget;
  if (td.scrollWidth > td.clientWidth + 1 && !td.title) td.title = td.innerText.trim();
}

const INTERACTIVE = "button, a, input, select, textarea, label, [role='checkbox']";

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
  hiddenColumns,
  selected: selectedProp,
  onSelectedChange,
  sortableColumns,
  sortState,
  onSortColumn,
  onRowClick,
  empty,
  loading,
  indexOffset = 0,
}: DataTableProps<T>) {
  const actions = useRecordActions();
  const [ownSelected, setOwnSelected] = useState<Set<string>>(() => new Set(selection?.initial ?? []));
  const selected = selectedProp ?? ownSelected;
  const setSelected = (next: Set<string>) => (onSelectedChange ? onSelectedChange(next) : setOwnSelected(next));

  const visibleColumns = useMemo(() => (hiddenColumns && hiddenColumns.size > 0 ? columns.filter((c) => !hiddenColumns.has(c.key)) : columns), [columns, hiddenColumns]);
  const allRows = useMemo(() => groups.flatMap((g) => g.rows), [groups]);
  const allSelected = allRows.length > 0 && allRows.every((r) => selected.has(rowKey(r)));
  const colCount = visibleColumns.length + (selection ? 1 : 0);
  // The last column may be unsized (it absorbs free space); reserve a minimum for it.
  const totalWidth = (selection?.width ?? 0) + visibleColumns.reduce((sum, c) => sum + (c.width ?? 120), 0);
  const hasRows = allRows.length > 0;

  const toggleRow = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  };

  const rowHandlers = (row: T) =>
    onRowClick
      ? {
          onClick: (e: MouseEvent<HTMLTableRowElement>) => {
            if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
            onRowClick(row);
          },
          onKeyDown: (e: KeyboardEvent<HTMLTableRowElement>) => {
            if (e.key === "Enter" && e.target === e.currentTarget) onRowClick(row);
          },
          tabIndex: 0,
        }
      : {};

  let runningIndex = indexOffset - 1;

  return (
    <div className={styles.wrap} style={{ ...themeToStyle(theme), minWidth: totalWidth + 2 }}>
      <table className={styles.table}>
        <colgroup>
          {selection && <col style={{ width: selection.width }} />}
          {visibleColumns.map((c) => (
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
            {visibleColumns.map((c, i) => {
              const sortable = !!onSortColumn && !!sortableColumns?.has(c.key) && typeof c.header === "string";
              const sorted = sortState?.column === c.key ? sortState.dir : null;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined}
                  className={cn(
                    styles.th,
                    i === 0 && !selection && c.align !== "center" && styles.thFirst,
                    c.align === "center" && styles.alignCenter,
                    c.align === "right" && styles.alignRight,
                  )}
                  style={padStyle(c.headPadLeft ?? c.padLeft, c.headPadRight ?? c.padRight)}
                >
                  {sortable ? (
                    <button type="button" className={styles.sortBtn} onClick={() => onSortColumn?.(c.key)} title={`Sort by ${c.header as string}`}>
                      {c.header}
                      {sorted === "asc" && <ArrowUp size={12} strokeWidth={2.5} aria-hidden />}
                      {sorted === "desc" && <ArrowDown size={12} strokeWidth={2.5} aria-hidden />}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <>
              {Array.from({ length: 6 }, (_, i) => (
                <tr key={`sk-${i}`} className={cn(styles.row, i % 2 === 0 ? styles.rowA : styles.rowB)} aria-hidden>
                  {Array.from({ length: colCount }, (_c, ci) => (
                    <td key={ci} className={cn(styles.td, ci === 0 && styles.tdFirst)}>
                      <SkeletonBar width={ci === 0 ? 24 : `${45 + ((i * 17 + ci * 23) % 40)}%`} />
                    </td>
                  ))}
                </tr>
              ))}
            </>
          )}
          {!loading && !hasRows && empty && (
            <tr>
              <td className={styles.emptyTd} colSpan={colCount}>
                {empty}
              </td>
            </tr>
          )}
          {!loading && groups.map((group, gi) => {
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
                    <tr
                      key={id}
                      className={cn(styles.row, index % 2 === 0 ? styles.rowA : styles.rowB, isSel && selection && styles.rowSelected, onRowClick && styles.rowClickable)}
                      aria-selected={selection ? isSel : undefined}
                      {...rowHandlers(row)}
                    >
                      <RowContext.Provider value={row}>
                      {selection && (
                        <td className={styles.td} style={padStyle(selection.padLeft ?? 16, 0)}>
                          <span className={styles.selCell}>
                            <Checkbox checked={isSel} label={`Select ${rowLabel(row)}`} onChange={(on) => toggleRow(id, on)} />
                            {selection.after?.(row, index)}
                          </span>
                        </td>
                      )}
                      {visibleColumns.map((c, ci) => (
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
                          onMouseEnter={revealIfTruncated}
                        >
                          {c.render(row, { index, selected: isSel })}
                        </td>
                      ))}
                      </RowContext.Provider>
                    </tr>
                  );
                })}
                {!isCollapsed && sumRow && group.sums && (
                  <tr>
                    {selection && <td className={styles.sumTd} />}
                    {visibleColumns.map((c, ci) => (
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
                      <AddRowButton tone={addRow.tone} onClick={actions?.add ? () => actions.add?.(group.id) : undefined} />
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
