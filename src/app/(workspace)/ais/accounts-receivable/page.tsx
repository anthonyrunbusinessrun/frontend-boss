import type { Metadata } from "next";
import { ReceivablesPage } from "@/components/ais/pages/ReceivablesPage";

export const metadata: Metadata = { title: "Accounts Receivable · AIS" };

export default function Page() {
  return <ReceivablesPage />;
}
