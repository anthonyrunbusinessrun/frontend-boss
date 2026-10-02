"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { SECTIONS } from "@/lib/sections";
import styles from "./shell.module.css";

/** Primary tab bar — Components/tabs-bar.png. Active tab is derived from the route. */
export function TabsBar() {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <nav className={styles.tabs} aria-label="Primary">
      {SECTIONS.map((s) => {
        const active = pathname === `/${s.slug}`;
        return (
          <Link
            key={s.slug}
            href={`/${s.slug}`}
            prefetch={false}
            onMouseEnter={() => router.prefetch(`/${s.slug}`)}
            onFocus={() => router.prefetch(`/${s.slug}`)}
            className={cn(styles.tab, active && styles.tabActive)}
            aria-current={active ? "page" : undefined}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
