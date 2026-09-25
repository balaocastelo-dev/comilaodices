import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Healthcheck para o Coolify/Docker */
export function GET() {
  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}
