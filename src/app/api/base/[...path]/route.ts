import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";
import { handleApi, isSessionId, SESSION_COOKIE, type ApiResponse } from "@/server/base/api";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

async function handle(request: Request, { params }: RouteContext) {
  const { path } = await params;
  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE)?.value;
  const userId = isSessionId(cookie) ? cookie : null;

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
  if (result.setUserId) {
    response.cookies.set(SESSION_COOKIE, result.setUserId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
