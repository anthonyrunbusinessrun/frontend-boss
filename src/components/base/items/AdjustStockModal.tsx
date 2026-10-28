"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { stockStatus, toNumber } from "@/lib/base/compute";
import { cn } from "@/lib/cn";
import { ClientError } from "../client";
import { Chip } from "../ui";
import { messageOf, useTable } from "../TableProvider";
import s from "../base.module.css";

type Mode = "add" | "remove" | "set";
const STATUS_COLOR = { "In stock": "green", "Low stock": "orange", "Out of stock": "red" } as const;

/** Change an item's quantity without opening the full form. The result can never go below zero. */
export function AdjustStockModal({ onClose, itemId }: { onClose: () => void; itemId?: string }) {
  const t = useTable();
  const toast = useToast();
  const items = useMemo(() => [...t.records].sort((a, b) => String(a.title ?? "").localeCompare(String(b.title ?? ""))), [t.records]);
  const [id, setId] = useState(itemId ?? items[0]?.id ?? "");
  const [mode, setMode] = useState<Mode>("add");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const item = items.find((r) => r.id === id);
  const current = toNumber(item?.qty) ?? 0;
  const n = amount.trim() === "" ? null : Number(amount);
  const valid = n !== null && Number.isInteger(n) && n >= 0 && (mode === "set" || n > 0);
  const next = valid ? (mode === "add" ? current + n! : mode === "remove" ? current - n! : n!) : null;
  const status = next !== null && next >= 0 ? stockStatus(next, item?.reorderLevel) : null;
  const unit = typeof item?.unit === "string" ? item.unit : "";

  const submit = async () => {
    if (!item) return setError("Choose an item.");
    if (!valid) return setError(mode === "set" ? "Enter a whole number, 0 or more." : "Enter a whole number greater than 0.");
    if (next! < 0) return setError(`Not enough stock: only ${current} available.`);
    setBusy(true);
    try {
      await t.updateRecord(item.id, { qty: next });
      toast.success(`${String(item.title)}: quantity is now ${next}.`);
      onClose();
    } catch (e) {
      setError(e instanceof ClientError && e.fieldErrors?.qty ? e.fieldErrors.qty : messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} width={460} title="Adjust stock" subtitle="Add, remove or set the quantity on hand." footer={<><Button variant="secondary" size="md" onClick={onClose}>Cancel</Button><Button size="md" onClick={submit} disabled={busy || !item}>{busy ? "Saving…" : "Update quantity"}</Button></>}>
      {items.length === 0 ? (
        <p className={s.muted}>There are no items yet. Create an item first.</p>
      ) : (
        <form className={s.stack} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <label className={s.fieldRow}>
            <span className={s.fieldLabel}>Item</span>
            <select className={s.input} value={id} onChange={(e) => { setId(e.target.value); setError(null); }} data-autofocus>
              {items.map((r) => <option key={r.id} value={r.id}>{String(r.title ?? r.id)}{r.sku ? ` (${String(r.sku)})` : ""}</option>)}
            </select>
            <span className={s.fieldHint}>On hand now: <strong>{current}{unit ? ` ${unit}` : ""}</strong></span>
          </label>
          <fieldset className={s.fieldset}>
            <legend className={s.fieldLabel}>Change</legend>
            <div className={s.radioRow} role="radiogroup" aria-label="Change">
              {([["add", "Add stock"], ["remove", "Remove stock"], ["set", "Set quantity"]] as const).map(([m, label]) => (
                <label key={m} className={cn(s.radio, mode === m && s.radioOn)}><input type="radio" name="mode" checked={mode === m} onChange={() => { setMode(m); setError(null); }} />{label}</label>
              ))}
            </div>
          </fieldset>
          <label className={s.fieldRow}>
            <span className={s.fieldLabel}>{mode === "set" ? "New quantity" : "Amount"}</span>
            <input className={cn(s.input, error && s.invalid)} type="number" min={0} step={1} inputMode="numeric" value={amount} onChange={(e) => { setAmount(e.target.value); setError(null); }} aria-invalid={!!error} />
            {error && <span className={s.fieldError} role="alert">{error}</span>}
          </label>
          {next !== null && next >= 0 && (
            <p className={s.preview}>New quantity: <strong>{next}</strong> {status && <Chip color={STATUS_COLOR[status]}>{status}</Chip>}</p>
          )}
          <button type="submit" hidden />
        </form>
      )}
    </Modal>
  );
}
