import { Suspense } from "react";
import { AisDrawersProvider } from "@/components/ais/AisDrawers";
import { AisPageLoading } from "@/components/ais/AisPage";
import { AisProvider } from "@/components/ais/AisProvider";
import { AisSidebar } from "@/components/ais/AisSidebar";
import shell from "@/components/shell/shell.module.css";

/**
 * Accounting Information System frame: the BOSS header and tab bar come from the workspace layout;
 * this adds the AIS sidebar, the books (AisProvider) and the record drawers shared by every AIS screen.
 */
export default function AisLayout({ children }: { children: React.ReactNode }) {
  return (
    <AisProvider>
      {/* Suspense: AIS screens read search params (deep links such as ?status=Draft). */}
      <Suspense fallback={<AisPageLoading title="Loading…" />}>
        <AisDrawersProvider>
          <div className={shell.workspace}>
            <AisSidebar />
            {children}
          </div>
        </AisDrawersProvider>
      </Suspense>
    </AisProvider>
  );
}
