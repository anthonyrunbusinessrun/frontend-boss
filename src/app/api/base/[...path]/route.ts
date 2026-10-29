import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";
import { handleApi, type ApiResponse } from "@/server/base/api";
import { apiIdentity } from "@/server/auth/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

async function handle(request: Request, { params }: RouteContext) {
  const { path } = await params;
  const identity = await apiIdentity(request);
  if (!identity) return NextResponse.json({ error: "Please sign in." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const userId = identity.userId;

  let result: ApiResponse;
  try {
    result = await handleApi(requireDb(), { method: request.method, segments: path, userId, request });
  } catch (error) {
    // requireDb() throws when DATABASE_URL is missing.
    console.error("[api/base]", error);
    return NextResponse.json({ error: "The database is not available." }, { status: 503 });
  }

  const response = result.file
    ? new NextResponse(new Uint8Array(result.file.data), { status: result.status })
    : result.json === undefined
      ? new NextResponse(null, { status: result.status })
      : NextResponse.json(result.json, { status: result.status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
