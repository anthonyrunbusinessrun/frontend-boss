import { currentUser } from "@/server/auth/server";
import { trustedOrigin } from "@/server/auth/policy";
import { bridge } from "@/server/multiplexer/bridge";
import { testVoucherInput } from "@/server/multiplexer/test-voucher";
import { createRecord } from "@/server/base/store";
import { requireDb } from "@/lib/db";
import { voucherNumber } from "@/lib/base/voucher";
import type { Snapshot } from "@/lib/shared-contract";
export const dynamic = "force-dynamic";
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET() {
  if (!(await currentUser())) return json({ error: "Please sign in" }, 401);
  try {
    const rows = await requireDb().query("SELECT data FROM boss_records WHERE section_slug='vouchers' AND data->>'voucherId' LIKE 'TEST-MUX:%' ORDER BY created_at DESC LIMIT 200");
    return json({ vouchers: rows.rows.map(({data}) => ({ orderId: data.voucherId.slice(9), id: data.id, number: voucherNumber(data), url: `/vouchers?record=${encodeURIComponent(data.id)}` })) });
  } catch { return json({ error: "Voucher service temporarily unavailable" }, 503); }
}
export async function POST(request: Request) {
  if (!trustedOrigin(request)) return json({ error: "Cross-site request rejected" }, 403);
  const user = await currentUser();
  if (!user?.email) return json({ error: "Please sign in" }, 401);
  let orderId: string;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error();
    let bytes = 0; const chunks: Uint8Array[] = [];
    for (;;) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > 1024) { await reader.cancel(); throw new Error(); } chunks.push(part.value); }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (Object.keys(body).join() !== "orderId" || !/^MUX-\d+$/.test(body.orderId)) throw new Error();
    orderId = body.orderId;
  } catch { return json({ error: "A valid orderId is required" }, 400); }
  const upstream = await bridge(new Request(request.url));
  if (!upstream.ok) return upstream;
  let input: ReturnType<typeof testVoucherInput>;
  try { input = testVoucherInput((await upstream.json() as Snapshot).data, orderId, user.email); }
  catch (e) { return json({ error: e instanceof Error ? e.message : "Invalid test order" }, 422); }
  try {
    const record = await createRecord(requireDb(), "vouchers", input, { idempotencyKey: { field: "voucherId", value: input.voucherId } });
    return json({ id: record.id, orderId, number: voucherNumber(record), url: `/vouchers?record=${encodeURIComponent(record.id)}` });
  } catch { return json({ error: "Voucher could not be confirmed. Retry safely; an existing test voucher will be reused." }, 503); }
}
