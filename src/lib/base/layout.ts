import type { SectionDef, ViewDef } from "./types";

/**
 * Sidebar structure. Root level holds views and sections in one ordered list; a section holds views.
 * Sections cannot nest. Only the layout moves: no record, field or view is ever deleted by a move.
 */
export interface LayoutNode {
  kind: "view" | "section";
  id: string;
  /** Section the view lives in (`null` = root). Always `null` for sections. */
  parentId: string | null;
  position: number;
}

export interface SidebarTree {
  root: Array<{ kind: "view"; view: ViewDef } | { kind: "section"; section: SectionDef; views: ViewDef[] }>;
}

export function buildTree(views: ViewDef[], sections: SectionDef[]): SidebarTree {
  const sectionIds = new Set(sections.map((s) => s.id));
  const byParent = new Map<string | null, ViewDef[]>();
  for (const v of views) {
    const parent = v.sectionId && sectionIds.has(v.sectionId) ? v.sectionId : null; // orphans fall back to root
    byParent.set(parent, [...(byParent.get(parent) ?? []), v]);
  }
  const rootItems: Array<{ pos: number; tie: number; node: SidebarTree["root"][number] }> = [];
  for (const v of byParent.get(null) ?? []) rootItems.push({ pos: v.position, tie: 0, node: { kind: "view", view: v } });
  for (const s of sections) {
    const children = [...(byParent.get(s.id) ?? [])].sort((a, b) => a.position - b.position);
    rootItems.push({ pos: s.position, tie: 1, node: { kind: "section", section: s, views: children } });
  }
  rootItems.sort((a, b) => a.pos - b.pos || a.tie - b.tie);
  return { root: rootItems.map((r) => r.node) };
}

/** Flatten a tree back into explicit, gap-free positions. */
export function treeToNodes(tree: SidebarTree): LayoutNode[] {
  const out: LayoutNode[] = [];
  tree.root.forEach((n, i) => {
    if (n.kind === "view") out.push({ kind: "view", id: n.view.id, parentId: null, position: i });
    else {
      out.push({ kind: "section", id: n.section.id, parentId: null, position: i });
      n.views.forEach((v, j) => out.push({ kind: "view", id: v.id, parentId: n.section.id, position: j }));
    }
  });
  return out;
}

export type DropTarget =
  /** Insert before/after another item (a root view, a section, or a view inside a section). */
  | { type: "before" | "after"; id: string; kind: "view" | "section" }
  /** Drop onto a section: append to its views. */
  | { type: "into"; sectionId: string }
  /** Drop onto empty root space: append to the root. */
  | { type: "root-end" };

/**
 * Move a view or a section. Returns the new tree, or `null` when the move is not allowed
 * (a section dropped into a section, dropping onto itself, unknown ids).
 */
export function moveNode(tree: SidebarTree, move: { kind: "view" | "section"; id: string }, target: DropTarget): SidebarTree | null {
  // clone
  const root = tree.root.map((n) => (n.kind === "view" ? { ...n } : { ...n, views: [...n.views] }));

  type Entry = SidebarTree["root"][number];
  let moving: Entry | null = null;

  // detach
  if (move.kind === "section") {
    const at = root.findIndex((n) => n.kind === "section" && n.section.id === move.id);
    if (at < 0) return null;
    moving = root.splice(at, 1)[0];
  } else {
    const rootAt = root.findIndex((n) => n.kind === "view" && n.view.id === move.id);
    if (rootAt >= 0) moving = root.splice(rootAt, 1)[0];
    else {
      for (const n of root) {
        if (n.kind !== "section") continue;
        const j = n.views.findIndex((v) => v.id === move.id);
        if (j >= 0) {
          moving = { kind: "view", view: n.views.splice(j, 1)[0] };
          break;
        }
      }
    }
  }
  if (!moving) return null;

  // attach
  if (target.type === "root-end") {
    root.push(moving);
    return { root };
  }
  if (target.type === "into") {
    if (moving.kind !== "view") return null; // sections do not nest
    const section = root.find((n) => n.kind === "section" && n.section.id === target.sectionId);
    if (!section || section.kind !== "section") return null;
    section.views.push(moving.view);
    return { root };
  }

  if (target.id === move.id) return null;
  const offset = target.type === "after" ? 1 : 0;

  if (target.kind === "section") {
    const at = root.findIndex((n) => n.kind === "section" && n.section.id === target.id);
    if (at < 0) return null;
    root.splice(at + offset, 0, moving);
    return { root };
  }

  // target is a view: either at root or inside a section
  const rootAt = root.findIndex((n) => n.kind === "view" && n.view.id === target.id);
  if (rootAt >= 0) {
    root.splice(rootAt + offset, 0, moving);
    return { root };
  }
  if (moving.kind !== "view") return null; // a section cannot be placed between a section's views
  for (const n of root) {
    if (n.kind !== "section") continue;
    const j = n.views.findIndex((v) => v.id === target.id);
    if (j >= 0) {
      n.views.splice(j + offset, 0, moving.view);
      return { root };
    }
  }
  return null;
}

/** Apply explicit layout nodes to views/sections (client state after a successful move). */
export function applyNodes(views: ViewDef[], sections: SectionDef[], nodes: LayoutNode[]): { views: ViewDef[]; sections: SectionDef[] } {
  const byId = new Map(nodes.map((n) => [`${n.kind}:${n.id}`, n]));
  return {
    views: views.map((v) => {
      const n = byId.get(`view:${v.id}`);
      return n ? { ...v, sectionId: n.parentId, position: n.position } : v;
    }),
    sections: sections.map((s) => {
      const n = byId.get(`section:${s.id}`);
      return n ? { ...s, position: n.position } : s;
    }),
  };
}

/** Names must be unique case-insensitively among siblings of the same kind so the sidebar stays unambiguous. */
export function uniqueName(base: string, taken: string[]): string {
  const lower = new Set(taken.map((t) => t.trim().toLowerCase()));
  const clean = base.trim();
  if (!lower.has(clean.toLowerCase())) return clean;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${clean} ${i}`;
    if (!lower.has(candidate.toLowerCase())) return candidate;
  }
  return `${clean} ${Date.now()}`;
}
