"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { Banner, DetailList, FormGrid, FormSection, SelectInput, TextArea, TextInput } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/dates";
import { formatMoney, formatPlain, parseMoney } from "@/lib/money";
import { billBalance, billStatus, billTotal, invoiceBalance, invoiceStatus, invoiceTotal, nextNumber } from "@/services/ais/ledger";
import { newId } from "@/services/ais/mutations";
import { validateParty } from "@/services/ais/validation";
import { PAYMENT_TERMS, type Customer, type PaymentTerms, type Vendor } from "@/types/ais";
import styles from "../ais.module.css";
import { StatusBadge, BossRef, PartyStatusBadge } from "../cells";
import { useAis, useAisActions } from "../AisProvider";
import { useAisDrawers, type DrawerMode, type DrawerRequest } from "../AisDrawers";
import { focusFirstInvalid, useDiscardGuard } from "./shared";

interface Form {
  code: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  terms: PaymentTerms;
  status: "Active" | "Inactive";
  profileRef: string;
  notes: string;
  /** Credit limit (customers) in dollars, as typed. */
  creditLimit: string;
  /** Tax ID (vendors). */
  taxId: string;
}

/** View / create / edit a customer or a vendor. The two share one form; the type-specific field differs. */
export function PartyDrawer({ party, request }: { party: "customer" | "vendor"; request: DrawerRequest }) {
  const { data } = useAis();
  const act = useAisActions();
  const toast = useToast();
  const drawers = useAisDrawers();
  const isCustomer = party === "customer";
  const label = isCustomer ? "customer" : "vendor";

  const list = isCustomer ? data.customers : data.vendors;
  const existing = request.id ? list.find((x) => x.id === request.id) : undefined;
  const missing = request.mode !== "create" && !existing;
  useEffect(() => {
    if (missing) drawers.close();
  }, [missing, drawers]);

  const [mode, setMode] = useState<DrawerMode>(request.mode);
  const initial = useMemo<Form>(() => {
    const e = existing as (Customer & Vendor) | undefined;
    return {
      code: e?.code ?? nextNumber(isCustomer ? "C-" : "V-", list.map((x) => x.code)),
      name: e?.name ?? "",
      contact: e?.contact ?? "",
      email: e?.email ?? "",
      phone: e?.phone ?? "",
      address: e?.address ?? "",
      terms: e?.terms ?? (isCustomer ? data.settings.defaultCustomerTerms : data.settings.defaultVendorTerms),
      status: e?.status ?? "Active",
      profileRef: e?.profileRef ?? "",
      notes: e?.notes ?? "",
      creditLimit: e && "creditLimit" in e ? formatPlain(e.creditLimit) : "0.00",
      taxId: e && "taxId" in e ? e.taxId : "",
    };
  }, [existing?.id]);
  const [form, setForm] = useState<Form>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const editing = mode !== "view";
  const dirty = editing && JSON.stringify(form) !== JSON.stringify(initial);
  const { requestClose, dialog } = useDiscardGuard(dirty, () => drawers.close());
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const limit = parseMoney(form.creditLimit);
  const errors: Record<string, string> = {
    ...validateParty({ name: form.name, email: form.email, code: form.code }, list, existing?.id ?? null, isCustomer ? "Customer" : "Vendor"),
    ...(isCustomer && (limit === null || limit < 0) ? { creditLimit: "Enter a valid amount, 0 or more." } : {}),
  };
  const err = (k: string) => (submitted ? errors[k] : undefined);

  // related documents for the view mode
  const related = useMemo(() => {
    if (!existing) return null;
    if (isCustomer) {
      const invoices = data.invoices.filter((i) => i.customerId === existing.id).sort((a, b) => b.issueDate.localeCompare(a.issueDate));
      const open = invoices.filter((i) => i.status === "Sent").reduce((s, i) => s + invoiceBalance(data, i), 0);
      const billed = invoices.filter((i) => i.status === "Sent").reduce((s, i) => s + invoiceTotal(i), 0);
      return { count: invoices.length, open, total: billed, rows: invoices.slice(0, 5).map((i) => ({ id: i.id, number: i.number, date: i.issueDate, amount: invoiceTotal(i), status: invoiceStatus(data, i) })) };
    }
    const bills = data.bills.filter((b) => b.vendorId === existing.id).sort((a, b) => b.billDate.localeCompare(a.billDate));
    const open = bills.filter((b) => b.status === "Approved").reduce((s, b) => s + billBalance(data, b), 0);
    const total = bills.filter((b) => b.status === "Approved").reduce((s, b) => s + billTotal(b), 0);
    return { count: bills.length, open, total, rows: bills.slice(0, 5).map((b) => ({ id: b.id, number: b.number, date: b.billDate, amount: billTotal(b), status: billStatus(data, b) })) };
  }, [data, existing, isCustomer]);

  if (missing) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) return focusFirstInvalid();
    setSaving(true);
    const base = { id: existing?.id ?? newId(isCustomer ? "cus" : "ven"), code: form.code.trim(), name: form.name.trim(), contact: form.contact.trim(), email: form.email.trim(), phone: form.phone.trim(), address: form.address.trim(), terms: form.terms, status: form.status, profileRef: form.profileRef.trim().toUpperCase(), notes: form.notes.trim() };
    const r = isCustomer ? await act.saveCustomer({ ...base, creditLimit: limit ?? 0 }) : await act.saveVendor({ ...base, taxId: form.taxId.trim() });
    setSaving(false);
    if (!r.ok) return;
    toast.success(`${isCustomer ? "Customer" : "Vendor"} “${base.name}” ${existing ? "updated" : "created"}.`);
    if (existing) {
      setMode("view");
      setSubmitted(false);
    } else drawers.close();
  };

  const formId = `party-form-${party}`;

  return (
    <>
      <Drawer
        open
        onClose={requestClose}
        width={520}
        title={mode === "create" ? `New ${label}` : mode === "edit" ? `Edit ${label}` : (existing?.name ?? "")}
        subtitle={mode === "view" ? `${isCustomer ? "Customer" : "Vendor"} · ${existing?.code}` : undefined}
        footerStart={
          mode === "view" && existing ? (
            <Button variant="secondary" size="md" icon={<Trash2 size={14} />} onClick={() => drawers.requestDelete(party, existing.id)}>
              Delete
            </Button>
          ) : undefined
        }
        footer={
          mode === "view" ? (
            <>
              {existing && (
                <Button
                  variant="secondary"
                  size="md"
                  icon={<Plus size={14} />}
                  onClick={() => drawers.open(isCustomer ? { kind: "invoice", mode: "create", prefill: { customerId: existing.id } } : { kind: "bill", mode: "create", prefill: { vendorId: existing.id } })}
                >
                  {isCustomer ? "New invoice" : "New bill"}
                </Button>
              )}
              <Button variant="secondary" size="md" onClick={() => drawers.close()}>
                Close
              </Button>
              <Button size="md" icon={<Pencil size={14} />} onClick={() => setMode("edit")}>
                Edit
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="md" onClick={requestClose}>
                Cancel
              </Button>
              <Button type="submit" form={formId} size="md" disabled={saving}>
                {saving ? "Saving…" : mode === "create" ? `Create ${label}` : "Save changes"}
              </Button>
            </>
          )
        }
      >
        {mode === "view" && existing ? (
          <>
            <div className={styles.badgeRow}>
              <PartyStatusBadge status={existing.status} />
              <Badge tone="statusOpen">{existing.terms}</Badge>
              {existing.profileRef && <BossRef code={existing.profileRef} />}
            </div>
            <DetailList
              items={[
                { label: "Contact", value: existing.contact },
                { label: "Email", value: existing.email ? <a href={`mailto:${existing.email}`} className={styles.link}>{existing.email}</a> : "" },
                { label: "Phone", value: existing.phone },
                { label: isCustomer ? "Credit limit" : "Tax ID", value: isCustomer ? formatMoney((existing as Customer).creditLimit) : (existing as Vendor).taxId },
                { label: "Address", value: existing.address, wide: true },
                { label: "BOSS account owner", value: existing.profileRef, wide: true },
                { label: "Notes", value: existing.notes, wide: true },
              ]}
            />
            {related && (
              <div className={styles.block}>
                <h3 className={styles.blockTitle}>{isCustomer ? "Receivables" : "Payables"}</h3>
                <DetailList
                  items={[
                    { label: isCustomer ? "Open balance" : "Amount owed", value: <span className={related.open > 0 ? styles.warn : undefined}>{formatMoney(related.open)}</span> },
                    { label: isCustomer ? "Invoiced (sent)" : "Billed (approved)", value: formatMoney(related.total) },
                    ...(isCustomer && (existing as Customer).creditLimit > 0 ? [{ label: "Credit used", value: `${Math.round((related.open / (existing as Customer).creditLimit) * 100)}% of limit` }] : []),
                    { label: "Documents", value: String(related.count) },
                  ]}
                />
                {related.rows.length > 0 ? (
                  <div className={styles.tableWrap} style={{ marginTop: 14 }}>
                    <table className={styles.miniTable}>
                      <thead>
                        <tr>
                          <th>{isCustomer ? "Invoice" : "Bill"}</th>
                          <th>Date</th>
                          <th className={styles.num}>Amount</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {related.rows.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <button type="button" className={styles.linkBtn} onClick={() => drawers.open({ kind: isCustomer ? "invoice" : "bill", mode: "view", id: r.id, returnTo: { kind: party, mode: "view", id: existing.id } })}>
                                {r.number}
                              </button>
                            </td>
                            <td>{formatDate(r.date)}</td>
                            <td className={styles.num}>{formatMoney(r.amount)}</td>
                            <td><StatusBadge status={r.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className={styles.stickyNote} style={{ marginTop: 12 }}>
                    No {isCustomer ? "invoices" : "bills"} yet for this {label}.
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <form id={formId} onSubmit={submit} noValidate>
            {submitted && Object.keys(errors).length > 0 && <Banner>{Object.keys(errors).length === 1 ? "1 field needs attention before you can save." : `${Object.keys(errors).length} fields need attention before you can save.`}</Banner>}
            <FormSection title="Details">
              <FormGrid>
                <TextInput label={`${isCustomer ? "Customer" : "Vendor"} name`} required wide value={form.name} onChange={(e) => set("name", e.target.value)} error={err("name")} data-autofocus="" />
                <TextInput label="Code" required value={form.code} onChange={(e) => set("code", e.target.value)} error={err("code")} />
                <SelectInput label="Status" value={form.status} options={["Active", "Inactive"]} onChange={(e) => set("status", e.target.value as "Active" | "Inactive")} hint={form.status === "Inactive" ? "Inactive records cannot be chosen on new documents." : undefined} />
              </FormGrid>
            </FormSection>
            <FormSection title="Contact">
              <FormGrid>
                <TextInput label="Contact person" value={form.contact} onChange={(e) => set("contact", e.target.value)} />
                <TextInput label="Phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                <TextInput label="Email" type="email" wide value={form.email} onChange={(e) => set("email", e.target.value)} error={err("email")} />
                <TextArea label="Address" wide value={form.address} onChange={(e) => set("address", e.target.value)} rows={2} />
              </FormGrid>
            </FormSection>
            <FormSection title="Billing">
              <FormGrid>
                <SelectInput label="Payment terms" value={form.terms} options={PAYMENT_TERMS} onChange={(e) => set("terms", e.target.value as PaymentTerms)} />
                {isCustomer ? (
                  <TextInput label="Credit limit" prefixText="$" inputMode="decimal" align="right" value={form.creditLimit} onChange={(e) => set("creditLimit", e.target.value)} error={err("creditLimit")} hint="Invoices that push the balance past this limit show a warning." />
                ) : (
                  <TextInput label="Tax ID" value={form.taxId} onChange={(e) => set("taxId", e.target.value)} />
                )}
                <TextInput label="BOSS account owner" value={form.profileRef} onChange={(e) => set("profileRef", e.target.value)} placeholder="e.g. EJH" hint="Contact code of the BOSS profile that manages this account." />
              </FormGrid>
            </FormSection>
            <FormSection title="Notes">
              <TextArea label="Internal notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
            </FormSection>
          </form>
        )}
      </Drawer>
      {dialog}
    </>
  );
}
