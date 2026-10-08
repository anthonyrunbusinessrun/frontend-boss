"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { Banner, DetailList, FormGrid, SelectInput, TextArea, TextInput } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/dates";
import { formatMoney, formatPlain, parseMoney } from "@/lib/money";
import { isCashAccount, paymentTotal } from "@/services/ais/ledger";
import { newId } from "@/services/ais/mutations";
import { openDocuments } from "@/services/ais/reports";
import { validatePayment } from "@/services/ais/validation";
import { PAYMENT_METHODS, type Payment, type PaymentMethod } from "@/types/ais";
import styles from "../ais.module.css";
import { useAis, useAisActions } from "../AisProvider";
import { useAisDrawers, type DrawerRequest } from "../AisDrawers";
import { focusFirstInvalid, useDiscardGuard } from "./shared";

interface Prefill {
  direction?: "received" | "made";
  partyId?: string;
  documentId?: string;
}

/** Record a payment received from a customer or made to a vendor, and apply it to open documents. Recorded payments are view / delete only. */
export function PaymentDrawer({ request }: { request: DrawerRequest }) {
  const { data } = useAis();
  const act = useAisActions();
  const toast = useToast();
  const drawers = useAisDrawers();

  const existing = request.id ? data.payments.find((p) => p.id === request.id) : undefined;
  const missing = request.mode !== "create" && !existing;
  useEffect(() => {
    if (missing) drawers.close();
  }, [missing, drawers]);

  const prefill = (request.prefill ?? {}) as Prefill;
  const [newPaymentId] = useState(() => newId("pay"));
  const cashAccounts = useMemo(() => data.accounts.filter((a) => isCashAccount(a) && a.active), [data.accounts]);

  const [direction, setDirection] = useState<"received" | "made">(prefill.direction ?? "received");
  const [partyId, setPartyId] = useState(prefill.partyId ?? "");
  const [date, setDate] = useState(data.settings.reportingDate);
  const [method, setMethod] = useState<PaymentMethod>("Bank transfer");
  const [accountId, setAccountId] = useState(cashAccounts[0]?.id ?? "");
  const [reference, setReference] = useState("");
  const [memo, setMemo] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    if (!prefill.documentId) return {};
    const doc = openDocuments(data, prefill.direction ?? "received", prefill.partyId ?? "").find((d) => d.id === prefill.documentId);
    return doc ? { [doc.id]: formatPlain(doc.balance) } : {};
  });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const creating = request.mode === "create";
  const dirty = creating && (partyId !== (prefill.partyId ?? "") || Object.keys(amounts).length > (prefill.documentId ? 1 : 0) || reference !== "" || memo !== "");
  const { requestClose, dialog } = useDiscardGuard(dirty, () => drawers.close());

  const partyOptions = useMemo(() => {
    const list = direction === "received" ? data.customers : data.vendors;
    return list.filter((p) => p.status === "Active" || p.id === partyId).sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }));
  }, [data.customers, data.vendors, direction, partyId]);

  const docs = useMemo(() => (partyId ? openDocuments(data, direction, partyId) : []), [data, direction, partyId]);

  const draft: Payment = useMemo(
    () => ({
      id: newPaymentId,
      number: "",
      direction,
      partyId,
      date,
      method,
      accountId,
      reference,
      memo,
      allocations: docs.map((d) => ({ documentId: d.id, amount: parseMoney(amounts[d.id] ?? "") ?? 0 })).filter((a) => a.amount !== 0),
    }),
    [newPaymentId, direction, partyId, date, method, accountId, reference, memo, docs, amounts],
  );
  const errors = useMemo(() => validatePayment(draft, data), [draft, data]);
  const total = paymentTotal(draft);

  if (missing) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const bad = docs.some((d) => (amounts[d.id] ?? "").trim() !== "" && parseMoney(amounts[d.id]) === null);
    if (Object.keys(errors).length || bad) return focusFirstInvalid();
    setSaving(true);
    const r = await act.savePayment(draft);
    setSaving(false);
    if (!r.ok) return;
    const party = (direction === "received" ? data.customers : data.vendors).find((p) => p.id === partyId)?.name;
    toast.success(direction === "received" ? `Payment ${r.value.number} of ${formatMoney(total)} received from ${party}.` : `Payment ${r.value.number} of ${formatMoney(total)} made to ${party}.`);
    drawers.close();
  };

  const formId = "payment-form";

  /* ---------------- view of a recorded payment ---------------- */
  if (existing) {
    const received = existing.direction === "received";
    const party = (received ? data.customers : data.vendors).find((p) => p.id === existing.partyId);
    return (
      <>
        <Drawer
          open
          onClose={() => drawers.close()}
          width={540}
          title={`Payment ${existing.number}`}
          subtitle={`${received ? "Received from" : "Paid to"} ${party?.name ?? "unknown"}`}
          footerStart={<Button variant="secondary" size="md" icon={<Trash2 size={14} />} onClick={() => drawers.requestDelete("payment", existing.id)}>Delete payment</Button>}
          footer={<Button size="md" onClick={() => drawers.close()}>Close</Button>}
        >
          <div className={styles.badgeRow}>
            <Badge tone={received ? "statusPaid" : "statusAwaiting"}>{received ? "Received" : "Made"}</Badge>
            <Badge tone="statusOpen">{existing.method}</Badge>
          </div>
          <DetailList
            items={[
              { label: "Amount", value: <strong>{formatMoney(paymentTotal(existing))}</strong> },
              { label: "Date", value: formatDate(existing.date) },
              { label: received ? "Deposited to" : "Paid from", value: data.accounts.find((a) => a.id === existing.accountId)?.name },
              { label: "Reference", value: existing.reference },
              { label: "Memo", value: existing.memo, wide: true },
            ]}
          />
          <div className={styles.block}>
            <h3 className={styles.blockTitle}>Applied to</h3>
            <div className={styles.tableWrap}>
              <table className={styles.miniTable}>
                <thead><tr><th>{received ? "Invoice" : "Bill"}</th><th className={styles.num}>Amount</th></tr></thead>
                <tbody>
                  {existing.allocations.map((a) => {
                    const doc = received ? data.invoices.find((i) => i.id === a.documentId) : data.bills.find((b) => b.id === a.documentId);
                    return (
                      <tr key={a.documentId}>
                        <td>{doc ? <button type="button" className={styles.linkBtn} onClick={() => drawers.open({ kind: received ? "invoice" : "bill", mode: "view", id: doc.id, returnTo: { kind: "payment", mode: "view", id: existing.id } })}>{doc.number}</button> : "Deleted document"}</td>
                        <td className={styles.num}>{formatMoney(a.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className={styles.stickyNote} style={{ marginTop: 16 }}>Recorded payments cannot be edited. To correct one, delete it and record it again.</p>
        </Drawer>
        {dialog}
      </>
    );
  }

  /* ---------------- new payment ---------------- */
  const locked = Boolean(prefill.documentId);
  const dirLabel = direction === "received" ? "customer" : "vendor";
  return (
    <>
      <Drawer
        open
        onClose={requestClose}
        width={660}
        title={direction === "received" ? "Record payment received" : "Record payment made"}
        subtitle={direction === "received" ? "Apply money from a customer to their open invoices." : "Apply a payment to a vendor's approved bills."}
        footer={
          <>
            <span className={styles.stickyNote} style={{ marginRight: "auto" }}>Total applied {formatMoney(total)}</span>
            <Button variant="secondary" size="md" onClick={requestClose}>Cancel</Button>
            <Button type="submit" form={formId} size="md" disabled={saving}>{saving ? "Saving…" : "Record payment"}</Button>
          </>
        }
      >
        <form id={formId} onSubmit={submit} noValidate>
          {submitted && Object.keys(errors).length > 0 && <Banner>{errors.allocations ?? "Fix the highlighted fields before saving."}</Banner>}
          <FormGrid columns={2}>
            <SelectInput label="Payment type" value={direction} disabled={locked} options={[{ value: "received", label: "Received from a customer" }, { value: "made", label: "Made to a vendor" }]} onChange={(e) => { setDirection(e.target.value as "received" | "made"); setPartyId(""); setAmounts({}); }} />
            <SelectInput label={direction === "received" ? "Customer" : "Vendor"} required value={partyId} disabled={locked} placeholder={`Select a ${dirLabel}…`} options={partyOptions} onChange={(e) => { setPartyId(e.target.value); setAmounts({}); }} error={submitted ? errors.partyId : undefined} data-autofocus="" />
            <TextInput label="Payment date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} error={submitted ? errors.date : undefined} />
            <SelectInput label="Method" value={method} options={PAYMENT_METHODS} onChange={(e) => setMethod(e.target.value as PaymentMethod)} />
            <SelectInput label={direction === "received" ? "Deposit to" : "Pay from"} required value={accountId} placeholder="Select account…" options={cashAccounts.map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }))} onChange={(e) => setAccountId(e.target.value)} error={submitted ? errors.accountId : undefined} />
            <TextInput label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Check no., wire ID…" />
          </FormGrid>

          <div className={styles.block}>
            <h3 className={styles.blockTitle}>{direction === "received" ? "Open invoices" : "Approved bills"}</h3>
            {!partyId ? (
              <p className={styles.stickyNote}>Choose a {dirLabel} to see what they owe.</p>
            ) : docs.length === 0 ? (
              <Banner tone="info">There are no open {direction === "received" ? "invoices" : "approved bills"} for this {dirLabel}.</Banner>
            ) : (
              <div className={styles.lines} role="group" aria-label="Documents to apply to">
                <div className={`${styles.lineHead} ${styles.allocCols}`} aria-hidden>
                  <span>{direction === "received" ? "Invoice" : "Bill"}</span><span>Due</span><span style={{ textAlign: "right" }}>Balance</span><span style={{ textAlign: "right" }}>Apply</span><span />
                </div>
                {docs.map((d) => {
                  const text = amounts[d.id] ?? "";
                  const invalid = text.trim() !== "" && parseMoney(text) === null;
                  return (
                    <div key={d.id} className={`${styles.lineRow} ${styles.allocCols}`}>
                      <span style={{ paddingTop: 9 }}>{d.number}</span>
                      <span style={{ paddingTop: 9 }} className={d.dueDate < data.settings.reportingDate ? styles.danger : styles.dim}>{formatDate(d.dueDate)}</span>
                      <span className={styles.lineAmount}>{formatMoney(d.balance)}</span>
                      <TextInput label={`Amount to apply to ${d.number}`} hideLabel inputMode="decimal" align="right" placeholder="0.00" value={text} onChange={(e) => setAmounts((a) => ({ ...a, [d.id]: e.target.value }))} error={invalid ? "Not a valid amount." : submitted ? errors[`alloc.${d.id}`] : undefined} />
                      <button type="button" className={styles.linkBtn} style={{ paddingTop: 9 }} onClick={() => setAmounts((a) => ({ ...a, [d.id]: formatPlain(d.balance) }))}>
                        Pay in full
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className={styles.block}>
            <TextArea label="Memo" rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
        </form>
      </Drawer>
      {dialog}
    </>
  );
}
