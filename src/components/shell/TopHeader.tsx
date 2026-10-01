"use client";

import { Search } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Popover } from "@/components/popovers/Popover";
import { PROFILE_MENU_WIDTH, ProfileMenu } from "@/components/popovers/ProfileMenu";
import styles from "./shell.module.css";

/** Top header — Components/top-header.png. Avatar opens the account menu. */
export function TopHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <Image src="/brand/boss-logo.png" alt="BOSS" width={28} height={28} className={styles.logo} priority />
        <span className={styles.product}>Business Operating Systems Solutions</span>
      </div>
      <div className={styles.headerRight}>
        {/* NEEDS CLARIFICATION: search results are not designed; the field is presentational. */}
        <label className={styles.search}>
          <Search size={18} className={styles.searchIcon} aria-hidden />
          <input className={styles.searchInput} type="search" placeholder="Search profiles, transactions, and categories…" aria-label="Global search" />
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
