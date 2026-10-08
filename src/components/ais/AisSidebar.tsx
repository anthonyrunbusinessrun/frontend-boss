"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { Sidebar, type SidebarConfig } from "@/components/shell/Sidebar";
import { billStatus, invoiceStatus } from "@/services/ais/ledger";
import { useAis } from "./AisProvider";
import { AIS_NAV } from "./nav";

/** Left sidebar of the accounting module: the BOSS sidebar chrome with routed items and live counts. */
export function AisSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data, ready } = useAis();

  const counts = useMemo(() => {
    if (!ready) return {} as Record<string, number>;
    return {
      ar: data.invoices.filter((i) => invoiceStatus(data, i) === "Overdue").length,
      ap: data.bills.filter((b) => billStatus(data, b) === "Overdue").length,
      bills: data.bills.filter((b) => b.status === "Awaiting Approval").length,
      journal: data.journalEntries.filter((e) => e.status === "Draft").length,
    } as Record<string, number>;
  }, [data, ready]);

  const config = useMemo<SidebarConfig>(
    () => ({
      cta: "New invoice",
      sections: AIS_NAV.map((s) => ({
        id: s.id,
        label: s.label,
        collapsible: true,
        items: s.items.map((i) => ({
          id: i.id,
          label: i.label,
          icon: i.icon,
          href: i.href,
          active: i.href === "/ais" ? pathname === "/ais" : pathname === i.href || pathname.startsWith(`${i.href}/`),
          ...(counts[i.id] ? { count: counts[i.id] } : {}),
        })),
      })),
    }),
    [pathname, counts],
  );

  return <Sidebar config={config} onCta={() => router.push("/ais/invoices?new=1")} />;
}
