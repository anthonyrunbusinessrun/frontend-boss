import type { Metadata } from "next";
import { JournalPage } from "@/components/ais/pages/JournalPage";

export const metadata: Metadata = { title: "Journal Entries · AIS" };

export default function Page() {
  return <JournalPage />;
}
