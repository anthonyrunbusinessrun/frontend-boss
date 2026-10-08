import type { Metadata } from "next";
import { PartiesPage } from "@/components/ais/pages/PartiesPage";

export const metadata: Metadata = { title: "Customers · AIS" };

export default function Page() {
  return <PartiesPage party="customer" />;
}
