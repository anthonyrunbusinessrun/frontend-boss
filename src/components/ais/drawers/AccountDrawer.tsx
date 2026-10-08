"use client";

import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { Banner, CheckField, DetailList, FormGrid, SelectInput, TextArea, TextInput } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";
import { formatMoney } from "@/lib/money";
import { accountBalance, postedLines, SYSTEM_CODES } from "@/services/ais/ledger";
import { newId } from "@/services/ais/mutations";
import { validateAccount } from "@/services/ais/validation";
import type { AccountType } from "@/types/ais";
import styles from "../ais.module.css";
import { useAis, useAisActions } from "../AisProvider";
import { useAisDrawers, type DrawerMode, type DrawerRequest } from "../AisDrawers";
import { focusFirstInvalid, useDiscardGuard } from "./shared";

export const ACCOUNT_TYPES: readonly AccountType[] = ["Asset", "Liability", "Equity", "Revenue", "Expense"];
export const SUBTYPES: Record<AccountType, string[]> = {
  Asset: ["Cash", "Current Asset", "Fixed Asset"],
  Liability: ["Current Liability", "Long-term Liability"],
  Equity: ["Equity"],
  Revenue: ["Operating Revenue", "Other Income"],
  Expense: ["Cost of Sales", "Operating Expense", "Other Expense"],
};
const debitNatural = (t: AccountType) => t === "Asset" || t === "Expense";

export function AccountDrawer({ request }: { request: DrawerRequest }) {
  const { data } = useAis();
  const act = useAisActions();
  const toast = useToast();
  const drawers = useAisDrawers();

  const existing = request.id ? data.accounts.find((a) => a.id === request.id) : undefined;
  const missing = request.mode !== "create" && !existing;
  useEffect(() => {
    if (missing) drawers.close();
  }, [missing, drawers]);

  const [mode, setMode] = useState<DrawerMode>(request.mode);
  const initial = useMemo(
    () => ({
      code: existing?.code ?? "",
      name: existing?.name ?? "",
      type: existing?.type ?? ("Expense" as AccountType),
      subtype: existing?.subtype ?? SUBTYPES.Expense[1],
      description: existing?.description ?? "",
      contra: existing ? existing.normalBalance !== (debitNatural(existing.type) ? "debit" : "credit") : false,
      active: existing?.active ?? true,
    }),
    [existing?.id],
  );
  const [form, setForm] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const editing = mode !== "view";
  const dirty = editing && JSON.stringify(form) !== JSON.stringify(initial);
  const { requestClose, dialog } = useDiscardGuard(dirty, () => drawers.close());
  const system = existing ? Object.values(SYSTEM_CODES).includes(existing.code as never) : false;
  const hasActivity = existing ? data.journalEntries.some((e) => e.lines.some((l) => l.accountId === existing.id)) : false;

  const errors = validateAccount(form, data.accounts, existing?.id ?? null);
  const err = (k: string) => (submitted ? errors[k] : undefined);
  const subtypeOptions = useMemo(() => (SUBTYPES[form.type].includes(form.subtype) ? SUBTYPES[form.type] : [...SUBTYPES[form.type], form.subtype]), [form.type, form.subtype]);

  const stats = useMemo(() => {
    if (!existing) return null;
    const lines = postedLines(data).filter((l) => l.accountId === existing.id);
    return { balance: accountBalance(data, existing.id), count: lines.length };
  }, [data, existing]);

  if (missing) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) return focusFirstInvalid();
    setSaving(true);
    const normalBalance = debitNatural(form.type) !== form.contra ? "debit" : "credit";
    const r = await act.saveAccount({ id: existing?.id ?? newId("acct"), code: form.code.trim(), name: form.name.trim(), type: form.type, subtype: form.subtype, normalBalance, description: form.description.trim(), active: form.active });
    setSaving(false);
    if (!r.ok) return;
    toast.success(`Account ${form.code.trim()} · ${form.name.trim()} ${existing ? "updated" : "created"}.`);
    if (existing) {
      setMode("view");
      setSubmitted(false);
    } else drawers.close();
  };

  const formId = "account-form";
  return (
    <>
      <Drawer
        open
        onClose={requestClose}
        width={560}
        title={mode === "create" ? "New account" : mode === "edit" ? "Edit account" : `${existing?.code} · ${existing?.name}`}
        subtitle={mode === "view" ? "Chart of accounts" : undefined}
        footerStart={
          mode === "view" && existing && !system ? (
            <Button variant="secondary" size="md" icon={<Trash2 size={14} />} onClick={() => drawers.requestDelete("account", existing.id)}>
              Delete
            </Button>
          ) : undefined
        }
        footer={
          mode === "view" ? (
            <>
              <Button variant="secondary" size="md" onClick={() => drawers.close()}>Close</Button>
              <Button size="md" icon={<Pencil size={14} />} onClick={() => setMode("edit")}>Edit</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="md" onClick={requestClose}>Cancel</Button>
              <Button type="submit" form={formId} size="md" disabled={saving}>{saving ? "Saving…" : mode === "create" ? "Create account" : "Save changes"}</Button>
            </>
          )
        }
      >
        {mode === "view" && existing && stats ? (
          <>
            <div className={styles.badgeRow}>
              <Badge tone="acct">{existing.type}</Badge>
              <Badge tone={existing.active ? "statusPaid" : "statusVoid"}>{existing.active ? "Active" : "Inactive"}</Badge>
              {system && <Badge tone="statusAwaiting">System account</Badge>}
            </div>
            <DetailList
              items={[
                { label: "Balance", value: <strong>{formatMoney(stats.balance)}</strong> },
                { label: "Posted lines", value: String(stats.count) },
                { label: "Subtype", value: existing.subtype },
                { label: "Normal balance", value: existing.normalBalance === "debit" ? "Debit" : "Credit" },
                { label: "Description", value: existing.description, wide: true },
              ]}
            />
            <p className={styles.block}>
              <Link href={`/ais/general-ledger?account=${existing.id}`} className={styles.link} onClick={() => drawers.close()}>
                View in General Ledger <ExternalLink size={13} style={{ verticalAlign: "-2px" }} />
              </Link>
            </p>
          </>
        ) : (
          <form id={formId} onSubmit={submit} noValidate>
            {submitted && Object.keys(errors).length > 0 && <Banner>{Object.values(errors)[0]}</Banner>}
            {system && <Banner tone="info">This is a system account used for automatic posting. Its code and type are locked.</Banner>}
            <FormGrid>
              <TextInput label="Account code" required value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} error={err("code")} disabled={system} hint="4–6 digits, e.g. 6450" data-autofocus="" />
              <SelectInput
                label="Type"
                value={form.type}
                options={ACCOUNT_TYPES}
                disabled={system || hasActivity}
                hint={hasActivity ? "Locked: this account already has transactions." : undefined}
                onChange={(e) => {
                  const type = e.target.value as AccountType;
                  setForm((f) => ({ ...f, type, subtype: SUBTYPES[type][0] }));
                }}
              />
              <TextInput label="Account name" required wide value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={err("name")} />
              <SelectInput label="Subtype" value={form.subtype} options={subtypeOptions} onChange={(e) => setForm((f) => ({ ...f, subtype: e.target.value }))} hint={form.subtype === "Cash" ? "Cash accounts can be chosen as the bank account on payments." : undefined} />
              <div />
              <TextArea label="Description" wide rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              <CheckField label="Contra account" checked={form.contra} onChange={(contra) => setForm((f) => ({ ...f, contra }))} hint="The balance runs opposite to the type, e.g. accumulated depreciation." />
              <CheckField label="Active" checked={form.active} onChange={(active) => setForm((f) => ({ ...f, active }))} hint="Inactive accounts cannot be used on new entries." />
            </FormGrid>
          </form>
        )}
      </Drawer>
      {dialog}
    </>
  );
}
