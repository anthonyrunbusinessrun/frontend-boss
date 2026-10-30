import { bridge } from "@/server/multiplexer/bridge";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const GET = (request: Request) => bridge(request, true);
