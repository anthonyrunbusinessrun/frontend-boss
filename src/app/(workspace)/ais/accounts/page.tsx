import type { Metadata } from "next";
import { AccountsPage } from "@/components/ais/pages/AccountsPage";

export const metadata: Metadata = { title: "Chart of Accounts · AIS" };

export default function Page() {
  return <AccountsPage />;
}
