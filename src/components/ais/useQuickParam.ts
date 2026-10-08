"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * State for a quick-filter row that can also be set from the URL (`?status=Draft`, `?filter=overdue`),
 * so dashboard links land on the right list even when the page is already open.
 */
export function useQuickParam(names: string[], valid: string[], fallback: string) {
  const params = useSearchParams();
  const fromUrl = (() => {
    for (const n of names) {
      const raw = params.get(n);
      const hit = raw ? valid.find((v) => v.toLowerCase() === raw.toLowerCase()) : undefined;
      if (hit) return hit;
    }
    return null;
  })();
  const [value, setValue] = useState(fromUrl ?? fallback);
  useEffect(() => {
    if (fromUrl) setValue(fromUrl);
  }, [fromUrl]);
  return [value, setValue] as const;
}
