import type { Metadata } from "next";
import { PayablesPage } from "@/components/ais/pages/PayablesPage";

export const metadata: Metadata = { title: "Accounts Payable · AIS" };

export default function Page() {
  return <PayablesPage />;
}
