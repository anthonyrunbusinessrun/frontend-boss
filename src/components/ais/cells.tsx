import { Badge } from "@/components/ui/Badge";
import type { ToneName } from "@/lib/tones";
import { formatMoney } from "@/lib/money";
import type { DocStatus } from "@/types/ais";
import styles from "./ais.module.css";

const STATUS_TONE: Record<DocStatus, ToneName> = {
  Draft: "statusDraft",
  Open: "statusOpen",
  "Partially Paid": "statusPartial",
  Overdue: "statusOverdue",
  Paid: "statusPaid",
  Void: "statusVoid",
  "Awaiting Approval": "statusAwaiting",
  Approved: "statusOpen",
};

export function StatusBadge({ status }: { status: DocStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{status}</Badge>;
}

export function EntryStatusBadge({ status }: { status: "Draft" | "Posted" }) {
  return <Badge tone={status === "Posted" ? "statusPaid" : "statusDraft"}>{status}</Badge>;
}

export function PartyStatusBadge({ status }: { status: "Active" | "Inactive" }) {
  return <Badge tone={status === "Active" ? "statusPaid" : "statusVoid"}>{status}</Badge>;
}

/** Right-aligned money; zero is dimmed, negative values are red. */
export function Money({ cents, dashZero }: { cents: number; dashZero?: boolean }) {
  if (cents === 0 && dashZero) return <span className={styles.muted}>–</span>;
  return <span className={`${styles.money} ${cents === 0 ? styles.moneyMuted : ""} ${cents < 0 ? styles.danger : ""}`}>{formatMoney(cents)}</span>;
}

export function BossRef({ code }: { code: string }) {
  return code ? <span className={styles.bossRef} title="BOSS profile that owns this account">{code}</span> : <span className={styles.muted}>–</span>;
}
