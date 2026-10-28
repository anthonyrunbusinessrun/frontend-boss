"use client";

import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { FieldType } from "@/lib/base/types";
import type { missingSetup } from "@/lib/base/viewDefaults";

/** Shown when a view needs a field the table does not have yet, with the one-click fix. */
export function SetupNeeded({ setup, onAddField }: { setup: NonNullable<ReturnType<typeof missingSetup>>; onAddField: (type?: FieldType) => void }) {
  const type: FieldType = setup.fix === "singleSelect" ? "singleSelect" : "date";
  return (
    <EmptyState icon={<Settings2 size={22} />} title={setup.title} description={`${setup.description} Choose one under Customize, or add a new field.`}>
      <Button size="md" onClick={() => onAddField(type)}>
        Add a {type === "date" ? "date" : "single select"} field
      </Button>
    </EmptyState>
  );
}
