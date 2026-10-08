"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Banner, FormGrid, SelectInput, TextInput } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";
import { isIsoDate } from "@/lib/dates";
import { clearAllOverlays } from "@/services/localRecords";
import { PAYMENT_TERMS, type AisSettings, type PaymentTerms } from "@/types/ais";
import styles from "../ais.module.css";
import { AisPage, AisPageLoading } from "../AisPage";
import { useAis, useAisActions } from "../AisProvider";
import { focusFirstInvalid } from "../drawers/shared";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((label, i) => ({ value: String(i + 1), label }));

type Form = Omit<AisSettings, "fiscalYear" | "fiscalYearStartMonth"> & { fiscalYear: string; fiscalYearStartMonth: string };
const toForm = (s: AisSettings): Form => ({ ...s, fiscalYear: String(s.fiscalYear), fiscalYearStartMonth: String(s.fiscalYearStartMonth) });

export function SettingsPage() {
  const { data, ready, reset } = useAis();
  const act = useAisActions();
  const toast = useToast();
  const [form, setForm] = useState<Form | null>(null);
  const [saved, setSaved] = useState<Form | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const f = toForm(data.settings);
    setForm((cur) => cur ?? f);
    setSaved(f);
  }, [ready, data.settings]);

  if (!ready || !form || !saved) return <AisPageLoading title="Settings" />;

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const year = Number(form.fiscalYear);
  const errors: Record<string, string> = {};
  if (form.companyName.trim() === "") errors.companyName = "Company name is required.";
  if (!Number.isInteger(year) || year < 2000 || year > 2100) errors.fiscalYear = "Enter a four-digit year between 2000 and 2100.";
  if (!isIsoDate(form.reportingDate)) errors.reportingDate = "Choose a valid reporting date.";
  for (const [k, label] of [["invoicePrefix", "Invoice"], ["billPrefix", "Bill"], ["journalPrefix", "Journal entry"], ["paymentPrefix", "Payment"]] as const) if (form[k].trim() === "") errors[k] = `${label} prefix is required.`;
  const err = (k: string) => (submitted ? errors[k] : undefined);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) return focusFirstInvalid();
    setSaving(true);
    const r = await act.saveSettings({ ...form, fiscalYear: year, fiscalYearStartMonth: Number(form.fiscalYearStartMonth) });
    setSaving(false);
    if (r.ok) {
      toast.success("Settings saved.");
      setSubmitted(false);
    }
  };

  const doReset = async () => {
    setConfirmReset(false);
    await reset();
    clearAllOverlays();
    setForm(null);
    toast.success("Demo data restored. Accounting books and local BOSS edits were reset.");
  };

  return (
    <AisPage title="Settings" subtitle="Company details, fiscal year, numbering and defaults for the accounting module.">
      <form className={styles.settings} onSubmit={save} noValidate>
        {submitted && Object.keys(errors).length > 0 && <Banner>{Object.keys(errors).length === 1 ? "1 setting needs attention before you can save." : `${Object.keys(errors).length} settings need attention before you can save.`}</Banner>}

        <section className={styles.settingsCard}>
          <h2 className={styles.settingsTitle}>Company</h2>
          <p className={styles.settingsDesc}>Shown on reports and in the AIS header.</p>
          <FormGrid>
            <TextInput label="Company name" required wide value={form.companyName} onChange={(e) => set("companyName", e.target.value)} error={err("companyName")} />
            <TextInput label="Base currency" value="USD – US dollar" readOnly hint="All amounts are stored in US dollars." />
          </FormGrid>
        </section>

        <section className={styles.settingsCard}>
          <h2 className={styles.settingsTitle}>Fiscal year and reporting date</h2>
          <p className={styles.settingsDesc}>The reporting date is the “today” of the books: aging, overdue flags and “This month” are measured from it.</p>
          <FormGrid columns={3}>
            <TextInput label="Fiscal year" required inputMode="numeric" value={form.fiscalYear} onChange={(e) => set("fiscalYear", e.target.value)} error={err("fiscalYear")} />
            <SelectInput label="Fiscal year starts in" value={form.fiscalYearStartMonth} options={MONTHS} onChange={(e) => set("fiscalYearStartMonth", e.target.value)} />
            <TextInput label="Reporting date" type="date" required value={form.reportingDate} onChange={(e) => set("reportingDate", e.target.value)} error={err("reportingDate")} />
          </FormGrid>
        </section>

        <section className={styles.settingsCard}>
          <h2 className={styles.settingsTitle}>Defaults</h2>
          <p className={styles.settingsDesc}>Used when a new customer, vendor or document does not specify its own terms.</p>
          <FormGrid>
            <SelectInput label="Customer payment terms" value={form.defaultCustomerTerms} options={PAYMENT_TERMS} onChange={(e) => set("defaultCustomerTerms", e.target.value as PaymentTerms)} />
            <SelectInput label="Vendor payment terms" value={form.defaultVendorTerms} options={PAYMENT_TERMS} onChange={(e) => set("defaultVendorTerms", e.target.value as PaymentTerms)} />
          </FormGrid>
        </section>

        <section className={styles.settingsCard}>
          <h2 className={styles.settingsTitle}>Document numbering</h2>
          <p className={styles.settingsDesc}>The next number is the highest existing number plus one, so changing a prefix starts a new sequence.</p>
          <FormGrid columns={2}>
            <TextInput label="Invoice prefix" required value={form.invoicePrefix} onChange={(e) => set("invoicePrefix", e.target.value)} error={err("invoicePrefix")} />
            <TextInput label="Bill prefix" required value={form.billPrefix} onChange={(e) => set("billPrefix", e.target.value)} error={err("billPrefix")} />
            <TextInput label="Journal entry prefix" required value={form.journalPrefix} onChange={(e) => set("journalPrefix", e.target.value)} error={err("journalPrefix")} />
            <TextInput label="Payment prefix" required value={form.paymentPrefix} onChange={(e) => set("paymentPrefix", e.target.value)} error={err("paymentPrefix")} />
          </FormGrid>
        </section>

        <section className={styles.settingsCard}>
          <h2 className={styles.settingsTitle}>Demo data</h2>
          <p className={styles.settingsDesc}>This prototype keeps its books in this browser. Reset to start again from the original sample data, including edits made on the BOSS tabs.</p>
          <Button variant="secondary" size="md" icon={<RotateCcw size={14} />} onClick={() => setConfirmReset(true)}>
            Reset demo data
          </Button>
        </section>

        <div className={styles.settingsFoot}>
          <span className={styles.stickyNote} style={{ marginRight: "auto" }}>{dirty ? "You have unsaved changes." : "All changes saved."}</span>
          <Button variant="secondary" size="md" disabled={!dirty} onClick={() => { setForm(saved); setSubmitted(false); }}>
            Discard changes
          </Button>
          <Button type="submit" size="md" disabled={!dirty || saving}>{saving ? "Saving…" : "Save settings"}</Button>
        </div>
      </form>
      <ConfirmDialog
        open={confirmReset}
        title="Reset all demo data?"
        message="Every customer, invoice, bill, payment and journal entry you created or changed will be replaced by the original sample books, and local edits on the BOSS tabs will be removed. This cannot be undone."
        confirmLabel="Reset demo data"
        destructive
        onCancel={() => setConfirmReset(false)}
        onConfirm={doReset}
      />
    </AisPage>
  );
}
