import { SearchProvider } from "@/components/shell/SearchContext";
import { TabsBar } from "@/components/shell/TabsBar";
import { TopHeader } from "@/components/shell/TopHeader";
import shell from "@/components/shell/shell.module.css";
import { ToastProvider } from "@/components/ui/Toast";

/** Authenticated frame: top header + primary tab bar. NEEDS CLARIFICATION: no auth guard exists yet. */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <SearchProvider>
        <div className={shell.app}>
          <TopHeader />
          <TabsBar />
          {children}
        </div>
      </SearchProvider>
    </ToastProvider>
  );
}
