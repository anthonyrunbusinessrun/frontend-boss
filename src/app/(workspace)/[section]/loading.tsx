import shell from "@/components/shell/shell.module.css";

export default function SectionLoading() {
  return (
    <div className={shell.routeLoading} role="status" aria-live="polite">
      <span className={shell.routeLoadingBar} aria-hidden />
      <span className={shell.srOnly}>Loading table…</span>
    </div>
  );
}
