import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import styles from "./ui.module.css";

/** "Add row" footer control. Opens the new-record form of the surrounding view. */
export function AddRowButton({ tone = "red", onClick }: { tone?: "red" | "blue"; onClick?: () => void }) {
  return (
    <button type="button" className={cn(styles.addRow, tone === "blue" && styles.addRowBlue)} onClick={onClick}>
      <span className={cn(styles.addPlus, tone === "blue" && styles.addPlusBlue)}>
        <Plus size={tone === "blue" ? 16 : 13} strokeWidth={3} />
      </span>
      Add row
    </button>
  );
}
