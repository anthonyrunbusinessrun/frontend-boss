import type { Metadata } from "next";
import { InvoicesPage } from "@/components/ais/pages/InvoicesPage";

export const metadata: Metadata = { title: "Invoices · AIS" };

export default function Page() {
  return <InvoicesPage />;
}
