import "server-only";
import { currentUser } from "@/server/auth/server";
import { trustedOrigin } from "@/server/auth/policy";

const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
const json = (error: string, status: number) =>
  Response.json({ error }, { status, headers });
/** Browsers never receive the bridge credential; identity comes from verified Supabase Auth. */
export async function bridge(request: Request, events = false) {
  if (request.method === "POST" && !trustedOrigin(request))
    return json("Cross-site request rejected", 403);
  const user = await currentUser();
  if (!user?.email) return json("Please sign in", 401);
  const origin = process.env.MUX_API_ORIGIN,
    token = process.env.MUX_BRIDGE_TOKEN;
  if (!origin || !token)
    return json("Shared operations are not configured", 503);
  try {
    const url = new URL("/api/operations" + (events ? "/events" : ""), origin);
    if (
      url.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(url.hostname)
    )
      return json("Secure upstream is required", 503);
    let body: string | undefined;
    if (request.method === "POST") {
      const reader = request.body?.getReader();
      if (!reader) return json("Empty request", 400);
      const parts: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 65536) {
          await reader.cancel();
          return json("Request is too large", 413);
        }
        parts.push(value);
      }
      body = Buffer.concat(parts).toString("utf8");
    }
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(events ? 75000 : 15000),
    ]);
    const upstream = await fetch(url, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "x-boss-actor": user.email,
        "Content-Type": "application/json",
      },
      body,
      signal,
      cache: "no-store",
      redirect: "error",
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...headers,
        "Content-Type":
          upstream.headers.get("content-type") ?? "application/json",
        ...(events ? { "X-Accel-Buffering": "no" } : {}),
      },
    });
  } catch {
    return json(
      "Shared service temporarily unavailable; no local fallback writes are made",
      503,
    );
  }
}
