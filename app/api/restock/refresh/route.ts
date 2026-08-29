import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  // delegate ke /api/restock POST
  const base = req.nextUrl.origin;
  const r = await fetch(`${base}/api/restock`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: req.headers.get("authorization") || "" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const txt = await r.text();
  return new NextResponse(txt, { status: r.status, headers: { "Content-Type": "application/json" } });
}
