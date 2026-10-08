"use client";

import { Plus, X } from "lucide-react";
import { SelectInput, TextInput, type SelectOption } from "@/components/ui/Form";
import { formatPlain, formatMoney, parseMoney } from "@/lib/money";
import { lineAmount } from "@/services/ais/ledger";
import { newId } from "@/services/ais/mutations";
import type { BillLine, InvoiceLine } from "@/types/ais";
import styles from "../ais.module.css";

/** Editable document line: every number is kept as the text the user typed and converted on save. */
export interface DocLine {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  accountId: string;
}

export const blankLine = (accountId = ""): DocLine => ({ id: newId("ln"), description: "", quantity: "1", unitPrice: "", amount: "", accountId });

export const fromInvoiceLines = (lines: InvoiceLine[]): DocLine[] => lines.map((l) => ({ id: l.id, description: l.description, quantity: String(l.quantity), unitPrice: formatPlain(l.unitPrice), amount: "", accountId: l.accountId }));
export const fromBillLines = (lines: BillLine[]): DocLine[] => lines.map((l) => ({ id: l.id, description: l.description, quantity: "1", unitPrice: "", amount: formatPlain(l.amount), accountId: l.accountId }));

export const toInvoiceLines = (lines: DocLine[]): InvoiceLine[] => lines.map((l) => ({ id: l.id, description: l.description, quantity: Number(l.quantity) || 0, unitPrice: parseMoney(l.unitPrice) ?? 0, accountId: l.accountId }));
export const toBillLines = (lines: DocLine[]): BillLine[] => lines.map((l) => ({ id: l.id, description: l.description, amount: parseMoney(l.amount) ?? 0, accountId: l.accountId }));

const invalidMoney = (t: string) => t.trim() !== "" && parseMoney(t) === null;

interface LineItemsProps {
  kind: "invoice" | "bill";
  lines: DocLine[];
  onChange: (lines: DocLine[]) => void;
  accountOptions: SelectOption[];
  /** Validator output keyed `${lineId}.field`. */
  errors: Record<string, string>;
  showErrors: boolean;
}

export function LineItems({ kind, lines, onChange, accountOptions, errors, showErrors }: LineItemsProps) {
  const set = (id: string, patch: Partial<DocLine>) => onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const err = (id: string, field: string) => (showErrors ? errors[`${id}.${field}`] : undefined);
  const cols = kind === "invoice" ? styles.invoiceCols : styles.billCols;
  const defaultAccount = accountOptions.length === 1 && typeof accountOptions[0] !== "string" ? accountOptions[0].value : "";

  return (
    <div>
      <div className={styles.lines} role="group" aria-label="Line items">
        <div className={`${styles.lineHead} ${cols}`} aria-hidden>
          {kind === "invoice" ? (
            <>
              <span>Description</span><span>Qty</span><span style={{ textAlign: "right" }}>Unit price</span><span>Revenue account</span><span style={{ textAlign: "right" }}>Amount</span><span />
            </>
          ) : (
            <>
              <span>Description</span><span style={{ textAlign: "right" }}>Amount</span><span>Expense account</span><span />
            </>
          )}
        </div>
        {lines.map((l, i) => {
          const remove = (
            <button type="button" className={styles.lineRemove} aria-label={`Remove line ${i + 1}`} disabled={lines.length <= 1} title={lines.length <= 1 ? "Keep at least one line" : "Remove line"} onClick={() => onChange(lines.filter((x) => x.id !== l.id))}>
              <X size={16} />
            </button>
          );
          return kind === "invoice" ? (
            <div key={l.id} className={`${styles.lineRow} ${cols}`}>
              <TextInput label={`Description, line ${i + 1}`} hideLabel value={l.description} placeholder="Item or service" onChange={(e) => set(l.id, { description: e.target.value })} error={err(l.id, "description")} />
              <TextInput label={`Quantity, line ${i + 1}`} hideLabel inputMode="decimal" align="right" value={l.quantity} onChange={(e) => set(l.id, { quantity: e.target.value })} error={err(l.id, "quantity")} />
              <TextInput label={`Unit price, line ${i + 1}`} hideLabel inputMode="decimal" align="right" placeholder="0.00" value={l.unitPrice} onChange={(e) => set(l.id, { unitPrice: e.target.value })} error={invalidMoney(l.unitPrice) ? "Not a valid amount." : err(l.id, "unitPrice")} />
              <SelectInput label={`Revenue account, line ${i + 1}`} hideLabel value={l.accountId || defaultAccount} placeholder="Select…" options={accountOptions} onChange={(e) => set(l.id, { accountId: e.target.value })} error={err(l.id, "accountId")} />
              <span className={styles.lineAmount}>{formatMoney(lineAmount({ quantity: Number(l.quantity) || 0, unitPrice: parseMoney(l.unitPrice) ?? 0 }))}</span>
              {remove}
            </div>
          ) : (
            <div key={l.id} className={`${styles.lineRow} ${cols}`}>
              <TextInput label={`Description, line ${i + 1}`} hideLabel value={l.description} placeholder="What was purchased" onChange={(e) => set(l.id, { description: e.target.value })} error={err(l.id, "description")} />
              <TextInput label={`Amount, line ${i + 1}`} hideLabel inputMode="decimal" align="right" placeholder="0.00" value={l.amount} onChange={(e) => set(l.id, { amount: e.target.value })} error={invalidMoney(l.amount) ? "Not a valid amount." : err(l.id, "amount")} />
              <SelectInput label={`Expense account, line ${i + 1}`} hideLabel value={l.accountId} placeholder="Select…" options={accountOptions} onChange={(e) => set(l.id, { accountId: e.target.value })} error={err(l.id, "accountId")} />
              {remove}
            </div>
          );
        })}
      </div>
      <button type="button" className={styles.addLine} onClick={() => onChange([...lines, blankLine(accountOptions.length === 1 && typeof accountOptions[0] !== "string" ? accountOptions[0].value : lines[lines.length - 1]?.accountId ?? "")])}>
        <Plus size={15} strokeWidth={2.5} aria-hidden /> Add line
      </button>
    </div>
  );
}
