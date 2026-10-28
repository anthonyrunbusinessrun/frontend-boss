"use client";

import { ArrowDown, ArrowUp, CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { isUserEditable } from "@/lib/base/fields";
import { hasErrors, validateRecordInput } from "@/lib/base/validate";
import { defaultFormConfig, syncFormConfig } from "@/lib/base/viewDefaults";
import { FORM_CATEGORIES, type FormCategory, type FormConfig, type FormFieldConfig } from "@/lib/base/types";
import { cn } from "@/lib/cn";
import { ClientError } from "../client";
import { FieldInput, FieldRow } from "../inputs";
import { messageOf, useTable } from "../TableProvider";
import { useToast } from "@/components/ui/Toast";
import s from "../base.module.css";

export function FormView() {
  const t = useTable();
  const toast = useToast();
  const form: FormConfig = useMemo(() => syncFormConfig(t.config.form ?? defaultFormConfig(t.fields, t.tableName), t.fields), [t.config.form, t.fields, t.tableName]);
  const canBuild = t.canEditView(t.view);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const setForm = (next: FormConfig) => t.patchConfig({ form: next });
  const setField = (key: string, p: Partial<FormFieldConfig>) => setForm({ ...form, fields: form.fields.map((f) => (f.key === key ? { ...f, ...p } : f)) });
  const swap = (i: number, j: number) => {
    if (j < 0 || j >= form.fields.length) return;
    const list = [...form.fields];
    [list[i], list[j]] = [list[j], list[i]];
    setForm({ ...form, fields: list });
  };

  const visible = form.fields.filter((f) => f.visible && t.fieldMap.has(f.key));

  const submit = async () => {
    const allowed = new Set(visible.map((f) => f.key));
    const required = new Set(visible.filter((f) => f.required).map((f) => f.key));
    const input: Record<string, unknown> = {};
    for (const f of visible) input[f.key] = values[f.key] ?? (t.fieldMap.get(f.key)?.type === "checkbox" ? false : null);
    const check = validateRecordInput(t.fields, input, { mode: "create", allowedKeys: allowed, requiredKeys: required });
    if (hasErrors(check.errors)) return setErrors(check.errors);
    setBusy(true);
    setErrors({});
    try {
      await t.submitForm(t.view.id, input);
      setDone(true);
      setValues({});
    } catch (e) {
      if (e instanceof ClientError && e.fieldErrors) setErrors(e.fieldErrors);
      else toast.error(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn(s.formView, canBuild && s.formViewBuild)}>
      {canBuild && (
        <aside className={s.formBuilder} aria-label="Form settings">
          <h2 className={s.cardTitle}>Form settings</h2>
          <label className={s.fieldRow}>
            <span className={s.fieldLabel}>Category</span>
            <select className={s.input} value={form.category ?? "Work"} onChange={(e) => setForm({ ...form, category: e.target.value as FormCategory })}>
              {FORM_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <span className={s.fieldHint}>What this form is for. It is not the view type.</span>
          </label>
          <label className={s.fieldRow}><span className={s.fieldLabel}>Title</span><input className={s.input} value={form.title} maxLength={200} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label className={s.fieldRow}><span className={s.fieldLabel}>Description</span><textarea className={s.input} rows={2} value={form.description} maxLength={2000} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <div className={s.row2}>
            <label className={s.fieldRow}><span className={s.fieldLabel}>Button label</span><input className={s.input} value={form.submitLabel} maxLength={60} onChange={(e) => setForm({ ...form, submitLabel: e.target.value })} /></label>
          </div>
          <label className={s.fieldRow}><span className={s.fieldLabel}>Message after submitting</span><input className={s.input} value={form.successMessage} maxLength={500} onChange={(e) => setForm({ ...form, successMessage: e.target.value })} /></label>
          <h3 className={s.subTitle}>Fields</h3>
          <p className={s.muted}>Choose what people fill in. Required fields must be completed before the form can be submitted.</p>
          <ul className={s.builderList}>
            {form.fields.map((f, i) => {
              const def = t.fieldMap.get(f.key);
              if (!def || !isUserEditable(def, "create")) return null;
              return (
                <li key={f.key} className={cn(s.builderRow, !f.visible && s.builderOff)}>
                  <label className={s.toggleRow}>
                    <input type="checkbox" checked={f.visible} onChange={(e) => setField(f.key, { visible: e.target.checked })} />
                    <span className={s.builderName}>{def.name}</span>
                  </label>
                  <label className={s.toggleRow} title={f.visible ? undefined : "Show the field to make it required"}>
                    <input type="checkbox" checked={f.required} disabled={!f.visible} onChange={(e) => setField(f.key, { required: e.target.checked })} />
                    <span>Required</span>
                  </label>
                  <span className={s.builderMove}>
                    <button type="button" className={s.iconBtn} aria-label={`Move ${def.name} up`} disabled={i === 0} onClick={() => swap(i, i - 1)}><ArrowUp size={13} /></button>
                    <button type="button" className={s.iconBtn} aria-label={`Move ${def.name} down`} disabled={i === form.fields.length - 1} onClick={() => swap(i, i + 1)}><ArrowDown size={13} /></button>
                  </span>
                </li>
              );
            })}
          </ul>
        </aside>
      )}

      <section className={s.formPreview} aria-label="Form">
        <p className={s.formCat}><span className={cn(s.catTag, form.category === "Vouchers" && s.catTagVouchers)}>{form.category ?? "Work"}</span> form</p>
        {!canBuild && t.unsaved && <p className={s.muted}>This form is locked. You can fill it in, but not change it.</p>}
        <div className={s.formSheet}>
          {done ? (
            <EmptyState icon={<CheckCircle2 size={26} />} title={form.successMessage || "Response saved."} description="A new record was added to the table.">
              <Button size="md" onClick={() => setDone(false)}>Submit another response</Button>
            </EmptyState>
          ) : (
            <form noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
              <h2 className={s.formTitle}>{form.title || t.view.name}</h2>
              {form.description && <p className={s.formDesc}>{form.description}</p>}
              {visible.length === 0 ? (
                <p className={s.muted}>No fields are shown on this form yet. Turn some on in Form settings.</p>
              ) : (
                <div className={s.formGrid}>
                  {hasErrors(errors) && <p className={s.formAlert} role="alert">Some fields need attention.</p>}
                  {visible.map((f) => {
                    const def = t.fieldMap.get(f.key)!;
                    const id = `form-${f.key}`;
                    return (
                      <FieldRow key={f.key} field={def} id={id} label={f.label} help={f.help} required={f.required || def.required} error={errors[f.key]}>
                        <FieldInput field={def} id={id} value={values[f.key] ?? (def.type === "checkbox" ? false : def.type === "multiSelect" || def.type === "attachment" ? [] : null)} invalid={!!errors[f.key]} linked={t.linked} upload={t.upload} onChange={(v) => { setValues((x) => ({ ...x, [f.key]: v })); setErrors((x) => { const { [f.key]: _g, ...r } = x; return r; }); }} />
                      </FieldRow>
                    );
                  })}
                </div>
              )}
              <div className={s.formActions}>
                <Button type="submit" size="md" disabled={busy || visible.length === 0}>{busy ? "Submitting…" : form.submitLabel || "Submit"}</Button>
              </div>
              <p className={s.fieldHint}>Submitting adds a real record to {t.tableName}.</p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
