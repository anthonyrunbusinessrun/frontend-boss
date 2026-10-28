import type { AttachmentValue, FieldDef, FieldOptions, RecordRow, SectionDef, ViewAccess, ViewConfig, ViewDef, ViewType } from "@/lib/base/types";
import type { LayoutNode } from "@/lib/base/layout";

/** Error thrown by every call below; `fieldErrors` is set when the server rejected specific fields. */
export class ClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

let sessionPromise: Promise<void> | null = null;

/** Give this browser an anonymous user id (cookie). Used for favorites and personal views. */
export function ensureSession(): Promise<void> {
  if (!sessionPromise) {
    sessionPromise = fetch("/api/base/session", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
      .then((r) => {
        if (!r.ok) throw new ClientError(r.status, "Could not start a session.");
      })
      .catch((e) => {
        sessionPromise = null;
        throw e;
      });
  }
  return sessionPromise;
}

async function send<T>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/base/${path}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ClientError(0, "You appear to be offline. Check your connection and try again.");
  }
  if (res.status === 401 && !retried) {
    sessionPromise = null;
    await ensureSession();
    return send<T>(method, path, body, true);
  }
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({}))) as { error?: string; fieldErrors?: Record<string, string> };
  if (!res.ok) throw new ClientError(res.status, json.error ?? "Something went wrong.", json.fieldErrors);
  return json as T;
}

export const api = {
  bundle: (table: string) => send<import("@/lib/base/types").TableBundle>("GET", `tables/${table}`),

  createRecord: (table: string, values: Record<string, unknown>) => send<RecordRow>("POST", `tables/${table}/records`, values),
  updateRecord: (table: string, id: string, patch: Record<string, unknown>) => send<RecordRow>("PATCH", `tables/${table}/records/${id}`, patch),
  deleteRecords: (table: string, ids: string[]) => send<{ deleted: number; unlinked: number }>("POST", `tables/${table}/records/delete`, { ids }),

  createField: (table: string, body: { name: string; type: FieldDef["type"]; options?: FieldOptions }) => send<FieldDef>("POST", `tables/${table}/fields`, body),
  updateField: (table: string, key: string, body: { name?: string; options?: FieldOptions; required?: boolean }) => send<FieldDef>("PATCH", `tables/${table}/fields/${key}`, body),
  deleteField: (table: string, key: string) => send<void>("DELETE", `tables/${table}/fields/${key}`),

  createView: (table: string, body: { name: string; type: ViewType; access: ViewAccess; sectionId?: string | null; config?: Partial<ViewConfig> }) => send<ViewDef>("POST", `tables/${table}/views`, body),
  updateView: (table: string, id: string, body: { name?: string; config?: ViewConfig; access?: ViewAccess }) => send<ViewDef>("PATCH", `tables/${table}/views/${id}`, body),
  deleteView: (table: string, id: string) => send<void>("DELETE", `tables/${table}/views/${id}`),
  duplicateView: (table: string, id: string) => send<ViewDef>("POST", `tables/${table}/views/${id}/duplicate`, {}),
  submitForm: (table: string, viewId: string, values: Record<string, unknown>) => send<RecordRow>("POST", `tables/${table}/views/${viewId}/submit`, values),

  createSection: (table: string, name: string) => send<SectionDef>("POST", `tables/${table}/sections`, { name }),
  renameSection: (table: string, id: string, name: string) => send<SectionDef>("PATCH", `tables/${table}/sections/${id}`, { name }),
  deleteSection: (table: string, id: string) => send<{ moved: number }>("DELETE", `tables/${table}/sections/${id}`),
  layout: (table: string, nodes: LayoutNode[]) => send<{ views: ViewDef[]; sections: SectionDef[] }>("PUT", `tables/${table}/layout`, { nodes }),
  setFavorite: (table: string, kind: "view" | "record", refId: string, favorite: boolean) => send<void>("PUT", `tables/${table}/favorites`, { kind, refId, favorite }),

  async upload(file: File | Blob, name?: string): Promise<AttachmentValue> {
    const send1 = async () => {
      const form = new FormData();
      form.set("file", file, name ?? (file instanceof File ? file.name : "file"));
      return fetch("/api/base/files", { method: "POST", body: form });
    };
    let res = await send1();
    if (res.status === 401) {
      sessionPromise = null;
      await ensureSession();
      res = await send1();
    }
    const json = (await res.json().catch(() => ({}))) as AttachmentValue & { error?: string };
    if (!res.ok) throw new ClientError(res.status, json.error ?? "Upload failed.");
    return { id: json.id, name: json.name, url: json.url, type: json.type, size: json.size };
  },
};
