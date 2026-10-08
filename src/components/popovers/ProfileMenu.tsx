import {
  Bell,
  Cpu,
  Globe,
  Headphones,
  Heart,
  Keyboard,
  LayoutPanelTop,
  LogOut,
  Toolbox,
  Trash2,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import styles from "./popovers.module.css";

export const PROFILE_MENU_WIDTH = 280;

interface Item {
  label: string;
  icon: ReactNode;
  active?: boolean;
  danger?: boolean;
  chevron?: boolean;
  badge?: { text: string; bg: string };
  keys?: string[];
  href?: string;
}

const s = { size: 20, strokeWidth: 1.75 } as const;

const GROUPS: Item[][] = [
  [
    { label: "Account", icon: <User {...s} />, active: true },
    { label: "Manage groups", icon: <Users {...s} />, badge: { text: "BUSINESS", bg: "#ff8c2b" } },
    { label: "Notification preferences", icon: <Bell {...s} />, chevron: true },
    { label: "Language preferences", icon: <Globe {...s} />, chevron: true },
    { label: "Appearance", icon: <LayoutPanelTop {...s} />, badge: { text: "BETA", bg: "#f2c500" } },
    { label: "Keyboard shortcuts", icon: <Keyboard {...s} />, keys: ["⌘", "K"] },
  ],
  [
    { label: "Contact sales", icon: <Headphones {...s} /> },
    { label: "Upgrade", icon: <TrendingUp {...s} /> },
    { label: "Tell a friend", icon: <Heart {...s} /> },
  ],
  [
    { label: "Integrations", icon: <Cpu {...s} /> },
    { label: "Builder hub", icon: <Toolbox {...s} /> },
  ],
  [
    { label: "Trash", icon: <Trash2 {...s} />, danger: true },
    { label: "Log out", icon: <LogOut {...s} />, danger: true, href: "/sign-in" },
  ],
];

/**
 * Account menu — Cards:Modals/profile-dropdown-container-shadow.png.
 * "Log out" returns to sign-in; every other entry is NEEDS CLARIFICATION (no destination designed).
 */
export function ProfileMenu({ name = "RayLand", email = "RayLand@runbusiness.com", initials = "RL" }: { name?: string; email?: string; initials?: string }) {
  return (
    <>
      <div className={styles.profileHead}>
        <span className={styles.profileAvatar}>{initials}</span>
        <div>
          <p className={styles.profileName}>{name}</p>
          <p className={styles.profileEmail}>{email}</p>
        </div>
      </div>
      {GROUPS.map((group, gi) => (
        <div className={styles.profileGroup} key={gi}>
          {group.map((it) => {
            const content = (
              <>
                <span className={styles.menuIcon}>{it.icon}</span>
                {it.label}
                {it.badge && (
                  <span className={styles.planBadge} style={{ background: it.badge.bg }}>
                    {it.badge.text}
                  </span>
                )}
                {it.chevron && <ChevronRight size={18} className={styles.menuChevron} aria-hidden />}
                {it.keys && (
                  <span className={styles.keycaps}>
                    {it.keys.map((k) => (
                      <kbd key={k} className={styles.keycap}>
                        {k}
                      </kbd>
                    ))}
                  </span>
                )}
              </>
            );
            const cls = cn(styles.profileItem, it.active && styles.profileActive, it.danger && styles.profileDanger);
            return it.href ? (
              <Link key={it.label} href={it.href} className={cls}>
                {content}
              </Link>
            ) : (
              <button key={it.label} type="button" className={cls}>
                {content}
              </button>
            );
          })}
        </div>
      ))}
    </>
  );
}
