"use client";

import { Ban, Copy, CreditCard, Pencil, Send, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Drawer } from "@/components/ui/Dialog";
import { Banner, DetailList, FormGrid, SelectInput, TextArea, TextInput } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { formatDate, isIsoDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { invoiceBalance, invoiceStatus, invoiceTotal, lineAmount, paidAgainst } from "@/services/ais/ledger";
import { dueDateFor, newId } from "@/services/ais/mutations";
import { validateInvoice } from "@/services/ais/validation";
import { PAYMENT_TERMS, type Invoice, type InvoiceLine, type PaymentTerms } from "@/types/ais";
import styles from "../ais.module.css";
import { StatusBadge } from "../cells";
import { useAis, useAisActions } from "../AisProvider";
import { useAisDrawers, type DrawerMode, type DrawerRequest } from "../AisDrawers";
import { blankLine, fromInvoiceLines, LineItems, toInvoiceLines, type DocLine } from "./LineItems";
import { focusFirstInvalid, useDiscardGuard } from "./shared";

interface Prefill {
  customerId?: string;
  reference?: string;
  notes?: string;
  lines?: InvoiceLine[];
}

export function InvoiceDrawer({ request }: { request: DrawerRequest }) {
  const { data } = useAis();
  const act = useAisActions();
  const toast = useToast();
  const drawers = useAisDrawers();

  const existing = request.id ? data.invoices.find((i) => i.id === request.id) : undefined;
  const missing = request.mode !== "create" && !existing;
  useEffect(() => {
    if (missing) drawers.close();
  }, [missing, drawers]);

  const prefill = (request.prefill ?? {}) as Prefill;
  const [mode, setMode] = useState<DrawerMode>(request.mode === "edit" && existing?.status === "Void" ? "view" : request.mode);
  const [newInvoiceId] = useState(() => newId("inv"));

  const revenueOptions = useMemo(() => {
    const used = new Set(existing?.lines.map((l) => l.accountId));
    return data.accounts.filter((a) => a.type === "Revenue" && (a.active || used.has(a.id))).sort((a, b) => a.code.localeCompare(b.code)).map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }));
  }, [data.accounts, existing]);

  const initial = useMemo(() => {
    const customer = data.customers.find((c) => c.id === (existing?.customerId ?? prefill.customerId));
    const terms = existing?.terms ?? customer?.terms ?? data.settings.defaultCustomerTerms;
    const issueDate = existing?.issueDate ?? data.settings.reportingDate;
    return {
      customerId: existing?.customerId ?? prefill.customerId ?? "",
      issueDate,
      terms,
      dueDate: existing?.dueDate ?? dueDateFor(issueDate, terms),
      reference: existing?.reference ?? prefill.reference ?? "",
      notes: existing?.notes ?? prefill.notes ?? "",
      lines: existing ? fromInvoiceLines(existing.lines) : prefill.lines ? fromInvoiceLines(prefill.lines.map((l) => ({ ...l, id: newId("ln") }))) : [blankLine(revenueOptions[0]?.value ?? "")],
    };
  }, [existing?.id]);

  const [customerId, setCustomerId] = useState(initial.customerId);
  const [issueDate, setIssueDate] = useState(initial.issueDate);
  const [terms, setTerms] = useState<PaymentTerms>(initial.terms);
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [dueTouched, setDueTouched] = useState(Boolean(existing));
  const [reference, setReference] = useState(initial.reference);
  const [notes, setNotes] = useState(initial.notes);
  const [lines, setLines] = useState<DocLine[]>(initial.lines);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);

  const editing = mode !== "view";
  const dirty = editing && JSON.stringify({ customerId, issueDate, terms, dueDate, reference, notes, lines }) !== JSON.stringify(initial);
  const { requestClose, dialog } = useDiscardGuard(dirty, () => drawers.close());

  const customerOptions = useMemo(
    () => data.customers.filter((c) => c.status === "Active" || c.id === existing?.customerId).sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.id, label: `${c.name} (${c.code})` })),
    [data.customers, existing],
  );

  const draft: Invoice = useMemo(
    () => ({ id: existing?.id ?? newInvoiceId, number: existing?.number ?? "", customerId, issueDate, dueDate, terms, status: existing?.status ?? "Draft", reference, notes, lines: toInvoiceLines(lines) }),
    [existing, newInvoiceId, customerId, issueDate, dueDate, terms, reference, notes, lines],
  );
  const errors = useMemo(() => validateInvoice(draft, data), [draft, data]);
  const total = invoiceTotal({ ...draft, lines: draft.lines.filter((l) => l.description.trim() || l.unitPrice) });

  const customer = data.customers.find((c) => c.id === customerId);
  const creditWarning = useMemo(() => {
    if (!customer || customer.creditLimit <= 0) return null;
    const open = data.invoices.filter((i) => i.customerId === customer.id && i.status === "Sent" && i.id !== existing?.id).reduce((s, i) => s + invoiceBalance(data, i), 0);
    const after = open + total;
    return after > customer.creditLimit ? { open, after, limit: customer.creditLimit } : null;
  }, [customer, data, existing, total]);

  if (missing) return null;

  const onCustomer = (id: string) => {
    setCustomerId(id);
    const c = data.customers.find((x) => x.id === id);
    if (c) {
      setTerms(c.terms);
      if (!dueTouched) setDueDate(dueDateFor(issueDate, c.terms));
    }
  };
  const onTerms = (t: PaymentTerms) => {
    setTerms(t);
    if (!dueTouched && isIsoDate(issueDate)) setDueDate(dueDateFor(issueDate, t));
  };
  const onIssue = (d: string) => {
    setIssueDate(d);
    if (!dueTouched && isIsoDate(d)) setDueDate(dueDateFor(d, terms));
  };

  const save = async (send: boolean) => {
    setSubmitted(true);
    if (Object.keys(errors).length) return focusFirstInvalid();
    setSaving(true);
    const status = send ? "Sent" : existing?.status ?? "Draft";
    const r = await act.saveInvoice({ ...draft, status });
    setSaving(false);
    if (!r.ok) return;
    toast.success(send && existing?.status !== "Sent" ? `Invoice ${r.value.number} sent and posted to receivables.` : existing ? `Invoice ${r.value.number} updated.` : `Invoice ${r.value.number} saved as draft.`);
    if (existing) {
      setMode("view");
      setSubmitted(false);
    } else drawers.close();
  };

  const markSent = async () => {
    if (!existing) return;
    setSaving(true);
    const r = await act.setInvoiceStatus(existing.id, "Sent");
    setSaving(false);
    if (r.ok) toast.success(`Invoice ${existing.number} marked as sent and posted to receivables.`);
  };
  const voidIt = async () => {
    if (!existing) return;
    setConfirmVoid(false);
    const r = await act.setInvoiceStatus(existing.id, "Void");
    if (r.ok) toast.success(`Invoice ${existing.number} voided.`);
  };

  const status = existing ? invoiceStatus(data, existing) : "Draft";
  const total0 = existing ? invoiceTotal(existing) : 0;
  const paid = existing ? paidAgainst(data.payments, existing.id) : 0;
  const applied = existing ? data.payments.filter((p) => p.allocations.some((a) => a.documentId === existing.id)) : [];
  const formId = "invoice-form";
  const isSent = existing?.status === "Sent";

  return (
    <>
      <Drawer
        open
        onClose={requestClose}
        width={900}
        title={mode === "create" ? "New invoice" : mode === "edit" ? `Edit invoice ${existing?.number}` : `Invoice ${existing?.number}`}
        subtitle={mode === "view" ? data.customers.find((c) => c.id === existing?.customerId)?.name : "Add the customer, dates and line items."}
        footerStart={
          mode === "view" && existing ? (
            existing.status === "Draft" ? (
              <Button variant="secondary" size="md" icon={<Trash2 size={14} />} onClick={() => drawers.requestDelete("invoice", existing.id)}>Delete</Button>
            ) : existing.status === "Sent" && paid === 0 ? (
              <Button variant="secondary" size="md" icon={<Ban size={14} />} onClick={() => setConfirmVoid(true)}>Void invoice</Button>
            ) : undefined
          ) : undefined
        }
        footer={
          mode === "view" && existing ? (
            <>
              <Button variant="secondary" size="md" icon={<Copy size={14} />} onClick={() => drawers.open({ kind: "invoice", mode: "create", prefill: { customerId: existing.customerId, lines: existing.lines, notes: existing.notes } })}>Duplicate</Button>
              <Button variant="secondary" size="md" onClick={() => drawers.close()}>Close</Button>
              {existing.status !== "Void" && <Button variant="secondary" size="md" icon={<Pencil size={14} />} onClick={() => setMode("edit")}>Edit</Button>}
              {existing.status === "Draft" && <Button size="md" icon={<Send size={14} />} onClick={markSent} disabled={saving}>Mark as sent</Button>}
              {isSent && invoiceBalance(data, existing) > 0 && (
                <Button size="md" icon={<CreditCard size={14} />} onClick={() => drawers.open({ kind: "payment", mode: "create", prefill: { direction: "received", partyId: existing.customerId, documentId: existing.id }, returnTo: { kind: "invoice", mode: "view", id: existing.id } })}>
                  Record payment
                </Button>
              )}
            </>
          ) : (
            <>
              <span className={styles.stickyNote} style={{ marginRight: "auto" }}>Total {formatMoney(total)}</span>
              <Button variant="secondary" size="md" onClick={requestClose}>Cancel</Button>
              {isSent ? (
                <Button type="submit" form={formId} size="md" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
              ) : (
                <>
                  <Button variant="secondary" size="md" onClick={() => save(false)} disabled={saving}>Save draft</Button>
                  <Button type="submit" form={formId} size="md" icon={<Send size={14} />} disabled={saving}>{saving ? "Saving…" : "Save & send"}</Button>
                </>
              )}
            </>
          )
        }
      >
        {mode === "view" && existing ? (
          <>
            <div className={styles.badgeRow}>
              <StatusBadge status={status} />
              <Badge tone="statusOpen">{existing.terms}</Badge>
            </div>
            {status === "Overdue" && <Banner>This invoice was due on {formatDate(existing.dueDate)}. {formatMoney(invoiceBalance(data, existing))} is still outstanding.</Banner>}
            {existing.status === "Draft" && <Banner tone="warn">This is a draft. It does not appear in receivables or the ledger until it is sent.</Banner>}
            <DetailList
              items={[
                { label: "Customer", value: <button type="button" className={styles.linkBtn} onClick={() => drawers.open({ kind: "customer", mode: "view", id: existing.customerId, returnTo: { kind: "invoice", mode: "view", id: existing.id } })}>{data.customers.find((c) => c.id === existing.customerId)?.name ?? "Unknown"}</button> },
                { label: "Reference", value: existing.reference },
                { label: "Issue date", value: formatDate(existing.issueDate) },
                { label: "Due date", value: formatDate(existing.dueDate) },
                { label: "Notes", value: existing.notes, wide: true },
              ]}
            />
            <div className={styles.block}>
              <h3 className={styles.blockTitle}>Line items</h3>
              <div className={styles.tableWrap}>
                <table className={styles.miniTable}>
                  <thead><tr><th>Description</th><th className={styles.num}>Qty</th><th className={styles.num}>Unit price</th><th>Account</th><th className={styles.num}>Amount</th></tr></thead>
                  <tbody>
                    {existing.lines.map((l) => (
                      <tr key={l.id}>
                        <td>{l.description}</td>
                        <td className={styles.num}>{l.quantity}</td>
                        <td className={styles.num}>{formatMoney(l.unitPrice)}</td>
                        <td className={styles.dim}>{data.accounts.find((a) => a.id === l.accountId)?.name}</td>
                        <td className={styles.num}>{formatMoney(lineAmount(l))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.totals}>
                <div className={styles.totalRow}><span>Total</span><span>{formatMoney(total0)}</span></div>
                <div className={styles.totalRow}><span>Paid</span><span>{formatMoney(paid)}</span></div>
                <div className={`${styles.totalRow} ${styles.totalRowStrong}`}><span>Balance due</span><span>{formatMoney(total0 - paid)}</span></div>
              </div>
            </div>
            <div className={styles.block}>
              <h3 className={styles.blockTitle}>Payments</h3>
              {applied.length === 0 ? (
                <p className={styles.stickyNote}>No payments have been recorded against this invoice.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.miniTable}>
                    <thead><tr><th>Payment</th><th>Date</th><th>Method</th><th className={styles.num}>Applied</th></tr></thead>
                    <tbody>
                      {applied.map((p) => (
                        <tr key={p.id}>
                          <td><button type="button" className={styles.linkBtn} onClick={() => drawers.open({ kind: "payment", mode: "view", id: p.id, returnTo: { kind: "invoice", mode: "view", id: existing.id } })}>{p.number}</button></td>
                          <td>{formatDate(p.date)}</td>
                          <td>{p.method}</td>
                          <td className={styles.num}>{formatMoney(p.allocations.filter((a) => a.documentId === existing.id).reduce((s, a) => s + a.amount, 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <form
            id={formId}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void save(!isSent);
            }}
          >
            {submitted && Object.keys(errors).length > 0 && <Banner>{errors.lines ?? "Fix the highlighted fields before saving."}</Banner>}
            {creditWarning && <Banner tone="warn">This invoice takes {customer?.name} to {formatMoney(creditWarning.after)}, above the {formatMoney(creditWarning.limit)} credit limit. You can still save it.</Banner>}
            {isSent && paid > 0 && <Banner tone="info">{formatMoney(paid)} has already been received, so the total cannot go below that amount.</Banner>}
            <FormGrid columns={2}>
              <SelectInput label="Customer" required wide value={customerId} placeholder="Select a customer…" options={customerOptions} onChange={(e) => onCustomer(e.target.value)} error={submitted ? errors.customerId : undefined} data-autofocus="" />
              <TextInput label="Issue date" type="date" required value={issueDate} onChange={(e) => onIssue(e.target.value)} error={submitted ? errors.issueDate : undefined} />
              <SelectInput label="Payment terms" value={terms} options={PAYMENT_TERMS} onChange={(e) => onTerms(e.target.value as PaymentTerms)} />
              <TextInput label="Due date" type="date" required value={dueDate} onChange={(e) => { setDueDate(e.target.value); setDueTouched(true); }} error={submitted ? errors.dueDate : undefined} hint={dueTouched ? undefined : `Calculated from the terms (${terms}).`} />
              <TextInput label="Reference / PO number" value={reference} onChange={(e) => setReference(e.target.value)} />
            </FormGrid>
            <div className={styles.block}>
              <h3 className={styles.blockTitle}>Line items</h3>
              <LineItems kind="invoice" lines={lines} onChange={setLines} accountOptions={revenueOptions} errors={errors} showErrors={submitted} />
              <div className={styles.totals}>
                <div className={`${styles.totalRow} ${styles.totalRowStrong}`}><span>Total</span><span>{formatMoney(total)}</span></div>
              </div>
            </div>
            <div className={styles.block}>
              <TextArea label="Notes to customer" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </form>
        )}
      </Drawer>
      <ConfirmDialog
        open={confirmVoid}
        title="Void this invoice?"
        message={<><strong>{existing?.number}</strong> will be removed from receivables and its ledger entry deleted. A void invoice cannot be edited or reopened.</>}
        confirmLabel="Void invoice"
        destructive
        onCancel={() => setConfirmVoid(false)}
        onConfirm={voidIt}
      />
      {dialog}
    </>
  );
}

