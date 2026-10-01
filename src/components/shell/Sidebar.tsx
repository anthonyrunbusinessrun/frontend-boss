"use client";

import {
  AlertCircle,
  Archive,
  Bookmark,
  Briefcase,
  Building2,
  ChevronDown,
  CirclePlus,
  Clock,
  Database,
  FileText,
  Folder,
  List,
  Lock,
  Plus,
  Search,
  Send,
  Settings,
  SlidersVertical,
  SquareKanban,
  Star,
  Table2,
  User,
  Users,
} from "lucide-react";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
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
 * Left sidebar. Only the active view of each screen is designed, so the other
 * entries are presentational (NEEDS CLARIFICATION: their destinations).
 */
export function Sidebar({ config }: { config: SidebarConfig }) {
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
      {/* NEEDS CLARIFICATION: the creation flow behind "Create new …" is not designed. */}
      <Button size="block" glow={config.ctaGlow} icon={<Plus size={16} strokeWidth={2.5} />}>
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
                  return (
                    <li key={item.id}>
                      <button type="button" className={cn(styles.item, item.active && styles.itemActive)} aria-current={item.active ? "page" : undefined}>
                        {item.dot ? (
                          <span className={styles.dot} style={{ background: item.dot }} aria-hidden />
                        ) : Icon ? (
                          <span className={styles.itemIcon}>
                            <Icon size={16} strokeWidth={1.75} />
                          </span>
                        ) : null}
                        <span className={styles.label}>{item.label}</span>
                        {item.count !== undefined && <span className={cn(styles.count, item.countTone === "purple" && styles.countPurple)}>{item.count}</span>}
                      </button>
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
