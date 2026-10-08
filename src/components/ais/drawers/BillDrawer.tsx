"use client";

import { Ban, CheckCheck, CreditCard, Pencil, Send, Trash2, Undo2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Drawer } from "@/components/ui/Dialog";
import { Banner, DetailList, FormGrid, SelectInput, TextArea, TextInput } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";
import { formatDate, isIsoDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { billBalance, billStatus, billTotal, paidAgainst } from "@/services/ais/ledger";
import { dueDateFor, newId } from "@/services/ais/mutations";
import { validateBill } from "@/services/ais/validation";
import { PAYMENT_TERMS, type Bill, type BillLine, type BillStatus, type PaymentTerms } from "@/types/ais";
import styles from "../ais.module.css";
import { StatusBadge } from "../cells";
import { useAis, useAisActions } from "../AisProvider";
import { useAisDrawers, type DrawerMode, type DrawerRequest } from "../AisDrawers";
import { blankLine, fromBillLines, LineItems, toBillLines, type DocLine } from "./LineItems";
import { focusFirstInvalid, useDiscardGuard } from "./shared";

interface Prefill {
  vendorId?: string;
  lines?: BillLine[];
}

const EXPENSE_TYPES = ["Expense"] as const;

export function BillDrawer({ request }: { request: DrawerRequest }) {
  const { data } = useAis();
  const act = useAisActions();
  const toast = useToast();
  const drawers = useAisDrawers();

  const existing = request.id ? data.bills.find((b) => b.id === request.id) : undefined;
  const missing = request.mode !== "create" && !existing;
  useEffect(() => {
    if (missing) drawers.close();
  }, [missing, drawers]);

  const prefill = (request.prefill ?? {}) as Prefill;
  const [mode, setMode] = useState<DrawerMode>(request.mode === "edit" && existing?.status === "Void" ? "view" : request.mode);
  const [newBillId] = useState(() => newId("bill"));

  const expenseOptions = useMemo(() => {
    const used = new Set(existing?.lines.map((l) => l.accountId));
    return data.accounts.filter((a) => (EXPENSE_TYPES as readonly string[]).includes(a.type) && (a.active || used.has(a.id))).sort((a, b) => a.code.localeCompare(b.code)).map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }));
  }, [data.accounts, existing]);

  const initial = useMemo(() => {
    const vendor = data.vendors.find((v) => v.id === (existing?.vendorId ?? prefill.vendorId));
    const terms = existing?.terms ?? vendor?.terms ?? data.settings.defaultVendorTerms;
    const billDate = existing?.billDate ?? data.settings.reportingDate;
    return {
      vendorId: existing?.vendorId ?? prefill.vendorId ?? "",
      billDate,
      terms,
      dueDate: existing?.dueDate ?? dueDateFor(billDate, terms),
      reference: existing?.reference ?? "",
      notes: existing?.notes ?? "",
      lines: existing ? fromBillLines(existing.lines) : prefill.lines ? fromBillLines(prefill.lines.map((l) => ({ ...l, id: newId("ln") }))) : [blankLine()],
    };
  }, [existing?.id]);

  const [vendorId, setVendorId] = useState(initial.vendorId);
  const [billDate, setBillDate] = useState(initial.billDate);
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
  const dirty = editing && JSON.stringify({ vendorId, billDate, terms, dueDate, reference, notes, lines }) !== JSON.stringify(initial);
  const { requestClose, dialog } = useDiscardGuard(dirty, () => drawers.close());

  const vendorOptions = useMemo(
    () => data.vendors.filter((v) => v.status === "Active" || v.id === existing?.vendorId).sort((a, b) => a.name.localeCompare(b.name)).map((v) => ({ value: v.id, label: `${v.name} (${v.code})` })),
    [data.vendors, existing],
  );

  const draft: Bill = useMemo(
    () => ({ id: existing?.id ?? newBillId, number: existing?.number ?? "", vendorId, billDate, dueDate, terms, status: existing?.status ?? "Draft", reference, notes, lines: toBillLines(lines) }),
    [existing, newBillId, vendorId, billDate, dueDate, terms, reference, notes, lines],
  );
  const errors = useMemo(() => validateBill(draft, data), [draft, data]);
  const total = billTotal({ ...draft, lines: draft.lines.filter((l) => l.amount || l.description.trim()) });

  if (missing) return null;

  const onVendor = (id: string) => {
    setVendorId(id);
    const v = data.vendors.find((x) => x.id === id);
    if (v) {
      setTerms(v.terms);
      if (!dueTouched) setDueDate(dueDateFor(billDate, v.terms));
    }
  };

  const save = async (status: BillStatus) => {
    setSubmitted(true);
    if (Object.keys(errors).length) return focusFirstInvalid();
    setSaving(true);
    const r = await act.saveBill({ ...draft, status });
    setSaving(false);
    if (!r.ok) return;
    toast.success(existing ? `Bill ${r.value.number} updated.` : status === "Awaiting Approval" ? `Bill ${r.value.number} submitted for approval.` : `Bill ${r.value.number} saved as draft.`);
    if (existing) {
      setMode("view");
      setSubmitted(false);
    } else drawers.close();
  };

  const move = async (to: BillStatus, message: string) => {
    if (!existing) return;
    setSaving(true);
    const r = await act.setBillStatus(existing.id, to);
    setSaving(false);
    if (r.ok) toast.success(message);
  };

  const status = existing ? billStatus(data, existing) : "Draft";
  const total0 = existing ? billTotal(existing) : 0;
  const paid = existing ? paidAgainst(data.payments, existing.id) : 0;
  const applied = existing ? data.payments.filter((p) => p.allocations.some((a) => a.documentId === existing.id)) : [];
  const formId = "bill-form";
  const canEditTotals = existing ? existing.status !== "Void" : true;

  return (
    <>
      <Drawer
        open
        onClose={requestClose}
        width={900}
        title={mode === "create" ? "New bill" : mode === "edit" ? `Edit bill ${existing?.number}` : `Bill ${existing?.number}`}
        subtitle={mode === "view" ? data.vendors.find((v) => v.id === existing?.vendorId)?.name : "Enter what the vendor billed you."}
        footerStart={
          mode === "view" && existing ? (
            existing.status === "Approved" && paid === 0 ? (
              <Button variant="secondary" size="md" icon={<Ban size={14} />} onClick={() => setConfirmVoid(true)}>Void bill</Button>
            ) : existing.status !== "Approved" && existing.status !== "Void" ? (
              <Button variant="secondary" size="md" icon={<Trash2 size={14} />} onClick={() => drawers.requestDelete("bill", existing.id)}>Delete</Button>
            ) : undefined
          ) : undefined
        }
        footer={
          mode === "view" && existing ? (
            <>
              <Button variant="secondary" size="md" onClick={() => drawers.close()}>Close</Button>
              {canEditTotals && <Button variant="secondary" size="md" icon={<Pencil size={14} />} onClick={() => setMode("edit")}>Edit</Button>}
              {existing.status === "Awaiting Approval" && (
                <Button variant="secondary" size="md" icon={<Undo2 size={14} />} onClick={() => move("Draft", `Bill ${existing.number} returned to draft.`)} disabled={saving}>Return to draft</Button>
              )}
              {existing.status === "Draft" && (
                <Button size="md" icon={<Send size={14} />} onClick={() => move("Awaiting Approval", `Bill ${existing.number} submitted for approval.`)} disabled={saving}>Submit for approval</Button>
              )}
              {existing.status === "Awaiting Approval" && (
                <Button size="md" icon={<CheckCheck size={14} />} onClick={() => move("Approved", `Bill ${existing.number} approved and posted to payables.`)} disabled={saving}>Approve</Button>
              )}
              {existing.status === "Approved" && billBalance(data, existing) > 0 && (
                <Button size="md" icon={<CreditCard size={14} />} onClick={() => drawers.open({ kind: "payment", mode: "create", prefill: { direction: "made", partyId: existing.vendorId, documentId: existing.id }, returnTo: { kind: "bill", mode: "view", id: existing.id } })}>
                  Record payment
                </Button>
              )}
            </>
          ) : (
            <>
              <span className={styles.stickyNote} style={{ marginRight: "auto" }}>Total {formatMoney(total)}</span>
              <Button variant="secondary" size="md" onClick={requestClose}>Cancel</Button>
              {existing ? (
                <Button type="submit" form={formId} size="md" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
              ) : (
                <>
                  <Button variant="secondary" size="md" onClick={() => save("Draft")} disabled={saving}>Save draft</Button>
                  <Button type="submit" form={formId} size="md" icon={<Send size={14} />} disabled={saving}>{saving ? "Saving…" : "Submit for approval"}</Button>
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
            {status === "Overdue" && <Banner>This bill was due on {formatDate(existing.dueDate)}. {formatMoney(billBalance(data, existing))} is still unpaid.</Banner>}
            {existing.status === "Awaiting Approval" && <Banner tone="warn">Waiting for approval. It is not in payables or the ledger until it is approved.</Banner>}
            {existing.status === "Draft" && <Banner tone="warn">This is a draft. Submit it for approval to record the liability.</Banner>}
            <DetailList
              items={[
                { label: "Vendor", value: <button type="button" className={styles.linkBtn} onClick={() => drawers.open({ kind: "vendor", mode: "view", id: existing.vendorId, returnTo: { kind: "bill", mode: "view", id: existing.id } })}>{data.vendors.find((v) => v.id === existing.vendorId)?.name ?? "Unknown"}</button> },
                { label: "Vendor invoice no.", value: existing.reference },
                { label: "Bill date", value: formatDate(existing.billDate) },
                { label: "Due date", value: formatDate(existing.dueDate) },
                { label: "Notes", value: existing.notes, wide: true },
              ]}
            />
            <div className={styles.block}>
              <h3 className={styles.blockTitle}>Lines</h3>
              <div className={styles.tableWrap}>
                <table className={styles.miniTable}>
                  <thead><tr><th>Description</th><th>Account</th><th className={styles.num}>Amount</th></tr></thead>
                  <tbody>
                    {existing.lines.map((l) => (
                      <tr key={l.id}>
                        <td>{l.description}</td>
                        <td className={styles.dim}>{data.accounts.find((a) => a.id === l.accountId)?.name}</td>
                        <td className={styles.num}>{formatMoney(l.amount)}</td>
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
                <p className={styles.stickyNote}>No payments have been made against this bill.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.miniTable}>
                    <thead><tr><th>Payment</th><th>Date</th><th>Method</th><th className={styles.num}>Applied</th></tr></thead>
                    <tbody>
                      {applied.map((p) => (
                        <tr key={p.id}>
                          <td><button type="button" className={styles.linkBtn} onClick={() => drawers.open({ kind: "payment", mode: "view", id: p.id, returnTo: { kind: "bill", mode: "view", id: existing.id } })}>{p.number}</button></td>
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
              void save(existing ? existing.status : "Awaiting Approval");
            }}
          >
            {submitted && Object.keys(errors).length > 0 && <Banner>{errors.lines ?? "Fix the highlighted fields before saving."}</Banner>}
            {existing?.status === "Approved" && <Banner tone="info">This bill is approved and posted. Saving changes re-posts it to the ledger{paid > 0 ? `; ${formatMoney(paid)} has already been paid, so the total cannot go below that.` : "."}</Banner>}
            <FormGrid columns={2}>
              <SelectInput label="Vendor" required wide value={vendorId} placeholder="Select a vendor…" options={vendorOptions} onChange={(e) => onVendor(e.target.value)} error={submitted ? errors.vendorId : undefined} data-autofocus="" />
              <TextInput label="Bill date" type="date" required value={billDate} onChange={(e) => { setBillDate(e.target.value); if (!dueTouched && isIsoDate(e.target.value)) setDueDate(dueDateFor(e.target.value, terms)); }} error={submitted ? errors.billDate : undefined} />
              <SelectInput label="Payment terms" value={terms} options={PAYMENT_TERMS} onChange={(e) => { const t = e.target.value as PaymentTerms; setTerms(t); if (!dueTouched && isIsoDate(billDate)) setDueDate(dueDateFor(billDate, t)); }} />
              <TextInput label="Due date" type="date" required value={dueDate} onChange={(e) => { setDueDate(e.target.value); setDueTouched(true); }} error={submitted ? errors.dueDate : undefined} hint={dueTouched ? undefined : `Calculated from the terms (${terms}).`} />
              <TextInput label="Vendor invoice no." value={reference} onChange={(e) => setReference(e.target.value)} />
            </FormGrid>
            <div className={styles.block}>
              <h3 className={styles.blockTitle}>Lines</h3>
              <LineItems kind="bill" lines={lines} onChange={setLines} accountOptions={expenseOptions} errors={errors} showErrors={submitted} />
              <div className={styles.totals}>
                <div className={`${styles.totalRow} ${styles.totalRowStrong}`}><span>Total</span><span>{formatMoney(total)}</span></div>
              </div>
            </div>
            <div className={styles.block}>
              <TextArea label="Internal notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </form>
        )}
      </Drawer>
      <ConfirmDialog
        open={confirmVoid}
        title="Void this bill?"
        message={<><strong>{existing?.number}</strong> will be removed from payables and its ledger entry deleted. A void bill cannot be edited or reopened.</>}
        confirmLabel="Void bill"
        destructive
        onCancel={() => setConfirmVoid(false)}
        onConfirm={() => {
          setConfirmVoid(false);
          void move("Void", `Bill ${existing?.number} voided.`);
        }}
      />
      {dialog}
    </>
  );
}
