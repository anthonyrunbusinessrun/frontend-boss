"use client";

import { ChevronUp, Info } from "lucide-react";
import { useCallback, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { FieldDef } from "@/components/popovers/fields";
import { Sidebar, type SidebarConfig } from "@/components/shell/Sidebar";
import shell from "@/components/shell/shell.module.css";
import { DataTable, TableFooter, type DataTableProps } from "@/components/table/DataTable";
import { themeToStyle } from "@/components/table/theme";
import { Pagination } from "@/components/ui/Pagination";
import { cn } from "@/lib/cn";
import type { RecordSet } from "@/types";
import styles from "./view.module.css";
import { ViewToolbar, type ToolbarConfig } from "./ViewToolbar";

export interface WorkspaceProps<T> {
  sidebar: SidebarConfig;
  title: string;
  /** Title uses the softer #e2e8f0 colour (some screens). */
  titleLight?: boolean;
  /** Title font size (20 by default; the uppercase titles on Transactions / Items are 22). */
  titleSize?: number;
  /** Horizontal content padding (20 by default; the Items screen uses 25). */
  padX?: number;
  subtitle?: string;
  /** Dimmer subtitle colour (Items screen). */
  subtitleDim?: boolean;
  /** Right-aligned "Total: n Items Listed" badge slot. */
  titleAside?: ReactNode;
  toolbar: ToolbarConfig;
  fields: FieldDef[];
  /** Absolute y of the toolbar top, relative to the content area (measured per screen). */
  toolbarTop: number;
  /** Extra right inset of the toolbar's right cluster (the Profiles screen is drawn 33px narrower). */
  toolbarInsetRight?: number;
  /** Gap between toolbar and table (measured per screen). */
  tableGap: number;
  data: RecordSet<T>;
  table: Omit<DataTableProps<T>, "groups" | "collapsed" | "onToggleGroup" | "footer">;
  footer?: { placement: "inside" | "outside"; variant?: "plain" | "boxed"; text?: boolean };
  /** Rendered under the table (Vouchers legend panel). */
  after?: ReactNode;
}

/**
 * One screen of the app below the tab bar: sidebar + title + toolbar + table (+ footer).
 */
export function Workspace<T>({
  sidebar,
  title,
  titleLight,
  titleSize,
  padX,
  subtitle,
  subtitleDim,
  titleAside,
  toolbar,
  fields,
  toolbarTop,
  toolbarInsetRight,
  tableGap,
  data,
  table,
  footer,
  after,
}: WorkspaceProps<T>) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [page, setPage] = useState(1);

  const toggleGroup = useCallback(
    (id: string) =>
      setCollapsed((c) => {
        const next = new Set(c);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );
  const collapseAll = useCallback(() => setCollapsed(new Set(data.groups.filter((g) => g.label !== undefined).map((g) => g.id))), [data.groups]);
  const expandAll = useCallback(() => setCollapsed(new Set()), []);

  const footerNode = useMemo(() => {
    if (!footer || !data.range) return null;
    const { from, to, total } = data.range;
    return (
      <TableFooter inside={footer.placement === "inside"}>
        <span>{`Showing ${from}-${to} of ${total} records`}</span>
        {/* Only the first page is designed (NEEDS CLARIFICATION: further pages). */}
        <Pagination page={page} pages={Math.max(1, Math.ceil(total / Math.max(1, to - from + 1)))} onChange={setPage} variant={footer.variant ?? "boxed"} />
      </TableFooter>
    );
  }, [footer, data.range, page]);

  const mainStyle = { "--toolbar-top": `${toolbarTop}px`, "--table-gap": `${tableGap}px`, "--pad-x": `${padX ?? 20}px`, "--toolbar-inset": `${toolbarInsetRight ?? 0}px` } as CSSProperties;

  return (
    <div className={shell.workspace}>
      <Sidebar config={sidebar} />
      <main className={styles.main} style={mainStyle}>
        <div className={styles.head}>
          <div className={styles.titleRow}>
            <h1 className={cn(styles.title, titleLight && styles.titleLight)} style={titleSize ? { fontSize: titleSize } : undefined}>{title}</h1>
            {subtitle && <p className={cn(styles.subtitle, subtitleDim && styles.subtitleDim)}>{subtitle}</p>}
          </div>
          <ViewToolbar config={toolbar} fields={fields} onCollapseAll={collapseAll} onExpandAll={expandAll} />
        </div>
        {titleAside && <div className={styles.totalSlot}>{titleAside}</div>}
        <div className={styles.body} style={themeToStyle(table.theme)}>
          <DataTable<T>
            {...table}
            groups={data.groups}
            collapsed={collapsed}
            onToggleGroup={toggleGroup}
            footer={footer?.placement === "inside" ? footerNode : undefined}
          />
          {footer?.placement === "outside" && footerNode}
          {after && <div className={styles.after}>{after}</div>}
        </div>
      </main>
    </div>
  );
}

/** Collapsible informational panel (Vouchers "Legend & System Notes"). */
export function LegendPanel({ title, entries }: { title: string; entries: { term: string; text: string }[] }) {
  const [open, setOpen] = useState(true);
  return (
    <section className={styles.legend} aria-label={title}>
      <button type="button" className={styles.legendHead} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className={styles.legendTitle}>
          <Info size={18} strokeWidth={1.75} aria-hidden />
          {title}
        </span>
        <ChevronUp size={18} className={cn(styles.chevFlip, !open && styles.chevDown)} aria-hidden />
      </button>
      {open && (
        <div className={styles.legendBody}>
          {entries.map((e) => (
            <div key={e.term} style={{ display: "contents" }}>
              <span className={styles.legendTerm}>{e.term}</span>
              <span>{e.text}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
