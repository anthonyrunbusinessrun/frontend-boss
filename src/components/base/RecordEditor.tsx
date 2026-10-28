"use client";

import { Copy, Pencil, Star, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Drawer } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { displayText } from "@/lib/base/compute";
import { isEditableType, primaryField, readAttachments } from "@/lib/base/fields";
import { tableSeed } from "@/lib/base/definitions";
import { hasErrors, validateRecordInput } from "@/lib/base/validate";
import type { RecordRow } from "@/lib/base/types";
import { ClientError } from "./client";
import { CellValue } from "./cells";
import { FieldInput, FieldRow } from "./inputs";
import { messageOf, useTable } from "./TableProvider";
import s from "./base.module.css";
import { Avatar } from "./ui";

export type EditorState = {
  mode: "view" | "edit" | "create";
  recordId?: string;
  /** Initial values for a new record (e.g. { team: true }). */
  preset?: Record<string, unknown>;
  /** Restrict the form to these fields (e.g. the Team Profile form). */
  fieldKeys?: string[];
  title?: string;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function RecordEditor({ state, onChange, onClose, onSaved, renderExtra }: { state: EditorState; onChange: (s: EditorState | null) => void; onClose: () => void; onSaved?: (r: RecordRow) => void; renderExtra?: (r: RecordRow) => React.ReactNode }) {
  const t = useTable();
  const toast = useToast();
  const singular = tableSeed(t.slug)?.singular ?? "record";
  const record = state.recordId ? t.records.find((r) => r.id === state.recordId) : undefined;
  const primary = primaryField(t.fields);

  const editable = useMemo(() => t.fields.filter((f) => isEditableType(f.type) && (!state.fieldKeys || state.fieldKeys.includes(f.key))), [t.fields, state.fieldKeys]);
  const initial = useMemo<Record<string, unknown>>(() => {
    const base: Record<string, unknown> = {};
    for (const f of editable) base[f.key] = record ? record[f.key] : state.preset?.[f.key] ?? (f.type === "checkbox" ? false : f.type === "multiSelect" || f.type === "attachment" ? [] : null);
    return base;
  }, [editable, record, state.preset]);

  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<"delete" | "discard" | null>(null);
  const [busy, setBusy] = useState(false);

  const dirty = editable.some((f) => !same(values[f.key], initial[f.key]));
  const label = record && primary ? displayText(primary, record, t.linked) || record.id : undefined;
  const photoField = t.fields.find((f) => f.key === "photo" && f.type === "attachment");
  const photo = record && photoField ? readAttachments(record[photoField.key])[0]?.url : undefined;

  const requestClose = () => (state.mode !== "view" && dirty ? setConfirm("discard") : onClose());

  const save = async () => {
    // Only what changed is sent, so untouched legacy values can never block a save.
    const patch: Record<string, unknown> = {};
    for (const f of editable) if (state.mode === "create" || !same(values[f.key], initial[f.key])) patch[f.key] = values[f.key];
    const check = validateRecordInput(t.fields, patch, { mode: state.mode === "create" ? "create" : "update", allowedKeys: new Set(editable.map((f) => f.key)) });
    // restricted forms only validate fields they show
    if (hasErrors(check.errors)) {
      setErrors(check.errors);
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      const saved = state.mode === "create" ? await t.createRecord(check.values) : await t.updateRecord(state.recordId!, check.values);
      toast.success(`${cap(singular)} “${primary ? displayText(primary, saved, t.linked) || "saved" : "saved"}” ${state.mode === "create" ? "created" : "updated"}.`);
      onSaved?.(saved);
      onChange({ mode: "view", recordId: saved.id });
    } catch (e) {
      if (e instanceof ClientError && e.fieldErrors) setErrors(e.fieldErrors);
      else toast.error(messageOf(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!record) return;
    setBusy(true);
    try {
      const out = await t.deleteRecords([record.id]);
      toast.success(out.unlinked > 0 ? `${cap(singular)} deleted. Removed from ${out.unlinked} linked record${out.unlinked === 1 ? "" : "s"}.` : `${cap(singular)} deleted.`);
      setConfirm(null);
      onClose();
    } catch (e) {
      toast.error(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  const duplicate = () => {
    if (!record) return;
    const preset: Record<string, unknown> = {};
    for (const f of t.fields) if (isEditableType(f.type) && !f.options.unique) preset[f.key] = record[f.key];
    onChange({ mode: "create", preset, title: `Copy of ${label ?? singular}` });
  };

  const isFav = record ? t.isFavorite("record", record.id) : false;
  const star = record && (
    <button type="button" className={s.iconBtn} aria-pressed={isFav} aria-label={isFav ? "Remove from favorites" : "Add to favorites"} onClick={() => t.toggleFavorite("record", record.id).catch((e) => toast.error(messageOf(e)))}>
      <Star size={16} className={isFav ? s.starOn : undefined} fill={isFav ? "currentColor" : "none"} />
    </button>
  );

  const title = state.mode === "create" ? (state.title ?? `New ${singular}`) : (label ?? cap(singular));
  const viewFields = t.fields;

  return (
    <>
      <Drawer
        open
        onClose={requestClose}
        width={560}
        title={
          <span className={s.drawerTitle}>
            {photoField && record && <Avatar name={label ?? "?"} src={photo} size={36} />}
            {title}
          </span>
        }
        subtitle={state.mode === "view" ? `${t.tableName} record` : state.mode === "edit" ? `Editing ${singular}` : undefined}
        footerStart={state.mode === "view" && record ? <span className={s.drawerTools}>{star}</span> : undefined}
        footer={
          state.mode === "view" ? (
            <>
              <Button variant="secondary" size="md" icon={<Trash2 size={14} />} onClick={() => setConfirm("delete")}>
                Delete
              </Button>
              <Button variant="secondary" size="md" icon={<Copy size={14} />} onClick={duplicate}>
                Duplicate
              </Button>
              <Button size="md" icon={<Pencil size={14} />} onClick={() => onChange({ ...state, mode: "edit" })}>
                Edit
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="md" onClick={requestClose}>
                Cancel
              </Button>
              <Button size="md" onClick={save} disabled={saving || (state.mode === "edit" && !dirty)}>
                {saving ? "Saving…" : state.mode === "create" ? `Create ${singular}` : "Save changes"}
              </Button>
            </>
          )
        }
      >
        {state.mode === "view" && record ? (
          <>
            <dl className={s.detailList}>
              {viewFields.map((f) => (
                <div key={f.key} className={s.detailRow}>
                  <dt>{f.name}</dt>
                  <dd>
                    <CellValue field={f} row={record} linked={t.linked} />
                  </dd>
                </div>
              ))}
            </dl>
            {renderExtra?.(record)}
          </>
        ) : (
          <form
            className={s.formGrid}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            {hasErrors(errors) && (
              <p className={s.formAlert} role="alert">
                Some fields need attention.
              </p>
            )}
            {editable.map((f, i) => {
              const id = `rec-${f.key}`;
              return (
                <FieldRow key={f.key} field={f} id={id} required={f.required} error={errors[f.key]}>
                  <FieldInput field={f} id={id} value={values[f.key]} invalid={!!errors[f.key]} autoFocus={i === 0} linked={t.linked} upload={t.upload} onChange={(v) => { setValues((x) => ({ ...x, [f.key]: v })); if (errors[f.key]) setErrors((x) => { const { [f.key]: _gone, ...rest } = x; return rest; }); }} />
                </FieldRow>
              );
            })}
            <button type="submit" hidden />
          </form>
        )}
      </Drawer>
      <ConfirmDialog
        open={confirm === "delete"}
        destructive
        busy={busy}
        title={`Delete this ${singular}?`}
        message={
          <>
            <strong>{label}</strong> will be permanently deleted. Any field in another table that links to it will be cleared.
          </>
        }
        confirmLabel="Delete"
        onCancel={() => setConfirm(null)}
        onConfirm={remove}
      />
      <ConfirmDialog open={confirm === "discard"} destructive title="Discard your changes?" message="The changes you made to this record have not been saved." confirmLabel="Discard" cancelLabel="Keep editing" onCancel={() => setConfirm(null)} onConfirm={() => { setConfirm(null); onClose(); }} />
    </>
  );
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
