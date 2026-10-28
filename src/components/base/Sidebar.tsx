"use client";

import { ChevronDown, Copy, FolderInput, GripVertical, MoreHorizontal, Pencil, Plus, Search, Star, Trash2, User, Users, Lock, Rows3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Modal } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { buildTree, type DropTarget } from "@/lib/base/layout";
import { displayText } from "@/lib/base/compute";
import { primaryField } from "@/lib/base/fields";
import { tableSeed } from "@/lib/base/definitions";
import { VIEW_TYPE_INFO, viewTypeLabel } from "@/lib/base/viewDefaults";
import { FORM_CATEGORIES, type FormCategory, type ViewAccess, type ViewDef, type ViewType } from "@/lib/base/types";
import { cn } from "@/lib/cn";
import { messageOf, useTable } from "./TableProvider";
import s from "./base.module.css";
import { CreateMenu } from "./CreateMenu";
import { FloatingPanel } from "./ui";
import { ViewIcon } from "./viewIcons";

type Drag = { kind: "view" | "section"; id: string };
type Hint = { key: string; pos: "before" | "after" | "into" } | { key: "root-end"; pos: "into" } | null;

const ACCESS: Array<{ value: ViewAccess; label: string; hint: string; icon: React.ReactNode }> = [
  { value: "collaborative", label: "Collaborative", hint: "Everyone can edit the view configuration.", icon: <Users size={14} /> },
  { value: "personal", label: "Personal", hint: "Only you can see and edit this view.", icon: <User size={14} /> },
  { value: "locked", label: "Locked", hint: "No one can edit the view configuration until you unlock it.", icon: <Lock size={14} /> },
];

const collapsedKey = (slug: string) => `boss:sidebar:collapsed:${slug}`;

export function Sidebar({ onOpenRecord }: { onOpenRecord: (id: string) => void }) {
  const t = useTable();
  const toast = useToast();
  const singular = tableSeed(t.slug)?.singular ?? "record";
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{ kind: "view" | "section"; id: string; el: HTMLElement; sub?: "move" } | null>(null);
  const [modal, setModal] = useState<null | { type: "createView"; viewType: ViewType } | { type: "createSection" } | { type: "rename"; kind: "view" | "section"; id: string } | { type: "delete"; kind: "view" | "section"; id: string }>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hint, setHint] = useState<Hint>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(collapsedKey(t.slug));
      if (raw) setCollapsed(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
  }, [t.slug]);
  const toggleCollapsed = (id: string) =>
    setCollapsed((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      try {
        window.localStorage.setItem(collapsedKey(t.slug), JSON.stringify([...n]));
      } catch {
        /* ignore */
      }
      return n;
    });

  const tree = useMemo(() => buildTree(t.views, t.sections), [t.views, t.sections]);
  const q = query.trim().toLowerCase();
  const match = (v: ViewDef) => !q || v.name.toLowerCase().includes(q);

  const favViews = t.favorites.filter((f) => f.kind === "view").map((f) => t.views.find((v) => v.id === f.refId)).filter((v): v is ViewDef => !!v && match(v));
  const primary = primaryField(t.fields);
  const favRecords = t.favorites
    .filter((f) => f.kind === "record")
    .map((f) => t.records.find((r) => r.id === f.refId))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map((r) => ({ id: r.id, label: primary ? displayText(primary, r, t.linked) || r.id : r.id }))
    .filter((r) => !q || r.label.toLowerCase().includes(q));

  const run = async (p: Promise<unknown>, ok?: string) => {
    try {
      await p;
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error(messageOf(e));
    }
  };

  /* ------------------------------ drag and drop ------------------------------ */

  const onDragOverItem = (e: React.DragEvent, kind: "view" | "section", id: string) => {
    if (!drag) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const f = (e.clientY - rect.top) / rect.height;
    let pos: "before" | "after" | "into" = f < 0.5 ? "before" : "after";
    if (kind === "section" && drag.kind === "view" && f >= 0.28 && f <= 0.72) pos = "into";
    setHint({ key: `${kind}:${id}`, pos });
  };

  const drop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!drag || !hint) return reset();
    let target: DropTarget;
    if (hint.key === "root-end") target = { type: "root-end" };
    else {
      const [kind, id] = hint.key.split(/:(.+)/) as ["view" | "section", string];
      target = hint.pos === "into" ? { type: "into", sectionId: id } : { type: hint.pos, id, kind };
    }
    const item = drag;
    reset();
    void run(t.move(item, target));
  };
  const reset = () => {
    setDrag(null);
    setHint(null);
  };
  const dropClass = (kind: "view" | "section", id: string) => (hint && hint.key === `${kind}:${id}` ? (hint.pos === "before" ? s.dropBefore : hint.pos === "after" ? s.dropAfter : s.dropInto) : undefined);

  /* ---------------------------------- items ---------------------------------- */

  const viewRow = (v: ViewDef, opts: { nested?: boolean; draggable?: boolean } = {}) => {
    const active = v.id === t.view.id;
    const fav = t.isFavorite("view", v.id);
    return (
      <li
        key={`${opts.draggable === false ? "fav-" : ""}${v.id}`}
        className={cn(s.sideItem, active && s.sideItemActive, opts.nested && s.sideNested, drag?.id === v.id && s.dragging, opts.draggable !== false && dropClass("view", v.id))}
        draggable={opts.draggable !== false}
        onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", v.id); setDrag({ kind: "view", id: v.id }); }}
        onDragEnd={reset}
        onDragOver={opts.draggable === false ? undefined : (e) => onDragOverItem(e, "view", v.id)}
        onDrop={opts.draggable === false ? undefined : drop}
      >
        <button type="button" className={s.sideBtn} aria-current={active ? "page" : undefined} onClick={() => t.selectView(v.id)}>
          <ViewIcon type={v.type} />
          <span className={s.sideLabel}>{v.name}</span>
          {v.type === "form" && <span className={cn(s.catTag, (v.config.form?.category ?? "Work") === "Vouchers" && s.catTagVouchers)} title="Form category">{v.config.form?.category ?? "Work"}</span>}
          {v.access === "personal" && <User size={12} className={s.sideBadge} aria-label="Personal view" />}
          {v.access === "locked" && <Lock size={12} className={s.sideBadge} aria-label="Locked view" />}
          {fav && opts.draggable !== false && <Star size={11} className={s.sideStar} fill="currentColor" aria-label="Favorite" />}
        </button>
        {opts.draggable !== false && <GripVertical size={14} className={s.grip} aria-hidden />}
        <button type="button" className={s.sideMore} aria-label={`Options for ${v.name}`} aria-haspopup="menu" onClick={(e) => setMenu({ kind: "view", id: v.id, el: e.currentTarget })}>
          <MoreHorizontal size={15} />
        </button>
      </li>
    );
  };

  const sectionRow = (n: Extract<ReturnType<typeof buildTree>["root"][number], { kind: "section" }>) => {
    const id = n.section.id;
    const views = n.views.filter(match);
    if (q && views.length === 0 && !n.section.name.toLowerCase().includes(q)) return null;
    const isCollapsed = collapsed.has(id) && !q;
    return (
      <li key={id} className={cn(s.sideSection, drag?.id === id && s.dragging)}>
        <div
          className={cn(s.sideSectionHead, dropClass("section", id))}
          draggable
          onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", id); setDrag({ kind: "section", id }); }}
          onDragEnd={reset}
          onDragOver={(e) => onDragOverItem(e, "section", id)}
          onDrop={drop}
        >
          <button type="button" className={s.sideSectionBtn} aria-expanded={!isCollapsed} onClick={() => toggleCollapsed(id)}>
            <ChevronDown size={14} className={cn(s.chev, isCollapsed && s.chevClosed)} aria-hidden />
            <span className={s.sideLabel}>{n.section.name}</span>
            <span className={s.sideCount}>{n.views.length}</span>
          </button>
          <button type="button" className={s.sideMore} aria-label={`Options for section ${n.section.name}`} aria-haspopup="menu" onClick={(e) => setMenu({ kind: "section", id, el: e.currentTarget })}>
            <MoreHorizontal size={15} />
          </button>
        </div>
        {!isCollapsed && (
          <ul className={s.sideList}>
            {views.map((v) => viewRow(v, { nested: true }))}
            {views.length === 0 && <li className={s.sideEmpty}>{q ? "No matching views" : "Drag views here"}</li>}
          </ul>
        )}
      </li>
    );
  };

  /* ---------------------------------- menus ---------------------------------- */

  const menuView = menu?.kind === "view" ? t.views.find((v) => v.id === menu.id) : undefined;
  const menuSection = menu?.kind === "section" ? t.sections.find((x) => x.id === menu.id) : undefined;
  const closeMenu = () => setMenu(null);
  const canEdit = menuView ? t.canEditView(menuView) : true;
  const onlyView = t.views.length <= 1;

  const item = (icon: React.ReactNode, label: string, onClick: () => void, opts: { danger?: boolean; disabled?: boolean; hint?: string } = {}) => (
    <li key={label}>
      <button type="button" role="menuitem" className={cn(s.menuItem, opts.danger && s.menuDanger)} disabled={opts.disabled} title={opts.hint} onClick={() => { closeMenu(); onClick(); }}>
        {icon}
        {label}
      </button>
    </li>
  );

  const deleting = modal?.type === "delete" ? (modal.kind === "view" ? t.views.find((v) => v.id === modal.id) : t.sections.find((x) => x.id === modal.id)) : undefined;
  const renaming = modal?.type === "rename" ? (modal.kind === "view" ? t.views.find((v) => v.id === modal.id) : t.sections.find((x) => x.id === modal.id)) : undefined;

  return (
    <aside className={s.sidebar} aria-label="Views">
      <CreateMenu
        onPick={(kind) => {
          if (kind === "section") setModal({ type: "createSection" });
          else setModal({ type: "createView", viewType: kind });
        }}
      />

      <label className={s.finder}>
        <Search size={15} className={s.finderIcon} aria-hidden />
        <input className={s.finderInput} placeholder="Find a view…" aria-label="Find a view" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>

      <nav className={s.sideNav} aria-label={`${t.tableName} views`}>
        {(favViews.length > 0 || favRecords.length > 0) && (
          <section className={s.favSection} aria-label="My favorites">
            <h3 className={s.sideHeading}><Star size={13} fill="currentColor" aria-hidden /> My favorites</h3>
            <ul className={s.sideList}>
              {favViews.map((v) => viewRow(v, { nested: false, draggable: false }))}
              {favRecords.map((r) => (
                <li key={r.id} className={s.sideItem}>
                  <button type="button" className={s.sideBtn} onClick={() => onOpenRecord(r.id)}>
                    <Star size={14} className={s.starOn} fill="currentColor" aria-hidden />
                    <span className={s.sideLabel}>{r.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <ul className={s.sideList} onDragOver={(e) => { if (drag) { e.preventDefault(); setHint({ key: "root-end", pos: "into" }); } }} onDrop={drop}>
          {tree.root.map((n) => (n.kind === "view" ? (match(n.view) ? viewRow(n.view) : null) : sectionRow(n)))}
        </ul>
        {q && tree.root.every((n) => (n.kind === "view" ? !match(n.view) : n.views.filter(match).length === 0 && !n.section.name.toLowerCase().includes(q))) && <p className={s.sideEmpty}>No views match “{query}”.</p>}
        <div className={cn(s.rootDrop, hint?.key === "root-end" && s.rootDropOn)} onDragOver={(e) => { if (drag) { e.preventDefault(); setHint({ key: "root-end", pos: "into" }); } }} onDrop={drop}>
          {drag && <span>Drop here to move to the sidebar</span>}
        </div>
      </nav>

      <FloatingPanel anchor={menu?.el ?? null} open={!!menu} onClose={closeMenu} width={230}>
        {menuView && (
          <ul className={s.menu} role="menu" aria-label={`Options for ${menuView.name}`}>
            {item(<Star size={14} />, t.isFavorite("view", menuView.id) ? "Remove from ‘My favorites’" : "Add to ‘My favorites’", () => void run(t.toggleFavorite("view", menuView.id)))}
            <li role="separator" className={s.menuSep} />
            {item(<Pencil size={14} />, "Rename view", () => setModal({ type: "rename", kind: "view", id: menuView.id }), { disabled: !canEdit, hint: canEdit ? undefined : "This view is locked or belongs to someone else" })}
            {item(<Copy size={14} />, "Duplicate view", () => void run(t.duplicateView(menuView.id), "View duplicated."))}
            <li role="presentation">
              <button type="button" role="menuitem" className={s.menuItem} aria-haspopup="menu" aria-expanded={menu?.sub === "move"} onClick={() => setMenu((m) => (m ? { ...m, sub: m.sub === "move" ? undefined : "move" } : m))}>
                <FolderInput size={14} /> Move to…
                <ChevronDown size={12} className={cn(s.chev, menu?.sub !== "move" && s.chevClosed)} style={{ marginLeft: "auto" }} />
              </button>
              {menu?.sub === "move" && (
                <ul className={s.subMenu} role="menu" aria-label="Move to">
                  <li>
                    <button type="button" role="menuitem" className={s.menuItem} disabled={!menuView.sectionId} onClick={() => { closeMenu(); void run(t.move({ kind: "view", id: menuView.id }, { type: "root-end" }), "Moved to the sidebar."); }}>
                      <Rows3 size={14} /> Sidebar (no section)
                    </button>
                  </li>
                  {t.sections.map((sec) => (
                    <li key={sec.id}>
                      <button type="button" role="menuitem" className={s.menuItem} disabled={menuView.sectionId === sec.id} onClick={() => { closeMenu(); void run(t.move({ kind: "view", id: menuView.id }, { type: "into", sectionId: sec.id }), `Moved to ${sec.name}.`); }}>
                        <FolderInput size={14} /> {sec.name}
                      </button>
                    </li>
                  ))}
                  {t.sections.length === 0 && <li className={s.sideEmpty}>No sections yet. Create one from “Create new…”.</li>}
                </ul>
              )}
            </li>
            <li role="separator" className={s.menuSep} />
            {t.canEditView(menuView) && menuView.access !== "locked" && ACCESS.filter((a) => a.value !== menuView.access).map((a) => (menuView.access === "personal" || menuView.ownerId === null || menuView.ownerId === t.userId ? item(a.icon, `Make ${a.label.toLowerCase()}`, () => void run(t.setAccess(menuView.id, a.value), `View is now ${a.label.toLowerCase()}.`)) : null))}
            {menuView.access === "locked" && (menuView.ownerId === t.userId || menuView.ownerId === null) && item(<Lock size={14} />, "Unlock view", () => void run(t.setAccess(menuView.id, "collaborative"), "View unlocked."))}
            <li role="separator" className={s.menuSep} />
            {item(<Trash2 size={14} />, "Delete view", () => setModal({ type: "delete", kind: "view", id: menuView.id }), { danger: true, disabled: !canEdit || onlyView, hint: onlyView ? "A table needs at least one view" : !canEdit ? "This view is locked or belongs to someone else" : undefined })}
          </ul>
        )}
        {menuSection && (
          <ul className={s.menu} role="menu" aria-label={`Options for section ${menuSection.name}`}>
            {item(<Pencil size={14} />, "Rename section", () => setModal({ type: "rename", kind: "section", id: menuSection.id }))}
            {item(<Trash2 size={14} />, "Delete section", () => setModal({ type: "delete", kind: "section", id: menuSection.id }), { danger: true })}
          </ul>
        )}
      </FloatingPanel>

      {modal?.type === "createView" && (
        <CreateViewModal
          type={modal.viewType}
          defaultName={`${cap(singular)}’s ${viewTypeLabel(modal.viewType)}`}
          onClose={() => setModal(null)}
          onCreate={async (name, access, category) => {
            const v = await t.createView({ name, type: modal.viewType, access, ...(modal.viewType === "form" ? { category } : {}) });
            toast.success(`${viewTypeLabel(v.type)} view “${v.name}” created.`);
            setModal(null);
          }}
        />
      )}
      {modal?.type === "createSection" && (
        <NameModal title="Create section" label="Section name" initial="" action="Create section" help="Sections group related views in the sidebar. Drag views into a section to organize them." onClose={() => setModal(null)} onSubmit={async (name) => { await t.createSection(name); toast.success(`Section “${name}” created.`); setModal(null); }} />
      )}
      {modal?.type === "rename" && renaming && (
        <NameModal title={modal.kind === "view" ? "Rename view" : "Rename section"} label="Name" initial={renaming.name} action="Save" onClose={() => setModal(null)} onSubmit={async (name) => { await (modal.kind === "view" ? t.renameView(modal.id, name) : t.renameSection(modal.id, name)); setModal(null); }} />
      )}
      <ConfirmDialog
        open={modal?.type === "delete" && !!deleting}
        destructive
        title={modal?.type === "delete" && modal.kind === "section" ? "Delete this section?" : "Delete this view?"}
        message={
          modal?.type === "delete" && modal.kind === "section" ? (
            <><strong>{deleting?.name}</strong> will be removed. Its views move back to the sidebar. No views or records are deleted.</>
          ) : (
            <>The view <strong>{deleting?.name}</strong> will be deleted. Your records are not affected: a view only changes how records are shown.</>
          )
        }
        confirmLabel={modal?.type === "delete" && modal.kind === "section" ? "Delete section" : "Delete view"}
        onCancel={() => setModal(null)}
        onConfirm={() => {
          if (modal?.type !== "delete") return;
          const m = modal;
          setModal(null);
          void run(m.kind === "view" ? t.deleteView(m.id) : t.deleteSection(m.id), m.kind === "view" ? "View deleted." : "Section deleted. Its views were kept.");
        }}
      />
    </aside>
  );
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

function NameModal({ title, label, initial, action, help, onClose, onSubmit }: { title: string; label: string; initial: string; action: string; help?: string; onClose: () => void; onSubmit: (name: string) => Promise<void> }) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!name.trim()) return setError(`${label} is required.`);
    setBusy(true);
    try {
      await onSubmit(name.trim());
    } catch (e) {
      setError(messageOf(e));
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} width={420} title={title} footer={<><Button variant="secondary" size="md" onClick={onClose}>Cancel</Button><Button size="md" onClick={submit} disabled={busy}>{busy ? "Saving…" : action}</Button></>}>
      <form className={s.stack} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <label className={s.fieldRow}>
          <span className={s.fieldLabel}>{label}</span>
          <input className={cn(s.input, error && s.invalid)} value={name} autoFocus data-autofocus maxLength={100} onFocus={(e) => e.currentTarget.select()} onChange={(e) => { setName(e.target.value); setError(null); }} aria-invalid={!!error} />
          {error ? <span className={s.fieldError} role="alert">{error}</span> : help && <span className={s.fieldHint}>{help}</span>}
        </label>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function CreateViewModal({ type, defaultName, onClose, onCreate }: { type: ViewType; defaultName: string; onClose: () => void; onCreate: (name: string, access: ViewAccess, category: FormCategory) => Promise<void> }) {
  const [name, setName] = useState(defaultName);
  const [category, setCategory] = useState<FormCategory>("Work");
  const [access, setAccess] = useState<ViewAccess>("collaborative");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const info = VIEW_TYPE_INFO.find((v) => v.type === type);
  const submit = async () => {
    if (!name.trim()) return setError("Give the view a name.");
    setBusy(true);
    try {
      await onCreate(name.trim(), access, category);
    } catch (e) {
      setError(messageOf(e));
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} width={440} title={`Create ${viewTypeLabel(type).toLowerCase()} view`} subtitle={info?.description} footer={<><Button variant="secondary" size="md" onClick={onClose}>Cancel</Button><Button size="md" onClick={submit} disabled={busy}>{busy ? "Creating…" : "Create new view"}</Button></>}>
      <form className={s.stack} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <label className={s.fieldRow}>
          <span className={s.fieldLabel}>View name</span>
          <input className={cn(s.input, error && s.invalid)} value={name} autoFocus data-autofocus maxLength={100} onFocus={(e) => e.currentTarget.select()} onChange={(e) => { setName(e.target.value); setError(null); }} aria-invalid={!!error} />
          {error && <span className={s.fieldError} role="alert">{error}</span>}
        </label>
        {type === "form" && (
          <label className={s.fieldRow}>
            <span className={s.fieldLabel}>Form category</span>
            <span className={s.selectWrap}>
              <select className={s.input} value={category} onChange={(e) => setCategory(e.target.value as FormCategory)}>
                {FORM_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown size={14} aria-hidden />
            </span>
            <span className={s.fieldHint}>What the form is for. You can change it later in the form settings.</span>
          </label>
        )}
        <fieldset className={s.fieldset}>
          <legend className={s.fieldLabel}>Who can edit</legend>
          <div className={s.radioRow} role="radiogroup" aria-label="Who can edit">
            {ACCESS.map((a) => (
              <label key={a.value} className={cn(s.radio, access === a.value && s.radioOn)}>
                <input type="radio" name="access" value={a.value} checked={access === a.value} onChange={() => setAccess(a.value)} />
                {a.icon} {a.label}
              </label>
            ))}
          </div>
          <p className={s.fieldHint}>{ACCESS.find((a) => a.value === access)?.hint}</p>
        </fieldset>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
