"use client";

import { Copy, Pencil, Trash2 } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";
import type { FieldDef } from "@/components/popovers/fields";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Drawer } from "@/components/ui/Dialog";
import { Banner, CheckField, DetailList, FormGrid, SelectInput, TextArea, TextInput } from "@/components/ui/Form";
import { editableFields, formatForDisplay, fromFormValues, isDirty, toFormValues, validateForm, type FormValues } from "./recordForm";

export type DrawerMode = "view" | "edit" | "create";

export interface RecordDrawerProps {
  open: boolean;
  mode: DrawerMode;
  /** Singular noun for titles and buttons ("profile"). */
  singular: string;
  /** Human label of the row, used as the view/edit title. */
  rowLabel?: string;
  row: Record<string, unknown> | null;
  fields: FieldDef[];
  groups?: Array<{ id: string; label: string }>;
  groupId?: string;
  onClose: () => void;
  onEdit: () => void;
  onSave: (values: Record<string, unknown>, groupId: string | undefined) => void | Promise<void>;
  onDelete?: () => void;
  onDuplicate?: () => void;
}

/** Generic record drawer: view → edit → save, or create. The form is generated from the view's FieldDef list. */
export function RecordDrawer(props: RecordDrawerProps) {
  return <DrawerBody key={`${props.mode}:${String(props.row?.id ?? "new")}:${props.open}`} {...props} />;
}

function DrawerBody({ open, mode, singular, rowLabel, row, fields, groups, groupId, onClose, onEdit, onSave, onDelete, onDuplicate }: RecordDrawerProps) {
  const formId = useId();
  const editable = editableFields(fields);
  const initial = useRef<FormValues>(toFormValues(row, fields));
  const [values, setValues] = useState<FormValues>(initial.current);
  const [targetGroup, setTargetGroup] = useState(groupId ?? groups?.[0]?.id);
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const editing = mode !== "view";
  const errors = editing ? validateForm(values, fields) : {};
  const visibleError = (key: string) => (submitted || touched.has(key) ? errors[key] : undefined);
  const errorCount = Object.keys(errors).length;
  const dirty = editing && (isDirty(values, initial.current) || (mode === "create" && row !== null));

  const requestClose = () => {
    if (editing && dirty && !saving) setConfirmDiscard(true);
    else onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (errorCount > 0) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setSaving(true);
    try {
      await onSave(fromFormValues(values, fields), targetGroup);
    } finally {
      setSaving(false);
    }
  };

  const title = mode === "create" ? `New ${singular}` : mode === "edit" ? `Edit ${singular}` : (rowLabel ?? `View ${singular}`);
  const subtitle = mode === "view" ? singular.charAt(0).toUpperCase() + singular.slice(1) : (rowLabel ?? "Fill in the details below");

  const set = (key: string, v: string | boolean) => setValues((s) => ({ ...s, [key]: v }));
  const blur = (key: string) => setTouched((t) => new Set(t).add(key));

  const footerStart =
    mode === "view" && (onDelete || onDuplicate) ? (
      <>
        {onDelete && (
          <Button variant="secondary" size="md" icon={<Trash2 size={14} />} onClick={onDelete}>
            Delete
          </Button>
        )}
        {onDuplicate && (
          <Button variant="secondary" size="md" icon={<Copy size={14} />} onClick={onDuplicate}>
            Duplicate
          </Button>
        )}
      </>
    ) : undefined;

  return (
    <>
      <Drawer
        open={open}
        onClose={requestClose}
        title={title}
        subtitle={subtitle}
        width={480}
        footerStart={footerStart}
        footer={
          mode === "view" ? (
            <>
              <Button variant="secondary" size="md" onClick={onClose}>
                Close
              </Button>
              <Button size="md" icon={<Pencil size={14} />} onClick={onEdit}>
                Edit
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="md" onClick={requestClose}>
                Cancel
              </Button>
              <Button type="submit" form={formId} size="md" disabled={saving}>
                {saving ? "Saving…" : mode === "create" ? `Create ${singular}` : "Save changes"}
              </Button>
            </>
          )
        }
      >
        {mode === "view" ? (
          <DetailList
            items={fields
              .filter((f) => f.key !== undefined)
              .map((f) => ({
                label: f.name,
                value: formatForDisplay(row?.[f.key!]),
                wide: f.form?.wide || f.form?.input === "textarea",
              }))}
          />
        ) : (
          <form id={formId} onSubmit={submit} noValidate>
            {submitted && errorCount > 0 && (
              <Banner tone="error">
                {errorCount === 1 ? "1 field needs attention before you can save." : `${errorCount} fields need attention before you can save.`}
              </Banner>
            )}
            <FormGrid columns={2}>
              {mode === "create" && groups && groups.length > 1 && (
                <SelectInput label="Group" value={targetGroup ?? ""} options={groups.map((g) => ({ value: g.id, label: g.label }))} onChange={(e) => setTargetGroup(e.target.value)} wide />
              )}
              {editable.map((f) => {
                const cfg = f.form!;
                const key = f.key!;
                const common = { label: f.name, required: cfg.required, hint: cfg.hint, error: visibleError(key), wide: cfg.wide || cfg.input === "textarea" };
                const v = values[key];
                switch (cfg.input) {
                  case "checkbox":
                    return <CheckField key={key} label={f.name} checked={v === true} onChange={(next) => set(key, next)} hint={cfg.hint} wide={common.wide} />;
                  case "textarea":
                    return <TextArea key={key} {...common} value={String(v ?? "")} placeholder={cfg.placeholder} onChange={(e) => set(key, e.target.value)} onBlur={() => blur(key)} />;
                  case "select":
                    return (
                      <SelectInput
                        key={key}
                        {...common}
                        value={String(v ?? "")}
                        options={cfg.options ?? []}
                        placeholder={cfg.required ? "Select…" : "None"}
                        onChange={(e) => set(key, e.target.value)}
                        onBlur={() => blur(key)}
                      />
                    );
                  default:
                    return (
                      <TextInput
                        key={key}
                        {...common}
                        type={cfg.input === "number" ? "number" : cfg.input === "email" ? "email" : cfg.input === "date" ? "date" : "text"}
                        inputMode={cfg.input === "number" ? "decimal" : undefined}
                        step={cfg.input === "number" ? "any" : undefined}
                        min={cfg.min}
                        value={String(v ?? "")}
                        placeholder={cfg.input === "list" ? "Separate values with commas" : cfg.placeholder}
                        onChange={(e) => set(key, e.target.value)}
                        onBlur={() => blur(key)}
                        data-autofocus={key === editable[0]?.key ? "" : undefined}
                      />
                    );
                }
              })}
            </FormGrid>
          </form>
        )}
      </Drawer>
      <ConfirmDialog
        open={confirmDiscard}
        title="Discard unsaved changes?"
        message="You have changes that have not been saved. If you close this form they will be lost."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        destructive
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      />
    </>
  );
}
