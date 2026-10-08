"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { useAis, useAisActions } from "./AisProvider";
import { AccountDrawer } from "./drawers/AccountDrawer";
import { BillDrawer } from "./drawers/BillDrawer";
import { InvoiceDrawer } from "./drawers/InvoiceDrawer";
import { JournalDrawer } from "./drawers/JournalDrawer";
import { PartyDrawer } from "./drawers/PartyDrawer";
import { PaymentDrawer } from "./drawers/PaymentDrawer";

export type DrawerKind = "invoice" | "bill" | "payment" | "journal" | "customer" | "vendor" | "account";
export type DrawerMode = "view" | "edit" | "create";

export interface DrawerRequest {
  kind: DrawerKind;
  mode: DrawerMode;
  /** Existing record (view / edit). */
  id?: string;
  /** Starting values for a new record (e.g. a payment for a given invoice, a copy of an invoice). */
  prefill?: Record<string, unknown>;
  /** Re-opened after this drawer closes (record payment → back to the invoice). */
  returnTo?: DrawerRequest;
}

interface DrawersApi {
  open: (req: DrawerRequest) => void;
  close: () => void;
  /** Confirmation + deletion of any AIS record, with toast feedback. */
  requestDelete: (kind: DrawerKind, id: string) => void;
}

const DrawersContext = createContext<DrawersApi | null>(null);

export function useAisDrawers(): DrawersApi {
  const ctx = useContext(DrawersContext);
  if (!ctx) throw new Error("useAisDrawers must be used inside <AisDrawersProvider>");
  return ctx;
}

/** Route → record kind for `?new=1` / `?open=<id>` deep links (sidebar button, dashboard links). */
const ROUTE_KIND: Record<string, DrawerKind> = {
  "/ais/invoices": "invoice",
  "/ais/accounts-receivable": "invoice",
  "/ais/bills": "bill",
  "/ais/accounts-payable": "bill",
  "/ais/payments": "payment",
  "/ais/journal-entries": "journal",
  "/ais/customers": "customer",
  "/ais/vendors": "vendor",
  "/ais/accounts": "account",
};

const LABEL: Record<DrawerKind, string> = { invoice: "invoice", bill: "bill", payment: "payment", journal: "journal entry", customer: "customer", vendor: "vendor", account: "account" };

export function AisDrawersProvider({ children }: { children: ReactNode }) {
  const { data, ready } = useAis();
  const act = useAisActions();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [req, setReq] = useState<DrawerRequest | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ kind: DrawerKind; id: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const open = useCallback((r: DrawerRequest) => setReq(r), []);
  const close = useCallback(() => setReq((r) => r?.returnTo ?? null), []);
  const requestDelete = useCallback((kind: DrawerKind, id: string) => setPendingDelete({ kind, id }), []);

  // ?new=1 and ?open=<id> deep links: open once, then drop the parameter so Back/refresh do not reopen it.
  const handled = useRef<string>("");
  useEffect(() => {
    if (!ready) return;
    const kind = ROUTE_KIND[pathname];
    const wantsNew = params.get("new") === "1";
    const openId = params.get("open");
    if (!kind || (!wantsNew && !openId)) return;
    const signature = `${pathname}?${params.toString()}`;
    if (handled.current === signature) return;
    handled.current = signature;
    setReq(wantsNew ? { kind, mode: "create" } : { kind, mode: "view", id: openId ?? undefined });
    const rest = new URLSearchParams(params.toString());
    rest.delete("new");
    rest.delete("open");
    const qs = rest.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [ready, pathname, params, router]);

  const describe = (kind: DrawerKind, id: string) => {
    switch (kind) {
      case "invoice": return data.invoices.find((x) => x.id === id)?.number;
      case "bill": return data.bills.find((x) => x.id === id)?.number;
      case "payment": return data.payments.find((x) => x.id === id)?.number;
      case "journal": return data.journalEntries.find((x) => x.id === id)?.number;
      case "customer": return data.customers.find((x) => x.id === id)?.name;
      case "vendor": return data.vendors.find((x) => x.id === id)?.name;
      case "account": { const a = data.accounts.find((x) => x.id === id); return a ? `${a.code} ${a.name}` : undefined; }
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { kind, id } = pendingDelete;
    const name = describe(kind, id) ?? LABEL[kind];
    setDeleting(true);
    const r =
      kind === "invoice" ? await act.deleteInvoice(id)
      : kind === "bill" ? await act.deleteBill(id)
      : kind === "payment" ? await act.deletePayment(id)
      : kind === "journal" ? await act.deleteJournalEntry(id)
      : kind === "customer" ? await act.deleteCustomer(id)
      : kind === "vendor" ? await act.deleteVendor(id)
      : await act.deleteAccount(id);
    setDeleting(false);
    setPendingDelete(null);
    if (r.ok) {
      toast.success(`${name} deleted.`);
      setReq((cur) => (cur?.id === id ? null : cur));
    }
  };

  const api = useMemo(() => ({ open, close, requestDelete }), [open, close, requestDelete]);
  const key = req ? `${req.kind}:${req.mode}:${req.id ?? "new"}` : "";

  return (
    <DrawersContext.Provider value={api}>
      {children}
      {req?.kind === "customer" && <PartyDrawer key={key} party="customer" request={req} />}
      {req?.kind === "vendor" && <PartyDrawer key={key} party="vendor" request={req} />}
      {req?.kind === "account" && <AccountDrawer key={key} request={req} />}
      {req?.kind === "journal" && <JournalDrawer key={key} request={req} />}
      {req?.kind === "invoice" && <InvoiceDrawer key={key} request={req} />}
      {req?.kind === "bill" && <BillDrawer key={key} request={req} />}
      {req?.kind === "payment" && <PaymentDrawer key={key} request={req} />}
      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete ? `Delete ${LABEL[pendingDelete.kind]}?` : ""}
        message={pendingDelete ? <><strong>{describe(pendingDelete.kind, pendingDelete.id)}</strong> will be permanently removed. This cannot be undone.</> : null}
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </DrawersContext.Provider>
  );
}
