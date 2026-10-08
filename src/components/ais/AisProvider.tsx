"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useToast } from "@/components/ui/Toast";
import { EMPTY_BOOKS, localAisRepository, type AisRepository } from "@/services/ais/repository";
import * as m from "@/services/ais/mutations";
import type { Account, AisData, AisSettings, Bill, BillStatus, Customer, Invoice, InvoiceStatus, JournalEntry, Payment, Result, Vendor } from "@/types/ais";

interface AisContextValue {
  data: AisData;
  /** False until the books have been loaded; pages show their loading state. */
  ready: boolean;
  /** Apply a pure state transition and persist the result. Errors are returned, not thrown. */
  run: <T>(op: (books: AisData) => Result<T>) => Promise<Result<T>>;
  reset: () => Promise<void>;
}

const AisContext = createContext<AisContextValue | null>(null);

export function AisProvider({ children, repository = localAisRepository }: { children: ReactNode; repository?: AisRepository }) {
  const toast = useToast();
  const [data, setData] = useState<AisData>(EMPTY_BOOKS);
  const [ready, setReady] = useState(false);
  const latest = useRef<AisData>(EMPTY_BOOKS);

  useEffect(() => {
    let alive = true;
    repository.load().then((books) => {
      if (!alive) return;
      latest.current = books;
      setData(books);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [repository]);

  const run = useCallback(
    async <T,>(op: (books: AisData) => Result<T>): Promise<Result<T>> => {
      const result = op(latest.current);
      if (!result.ok) return result;
      latest.current = result.data;
      setData(result.data);
      try {
        await repository.save(result.data);
      } catch {
        toast.error("The change was applied but could not be saved in this browser (storage is full or blocked).");
      }
      return result;
    },
    [repository, toast],
  );

  const reset = useCallback(async () => {
    const books = await repository.reset();
    latest.current = books;
    setData(books);
  }, [repository]);

  const value = useMemo(() => ({ data, ready, run, reset }), [data, ready, run, reset]);
  return <AisContext.Provider value={value}>{children}</AisContext.Provider>;
}

export function useAis(): AisContextValue {
  const ctx = useContext(AisContext);
  if (!ctx) throw new Error("useAis must be used inside <AisProvider>");
  return ctx;
}

/**
 * Typed actions over the books. Failures are shown as an error toast (and returned) so
 * callers only add their own success feedback.
 */
export function useAisActions() {
  const { run } = useAis();
  const toast = useToast();
  return useMemo(() => {
    const guard = async <T,>(op: (books: AisData) => Result<T>) => {
      const r = await run(op);
      if (!r.ok) toast.error(r.error);
      return r;
    };
    return {
      saveCustomer: (c: Customer) => guard((d) => m.saveCustomer(d, c)),
      deleteCustomer: (id: string) => guard((d) => m.deleteCustomer(d, id)),
      saveVendor: (v: Vendor) => guard((d) => m.saveVendor(d, v)),
      deleteVendor: (id: string) => guard((d) => m.deleteVendor(d, id)),
      saveAccount: (a: Account) => guard((d) => m.saveAccount(d, a)),
      deleteAccount: (id: string) => guard((d) => m.deleteAccount(d, id)),
      saveJournalEntry: (e: JournalEntry, post: boolean) => guard((d) => m.saveJournalEntry(d, e, post)),
      deleteJournalEntry: (id: string) => guard((d) => m.deleteJournalEntry(d, id)),
      reverseJournalEntry: (id: string, date: string) => guard((d) => m.reverseJournalEntry(d, id, date)),
      saveInvoice: (i: Invoice) => guard((d) => m.saveInvoice(d, i)),
      setInvoiceStatus: (id: string, s: InvoiceStatus) => guard((d) => m.setInvoiceStatus(d, id, s)),
      deleteInvoice: (id: string) => guard((d) => m.deleteInvoice(d, id)),
      saveBill: (b: Bill) => guard((d) => m.saveBill(d, b)),
      setBillStatus: (id: string, s: BillStatus) => guard((d) => m.setBillStatus(d, id, s)),
      deleteBill: (id: string) => guard((d) => m.deleteBill(d, id)),
      savePayment: (p: Payment) => guard((d) => m.savePayment(d, p)),
      deletePayment: (id: string) => guard((d) => m.deletePayment(d, id)),
      saveSettings: (s: AisSettings) => guard((d) => m.saveSettings(d, s)),
    };
  }, [run, toast]);
}
