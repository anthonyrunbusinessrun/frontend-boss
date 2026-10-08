import type { Metadata } from "next";
import { LedgerPage } from "@/components/ais/pages/LedgerPage";

export const metadata: Metadata = { title: "General Ledger · AIS" };

export default function Page() {
  return <LedgerPage />;
}
