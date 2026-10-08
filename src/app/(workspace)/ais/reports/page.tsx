import type { Metadata } from "next";
import { ReportsPage } from "@/components/ais/pages/ReportsPage";

export const metadata: Metadata = { title: "Reports · AIS" };

export default function Page() {
  return <ReportsPage />;
}
