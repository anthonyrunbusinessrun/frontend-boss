import type { Metadata } from "next";
import { BillsPage } from "@/components/ais/pages/BillsPage";

export const metadata: Metadata = { title: "Bills · AIS" };

export default function Page() {
  return <BillsPage />;
}
