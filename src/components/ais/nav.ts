import type { SidebarIconName } from "@/components/shell/Sidebar";

/** Navigation of the accounting module. One entry per implemented screen. */
export interface AisNavItem {
  id: string;
  label: string;
  href: string;
  icon: SidebarIconName;
}
export interface AisNavSection {
  id: string;
  label: string;
  items: AisNavItem[];
}

export const AIS_NAV: AisNavSection[] = [
  { id: "overview", label: "Overview", items: [{ id: "dashboard", label: "Dashboard", href: "/ais", icon: "dashboard" }] },
  {
    id: "accounting",
    label: "Accounting",
    items: [
      { id: "accounts", label: "Chart of Accounts", href: "/ais/accounts", icon: "book" },
      { id: "ledger", label: "General Ledger", href: "/ais/general-ledger", icon: "ledger" },
      { id: "journal", label: "Journal Entries", href: "/ais/journal-entries", icon: "journal" },
    ],
  },
  {
    id: "sales",
    label: "Sales & Receivables",
    items: [
      { id: "customers", label: "Customers", href: "/ais/customers", icon: "users" },
      { id: "invoices", label: "Invoices", href: "/ais/invoices", icon: "invoice" },
      { id: "ar", label: "Accounts Receivable", href: "/ais/accounts-receivable", icon: "receivable" },
      { id: "payments", label: "Payments", href: "/ais/payments", icon: "payments" },
    ],
  },
  {
    id: "purchases",
    label: "Purchases & Payables",
    items: [
      { id: "vendors", label: "Vendors", href: "/ais/vendors", icon: "vendor" },
      { id: "bills", label: "Bills", href: "/ais/bills", icon: "file" },
      { id: "ap", label: "Accounts Payable", href: "/ais/accounts-payable", icon: "payable" },
    ],
  },
  { id: "reports", label: "Reports & Analytics", items: [{ id: "reports", label: "Reports", href: "/ais/reports", icon: "reports" }] },
  { id: "admin", label: "Administration", items: [{ id: "settings", label: "Settings", href: "/ais/settings", icon: "settings" }] },
];
