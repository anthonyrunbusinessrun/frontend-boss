import { TabsBar } from "@/components/shell/TabsBar";
import { TopHeader } from "@/components/shell/TopHeader";
import shell from "@/components/shell/shell.module.css";

/** Authenticated frame: top header + primary tab bar. NEEDS CLARIFICATION: no auth guard exists yet. */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={shell.app}>
      <TopHeader />
      <TabsBar />
      {children}
    </div>
  );
}
