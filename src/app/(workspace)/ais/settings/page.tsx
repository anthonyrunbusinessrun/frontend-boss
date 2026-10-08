import type { Metadata } from "next";
import { SettingsPage } from "@/components/ais/pages/SettingsPage";

export const metadata: Metadata = { title: "Settings · AIS" };

export default function Page() {
  return <SettingsPage />;
}
