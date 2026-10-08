"use client";

import { Search, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Popover } from "@/components/popovers/Popover";
import { PROFILE_MENU_WIDTH, ProfileMenu } from "@/components/popovers/ProfileMenu";
import { useGlobalSearch } from "./SearchContext";
import styles from "./shell.module.css";

/** Top header — Components/top-header.png. Avatar opens the account menu; the search box filters the current table. */
export function TopHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { query, setQuery } = useGlobalSearch();
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <Image src="/brand/boss-logo.png" alt="BOSS" width={28} height={28} className={styles.logo} priority />
        <span className={styles.product}>Business Operating Systems Solutions</span>
      </div>
      <div className={styles.headerRight}>
        <label className={styles.search}>
          <Search size={18} className={styles.searchIcon} aria-hidden />
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search profiles, transactions, and categories…"
            aria-label="Search the current table"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQuery("");
            }}
          />
          {query && (
            <button type="button" className={styles.searchClear} aria-label="Clear search" onClick={() => setQuery("")}>
              <X size={14} />
            </button>
          )}
        </label>
        <div className={styles.user}>
          <div className={styles.userText}>
            <p className={styles.userName}>RayLand</p>
            <p className={styles.userRole}>CEO</p>
          </div>
          <Popover
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            width={PROFILE_MENU_WIDTH}
            align="right"
            label="Account menu"
            panelStyle={{ top: "calc(100% + 10px)" }}
            trigger={
              <button type="button" className={styles.avatarBtn} aria-haspopup="dialog" aria-expanded={menuOpen} aria-label="Account menu" onClick={() => setMenuOpen((o) => !o)}>
                RL
              </button>
            }
          >
            <ProfileMenu />
          </Popover>
        </div>
      </div>
    </header>
  );
}
