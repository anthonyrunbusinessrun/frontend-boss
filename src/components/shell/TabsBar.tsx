"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { MODULE_TABS, SECTIONS } from "@/lib/sections";
import styles from "./shell.module.css";

interface Tab {
  key: string;
  href: string;
  label: string;
  badge?: string;
  active: boolean;
}

/**
 * Primary tab bar — Components/tabs-bar.png. Module tabs (AIS) come first, then the BOSS tabs.
 * The active tab is derived from the route.
 */
export function TabsBar() {
  const pathname = usePathname();
  const router = useRouter();
  const nav = useRef<HTMLElement>(null);
  // On narrow screens the tab strip scrolls: keep the current tab in view.
  useEffect(() => {
    nav.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [pathname]);

  const tabs: Tab[] = [
    ...MODULE_TABS.map((m) => ({ key: m.slug, href: m.href, label: m.label, badge: m.badge, active: pathname === m.href || pathname.startsWith(`${m.href}/`) })),
    ...SECTIONS.map((s) => ({ key: s.slug, href: `/${s.slug}`, label: s.label, active: pathname === `/${s.slug}` })),
  ];

  return (
    <nav ref={nav} className={styles.tabs} aria-label="Primary">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          prefetch={false}
          onMouseEnter={() => router.prefetch(t.href)}
          onFocus={() => router.prefetch(t.href)}
          className={cn(styles.tab, t.active && styles.tabActive)}
          aria-current={t.active ? "page" : undefined}
        >
          {t.label}
          {t.badge && <span className={styles.tabBadge}>{t.badge}</span>}
        </Link>
      ))}
    </nav>
  );
}
