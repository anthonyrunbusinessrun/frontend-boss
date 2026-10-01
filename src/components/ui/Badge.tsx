import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { toneStyle, type ToneName } from "@/lib/tones";
import styles from "./ui.module.css";

type Shape = "pill" | "chip" | "tag" | "mini" | "count" | "outline" | "total";

interface BadgeProps {
  tone: ToneName;
  shape?: Shape;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone, shape = "pill", children, className }: BadgeProps) {
  return (
    <span className={cn(styles.badge, styles[shape], className)} style={toneStyle(tone)}>
      {children}
    </span>
  );
}
