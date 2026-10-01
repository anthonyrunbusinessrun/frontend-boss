import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import styles from "./ui.module.css";

/**
 * "Add row" footer control. NEEDS CLARIFICATION: the resulting row-creation UI is not designed.
 */
export function AddRowButton({ tone = "red" }: { tone?: "red" | "blue" }) {
  return (
    <button type="button" className={cn(styles.addRow, tone === "blue" && styles.addRowBlue)}>
      <span className={cn(styles.addPlus, tone === "blue" && styles.addPlusBlue)}>
        <Plus size={tone === "blue" ? 16 : 13} strokeWidth={3} />
      </span>
      Add row
    </button>
  );
}
