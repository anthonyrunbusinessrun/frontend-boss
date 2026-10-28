import type { Pool } from "pg";
import { ApiError, applyLayout, createField, createRecord, createSection, createView, deleteField, deleteRecords, deleteSection, deleteView, duplicateView, getBundle, getFile, MAX_FILE_BYTES, peekCode, queryTable, renameSection, saveFile, setFavorite, submitForm, updateField, updateRecord, updateView } from "./store";

/**
 * Routes of `/api/base/*`, independent of Next so they can be tested against a real database.
 * Browser mutations must be same-origin and carry the session cookie; scripts may use the write token.
 */
export interface ApiRequest {
  method: string;
  /** Path segments after `/api/base`. */
  segments: string[];
  userId: string | null;
  request: Request;
}

export interface ApiResponse {
  status: number;
  json?: unknown;
  /** When set, the caller must set the session cookie to this id. */
  setUserId?: string;
  file?: { name: string; mime: string; data: Buffer };
}

export const SESSION_COOKIE = "boss_uid";
const SESSION_ID = /^[a-f0-9]{32}$/;
export const isSessionId = (v: string | undefined | null): v is string => !!v && SESSION_ID.test(v);

export function newSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Reject cross-site writes (CSRF). Same-origin fetches send Origin and/or Sec-Fetch-Site. */
export function isSameOriginRequest(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "none";
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function hasWriteToken(request: Request): boolean {
  const expected = process.env.API_WRITE_TOKEN;
  return !!expected && request.headers.get("authorization") === `Bearer ${expected}`;
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > 2_000_000) throw new ApiError(413, "Request is too large.");
  if (!text) return {};
  try {
    const v = JSON.parse(text);
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  throw new ApiError(400, "Body must be a JSON object.");
}

const ok = (json: unknown, status = 200): ApiResponse => ({ status, json });

export async function handleApi(pool: Pool, req: ApiRequest): Promise<ApiResponse> {
  const { method, segments, userId, request } = req;
  try {
    const mutating = method !== "GET" && method !== "HEAD";
    if (mutating && !hasWriteToken(request) && !isSameOriginRequest(request)) throw new ApiError(403, "Cross-site requests are not allowed.");

    const [root, slug, resource, id, action] = segments;

    if (root === "session" && method === "POST") {
      if (userId) return ok({ userId });
      const fresh = newSessionId();
      return { status: 201, json: { userId: fresh }, setUserId: fresh };
    }

    if (root === "files" && method === "POST") {
      if (!userId) throw new ApiError(401, "No session.");
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new ApiError(422, "Choose a file to upload.");
      if (file.size > MAX_FILE_BYTES) throw new ApiError(413, "Files can be up to 5 MB.");
      return ok(await saveFile(pool, { name: file.name, mime: file.type, bytes: Buffer.from(await file.arrayBuffer()) }, userId), 201);
    }
    if (root === "files" && method === "GET" && slug) {
      const f = await getFile(pool, slug);
      if (!f) throw new ApiError(404, "File not found.");
      return { status: 200, file: f };
    }

    if (root !== "tables" || !slug) throw new ApiError(404, "Not found");

    if (mutating && !userId && !hasWriteToken(request)) throw new ApiError(401, "No session.");
    const uid = userId;

    // GET /tables/:t
    if (!resource) {
      if (method === "GET") return ok(await getBundle(pool, slug, uid));
      throw new ApiError(405, "Method not allowed");
    }

    // next automatic code (informational) and server-side filtering
    if (resource === "next" && method === "GET" && id) return ok(await peekCode(pool, slug, id));
    if (resource === "query" && method === "POST") return ok(await queryTable(pool, slug, await readJson(request)));

    // records
    if (resource === "records" && !action) {
      if (method === "POST" && !id) return ok(await createRecord(pool, slug, await readJson(request)), 201);
      if (method === "PATCH" && id) return ok(await updateRecord(pool, slug, id, await readJson(request)));
      if (method === "DELETE" && id) return ok(await deleteRecords(pool, slug, [id]));
    }
    if (resource === "records" && id === "delete" && method === "POST") {
      const body = await readJson(request);
      return ok(await deleteRecords(pool, slug, Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : []));
    }

    // fields
    if (resource === "fields" && !action) {
      if (method === "POST" && !id) return ok(await createField(pool, slug, await readJson(request)), 201);
      if (method === "PATCH" && id) return ok(await updateField(pool, slug, id, await readJson(request)));
      if (method === "DELETE" && id) {
        await deleteField(pool, slug, id);
        return { status: 204 };
      }
    }

    // views
    if (resource === "views") {
      if (method === "POST" && !id) return ok(await createView(pool, slug, await readJson(request), uid), 201);
      if (method === "PATCH" && id && !action) return ok(await updateView(pool, slug, id, await readJson(request), uid));
      if (method === "DELETE" && id && !action) {
        await deleteView(pool, slug, id, uid);
        return { status: 204 };
      }
      if (method === "POST" && id && action === "duplicate") return ok(await duplicateView(pool, slug, id, uid), 201);
      if (method === "POST" && id && action === "submit") return ok(await submitForm(pool, slug, id, await readJson(request), uid), 201);
    }

    // sections
    if (resource === "sections" && !action) {
      if (method === "POST" && !id) return ok(await createSection(pool, slug, await readJson(request), uid), 201);
      if (method === "PATCH" && id) return ok(await renameSection(pool, slug, id, await readJson(request)));
      if (method === "DELETE" && id) return ok(await deleteSection(pool, slug, id));
    }

    // layout + favorites
    if (resource === "layout" && method === "PUT") return ok(await applyLayout(pool, slug, (await readJson(request)).nodes, uid));
    if (resource === "favorites" && method === "PUT") {
      await setFavorite(pool, slug, await readJson(request), uid);
      return { status: 204 };
    }

    throw new ApiError(404, "Not found");
  } catch (e) {
    if (e instanceof ApiError) return { status: e.status, json: { error: e.message, ...(e.details ?? {}) } };
    // Foreign-key / check violations from concurrent edits should not look like server faults.
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "23505") return { status: 409, json: { error: "That already exists." } };
    console.error("[api/base]", e);
    return { status: 500, json: { error: "Something went wrong. Please try again." } };
  }
}
