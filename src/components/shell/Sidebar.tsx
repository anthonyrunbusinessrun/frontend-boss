"use client";

import {
  AlertCircle,
  Archive,
  Bookmark,
  Briefcase,
  Banknote,
  BookOpen,
  Building2,
  ChartColumn,
  ChevronDown,
  CirclePlus,
  Clock,
  CreditCard,
  Database,
  FileText,
  Folder,
  HandCoins,
  LayoutDashboard,
  Library,
  List,
  Lock,
  NotebookPen,
  Plus,
  ReceiptText,
  Scale,
  Search,
  Send,
  Settings,
  SlidersVertical,
  SquareKanban,
  Star,
  Table2,
  Truck,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import styles from "./shell.module.css";

const ICONS = {
  star: Star,
  folder: Folder,
  bookmark: Bookmark,
  building: Building2,
  users: Users,
  user: User,
  briefcase: Briefcase,
  sliders: SlidersVertical,
  archive: Archive,
  send: Send,
  alert: AlertCircle,
  settings: Settings,
  database: Database,
  table: Table2,
  list: List,
  clock: Clock,
  lock: Lock,
  plusCircle: CirclePlus,
  kanban: SquareKanban,
  file: FileText,
  // Accounting (AIS)
  dashboard: LayoutDashboard,
  book: BookOpen,
  journal: NotebookPen,
  ledger: Library,
  invoice: ReceiptText,
  payments: CreditCard,
  receivable: HandCoins,
  payable: Banknote,
  vendor: Truck,
  reports: ChartColumn,
  scale: Scale,
} as const;

export type SidebarIconName = keyof typeof ICONS;

export interface SidebarItem {
  id: string;
  label: string;
  icon?: SidebarIconName;
  /** Coloured dot used instead of an icon (Items view). */
  dot?: string;
  count?: number;
  countTone?: "red" | "purple";
  active?: boolean;
  /** Navigates when set. Items without one are saved views that are not connected yet. */
  href?: string;
}

export interface SidebarSection {
  id: string;
  label?: string;
  /** Section header has a collapse chevron. */
  collapsible?: boolean;
  items: SidebarItem[];
}

export interface SidebarConfig {
  cta: string;
  ctaGlow?: boolean;
  sections: SidebarSection[];
  /** Horizontal padding override (Items screen uses 12px). */
  padX?: number;
  itemGap?: number;
}

/**
 * Left sidebar. Only the active view of each BOSS screen is designed, so the other saved
 * views tell the user they are not connected yet (NEEDS CLARIFICATION: their destinations).
 * Sidebars built from routes (AIS) pass `href` on every item.
 */
export function Sidebar({ config, onCta }: { config: SidebarConfig; onCta?: () => void }) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return config.sections;
    return config.sections
      .map((s) => ({ ...s, items: s.items.filter((i) => i.label.toLowerCase().includes(q)) }))
      .filter((s) => s.items.length > 0);
  }, [config.sections, query]);

  const style = {
    ...(config.padX !== undefined ? { "--side-pad": `${config.padX}px` } : {}),
    ...(config.itemGap !== undefined ? { "--item-gap": `${config.itemGap}px` } : {}),
  } as CSSProperties;

  return (
    <aside className={styles.sidebar} style={style} aria-label="Views">
      <Button size="block" glow={config.ctaGlow} icon={<Plus size={16} strokeWidth={2.5} />} onClick={onCta}>
        {config.cta}
      </Button>
      <label className={styles.finder}>
        <Search size={16} className={styles.finderIcon} aria-hidden />
        <input className={styles.finderInput} placeholder="Find a view…" aria-label="Find a view" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {sections.map((section) => {
        const isCollapsed = !!collapsed[section.id] && !query;
        return (
          <section key={section.id} className={styles.section}>
            {section.label &&
              (section.collapsible ? (
                <button
                  type="button"
                  className={styles.sectionHead}
                  aria-expanded={!isCollapsed}
                  onClick={() => setCollapsed((c) => ({ ...c, [section.id]: !c[section.id] }))}
                >
                  {section.label}
                  <ChevronDown size={14} strokeWidth={2.5} className={cn(styles.chev, isCollapsed && styles.chevClosed)} aria-hidden />
                </button>
              ) : (
                <h3 className={styles.sectionHead}>{section.label}</h3>
              ))}
            {!isCollapsed && (
              <ul className={styles.list}>
                {section.items.map((item) => {
                  const Icon = item.icon ? ICONS[item.icon] : null;
                  const inner = (
                    <>
                      {item.dot ? (
                        <span className={styles.dot} style={{ background: item.dot }} aria-hidden />
                      ) : Icon ? (
                        <span className={styles.itemIcon}>
                          <Icon size={16} strokeWidth={1.75} />
                        </span>
                      ) : null}
                      <span className={styles.label}>{item.label}</span>
                      {item.count !== undefined && <span className={cn(styles.count, item.countTone === "purple" && styles.countPurple)}>{item.count}</span>}
                    </>
                  );
                  return (
                    <li key={item.id}>
                      {item.href ? (
                        <Link href={item.href} className={cn(styles.item, item.active && styles.itemActive)} aria-current={item.active ? "page" : undefined}>
                          {inner}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className={cn(styles.item, item.active && styles.itemActive)}
                          aria-current={item.active ? "page" : undefined}
                          onClick={item.active ? undefined : () => toast.info(`“${item.label}” is a saved view that is not connected to data yet.`)}
                        >
                          {inner}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </aside>
  );
}

export type { ReactNode };
