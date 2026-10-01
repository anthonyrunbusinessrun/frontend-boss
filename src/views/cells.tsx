import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import type { ToneName } from "@/lib/tones";
import styles from "./views.module.css";

export const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Muted placeholder for empty values: the designs draw an en-dash style "-". */
export function Dash({ className }: { className?: string }) {
  return <span className={className ?? styles.muted}>-</span>;
}

export function orDash(value: ReactNode | null | undefined, className?: string) {
  return value === null || value === undefined || value === "" ? <Dash className={className} /> : value;
}

/** Group header content: label text plus the count badge. */
export function GroupLabel({
  label,
  count,
  tone = "countRed",
  labelColor,
  prefix,
  plural = true,
}: {
  label: string;
  count?: number;
  tone?: ToneName;
  labelColor?: string;
  prefix?: ReactNode;
  /** The Packet screen literally draws "1 items"; others use "1 item". */
  plural?: boolean;
}) {
  return (
    <span className={styles.groupLabel}>
      {prefix}
      <span style={labelColor ? { color: labelColor } : undefined}>{label}</span>
      {count !== undefined && (
        <Badge tone={tone} shape="count">
          {`${count} ${count === 1 && plural ? "item" : "items"}`}
        </Badge>
      )}
    </span>
  );
}
