"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import styles from "./feedback.module.css";

type ToastTone = "success" | "error" | "info";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  action?: ToastAction;
}

interface ToastApi {
  success: (message: string, action?: ToastAction) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const noop = () => {};
const ToastContext = createContext<ToastApi>({ success: noop, error: noop, info: noop });

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info } as const;
const LIFETIME_MS: Record<ToastTone, number> = { success: 4500, info: 4500, error: 7000 };

/** App-wide toast notifications. Wrap the authenticated workspace once. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string, action?: ToastAction) => {
      const id = nextId.current++;
      setItems((list) => [...list.slice(-3), { id, tone, message, action }]);
      timers.current.set(id, setTimeout(() => dismiss(id), LIFETIME_MS[tone]));
    },
    [dismiss],
  );

  useEffect(() => {
    const active = timers.current;
    return () => active.forEach((t) => clearTimeout(t));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, action) => push("success", message, action),
      error: (message) => push("error", message),
      info: (message) => push("info", message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.toastRegion} role="region" aria-label="Notifications" aria-live="polite">
        {items.map((t) => {
          const Icon = ICONS[t.tone];
          return (
            <div key={t.id} className={cn(styles.toast, t.tone === "success" && styles.toastSuccess, t.tone === "error" && styles.toastError, t.tone === "info" && styles.toastInfo)} role={t.tone === "error" ? "alert" : "status"}>
              <Icon size={18} className={styles.toastIcon} aria-hidden />
              <div className={styles.toastBody}>
                {t.message}
                {t.action && (
                  <button
                    type="button"
                    className={styles.toastAction}
                    onClick={() => {
                      t.action?.onClick();
                      dismiss(t.id);
                    }}
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button type="button" className={styles.toastClose} aria-label="Dismiss notification" onClick={() => dismiss(t.id)}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
