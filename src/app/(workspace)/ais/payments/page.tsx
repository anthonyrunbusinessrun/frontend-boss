import type { Metadata } from "next";
import { PaymentsPage } from "@/components/ais/pages/PaymentsPage";

export const metadata: Metadata = { title: "Payments · AIS" };

export default function Page() {
  return <PaymentsPage />;
}
