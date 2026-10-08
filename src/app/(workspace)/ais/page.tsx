import type { Metadata } from "next";
import { DashboardPage } from "@/components/ais/pages/DashboardPage";

export const metadata: Metadata = { title: "Accounting Dashboard · AIS" };

export default function Page() {
  return <DashboardPage />;
}
