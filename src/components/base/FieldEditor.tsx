"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Modal } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { TABLES } from "@/lib/base/definitions";
import { defaultOptions, FIELD_TYPE_INFO, newId } from "@/lib/base/fields";
import { CHOICE_COLORS, type Choice, type FieldOptions, type FieldType } from "@/lib/base/types";
import { ClientError } from "./client";
import { messageOf, useTable } from "./TableProvider";
import s from "./base.module.css";

export function FieldEditor({ fieldKey, initialType, onClose, onCreated }: { fieldKey?: string; initialType?: FieldType; onClose: () => void; onCreated?: (key: string) => void }) {
  const t = useTable();
  const toast = useToast();
  const existing = fieldKey ? t.fieldMap.get(fieldKey) : undefined;
  const [name, setName] = useState(existing?.name ?? "");
  const [type, setType] = useState<FieldType>(existing?.type ?? initialType ?? "text");
  const [options, setOptions] = useState<FieldOptions>(existing?.options ?? (type === "link" ? { linkTable: t.slug, multiple: false } : defaultOptions(type)));
  const [required, setRequired] = useState(existing?.required ?? false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const choices = options.choices ?? [];
  const setChoices = (c: Choice[]) => setOptions((o) => ({ ...o, choices: c }));
  const patch = (p: Partial<FieldOptions>) => setOptions((o) => ({ ...o, ...p }));
  const locked = existing && (existing.type === "computed" || existing.type === "autonumber");

  const changeType = (next: FieldType) => {
    setType(next);
    setOptions(next === "link" ? { linkTable: t.slug, multiple: next === "link" && initialType === "link" } : defaultOptions(next));
  };

  const submit = async () => {
    if (!name.trim()) return setError("Give the field a name.");
    if (type === "link" && !options.linkTable) return setError("Choose a table to link to.");
    setBusy(true);
    setError(null);
    try {
      if (existing) {
        await t.updateField(existing.key, { name, options, required });
        toast.success(`Field “${name.trim()}” updated.`);
      } else {
        const f = await t.createField({ name, type, options });
        toast.success(`Field “${f.name}” added.`);
        onCreated?.(f.key);
      }
      onClose();
    } catch (e) {
      setError(e instanceof ClientError && e.fieldErrors?.name ? e.fieldErrors.name : messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    setBusy(true);
    try {
      await t.deleteField(existing.key);
      toast.success(`Field “${existing.name}” deleted from every view. Its stored values were kept.`);
      onClose();
    } catch (e) {
      toast.error(messageOf(e));
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  };

  const typeInfo = FIELD_TYPE_INFO.find((x) => x.type === type);

  return (
    <>
      <Modal
        open
        onClose={onClose}
        width={520}
        title={existing ? "Edit field" : "Add field"}
        footerStart={existing && !existing.primary ? <Button variant="secondary" size="md" icon={<Trash2 size={14} />} onClick={() => setConfirmDelete(true)}>Delete field</Button> : undefined}
        footer={
          <>
            <Button variant="secondary" size="md" onClick={onClose}>Cancel</Button>
            <Button size="md" onClick={submit} disabled={busy}>{busy ? "Saving…" : existing ? "Save field" : "Add field"}</Button>
          </>
        }
      >
        <form className={s.stack} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <label className={s.fieldRow}>
            <span className={s.fieldLabel}>Field name</span>
            <input className={s.input} value={name} autoFocus data-autofocus onChange={(e) => setName(e.target.value)} placeholder="e.g. Due date" maxLength={100} />
          </label>
          <label className={s.fieldRow}>
            <span className={s.fieldLabel}>Field type</span>
            {existing ? (
              <input className={s.input} value={typeInfo?.label ?? type} readOnly aria-readonly />
            ) : (
              <select className={s.input} value={type} onChange={(e) => changeType(e.target.value as FieldType)}>
                {FIELD_TYPE_INFO.filter((x) => x.creatable).map((x) => (
                  <option key={x.type} value={x.type}>{x.label}</option>
                ))}
              </select>
            )}
            <span className={s.fieldHint}>{existing ? "The type of an existing field cannot be changed." : typeInfo?.description}</span>
          </label>

          {type === "number" && (
            <div className={s.row2}>
              <label className={s.fieldRow}>
                <span className={s.fieldLabel}>Format</span>
                <select className={s.input} value={options.format ?? "integer"} onChange={(e) => patch({ format: e.target.value as FieldOptions["format"], precision: e.target.value === "integer" ? 0 : e.target.value === "currency" ? 2 : options.precision })}>
                  <option value="integer">Integer</option>
                  <option value="decimal">Decimal</option>
                  <option value="currency">Currency (USD)</option>
                  <option value="percent">Percent</option>
                </select>
              </label>
              <label className={s.fieldRow}>
                <span className={s.fieldLabel}>Minimum</span>
                <input className={s.input} type="number" value={options.min ?? ""} onChange={(e) => patch({ min: e.target.value === "" ? undefined : Number(e.target.value) })} />
              </label>
            </div>
          )}

          {(type === "singleSelect" || type === "multiSelect") && (
            <fieldset className={s.fieldset}>
              <legend className={s.fieldLabel}>Options</legend>
              <ul className={s.choiceList}>
                {choices.map((c, i) => (
                  <li key={c.id} className={s.choiceRow}>
                    <select className={s.colorSelect} aria-label={`Color for ${c.name || "option"}`} value={c.color} onChange={(e) => setChoices(choices.map((x, j) => (j === i ? { ...x, color: e.target.value as Choice["color"] } : x)))}>
                      {CHOICE_COLORS.map((col) => <option key={col}>{col}</option>)}
                    </select>
                    <input className={s.input} aria-label={`Option ${i + 1}`} value={c.name} onChange={(e) => setChoices(choices.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    <button type="button" className={s.iconBtn} aria-label={`Remove ${c.name || "option"}`} onClick={() => setChoices(choices.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
                  </li>
                ))}
              </ul>
              <button type="button" className={s.linkBtn} onClick={() => setChoices([...choices, { id: newId("ch"), name: "", color: CHOICE_COLORS[choices.length % CHOICE_COLORS.length] }])}><Plus size={14} /> Add option</button>
              {type === "multiSelect" && <label className={s.toggleRow}><input type="checkbox" checked={options.allowOther === true} onChange={(e) => patch({ allowOther: e.target.checked })} /><span>Allow people to type new tags</span></label>}
              {existing && <p className={s.fieldHint}>Renaming an option updates every record that uses it.</p>}
            </fieldset>
          )}

          {type === "link" && (
            <>
              <label className={s.fieldRow}>
                <span className={s.fieldLabel}>Link to</span>
                {existing ? (
                  <input className={s.input} value={TABLES.find((x) => x.slug === options.linkTable)?.name ?? options.linkTable ?? ""} readOnly />
                ) : (
                  <select className={s.input} value={options.linkTable ?? ""} onChange={(e) => patch({ linkTable: e.target.value })}>
                    {TABLES.map((x) => <option key={x.slug} value={x.slug}>{x.name}{x.slug === t.slug ? " (this table)" : ""}</option>)}
                  </select>
                )}
              </label>
              {!existing && <label className={s.toggleRow}><input type="checkbox" checked={options.multiple === true} onChange={(e) => patch({ multiple: e.target.checked })} /><span>Allow linking to several records</span></label>}
            </>
          )}

          {type === "attachment" && <label className={s.toggleRow}><input type="checkbox" checked={options.imagesOnly === true} onChange={(e) => patch({ imagesOnly: e.target.checked })} /><span>Images only</span></label>}
          {["text", "email", "phone", "url", "number"].includes(type) && <label className={s.toggleRow}><input type="checkbox" checked={options.unique === true} onChange={(e) => patch({ unique: e.target.checked })} /><span>Values must be unique</span></label>}
          {!locked && <label className={s.toggleRow}><input type="checkbox" checked={required} disabled={!!existing && false} onChange={(e) => setRequired(e.target.checked)} /><span>Required when creating or editing a record</span></label>}
          <label className={s.fieldRow}>
            <span className={s.fieldLabel}>Help text (optional)</span>
            <input className={s.input} value={options.help ?? ""} maxLength={300} onChange={(e) => patch({ help: e.target.value })} />
          </label>
          {error && <p className={s.formAlert} role="alert">{error}</p>}
          <button type="submit" hidden />
        </form>
      </Modal>
      <ConfirmDialog
        open={confirmDelete}
        destructive
        busy={busy}
        title="Delete this field?"
        message={<><strong>{existing?.name}</strong> will be removed from every view and form. Values already stored in records are kept in the database but will no longer be shown.</>}
        confirmLabel="Delete field"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={remove}
      />
    </>
  );
}
