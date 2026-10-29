import { SearchProvider } from "@/components/shell/SearchContext";
import { TabsBar } from "@/components/shell/TabsBar";
import { TopHeader } from "@/components/shell/TopHeader";
import shell from "@/components/shell/shell.module.css";
import { ToastProvider } from "@/components/ui/Toast";
import { requireUser } from "@/server/auth/server";

export const dynamic = 'force-dynamic';

/** All workspace pages require a verified, explicitly approved administrator. */
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <ToastProvider>
      <SearchProvider>
        <div className={shell.app}>
          <TopHeader email={user.email} />
          <TabsBar />
          {children}
        </div>
      </SearchProvider>
    </ToastProvider>
  );
}
