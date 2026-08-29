import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const AI_URL = process.env.AI_SERVICE_URL?.replace(/\/$/, "");
  const AI_KEY = process.env.AI_SERVICE_API_KEY || process.env.AI_API_KEY || "";

  if (AI_URL) {
    try {
      const headers: Record<string, string> = {};
      if (AI_KEY) headers["X-API-Key"] = AI_KEY;
      const r = await fetch(`${AI_URL}/api/recommendations/${encodeURIComponent(id)}`, { headers, cache: "no-store" });
      const txt = await r.text();
      if (r.ok) return new NextResponse(txt, { status: 200, headers: { "Content-Type": "application/json" } });
      if (r.status === 404) return NextResponse.json({ message: "Rekomendasi tidak ditemukan" }, { status: 404 });
    } catch {}
  }

  // fallback: hitung direct lalu cari product_id
  try {
    const { recomputeViaSupabase } = await import("@/lib/restock/recommender");
    const result = await recomputeViaSupabase({});
    const found = (result.data as Array<Record<string, unknown>>).find((d) => d.product_id === id || d.id === id);
    if (!found) return NextResponse.json({ message: "Produk tidak ditemukan" }, { status: 404 });
    return NextResponse.json(found);
  } catch (e: unknown) {
    return NextResponse.json({ message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
