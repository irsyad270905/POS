import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id: string | undefined = body.id || body.product_id || body.rec_id;
  const qty = body.quantity ?? body.qty ?? body.approved_qty;
  if (!id) return NextResponse.json({ message: "Field id wajib" }, { status: 400 });

  const AI_URL = process.env.AI_SERVICE_URL?.replace(/\/$/, "");
  const AI_KEY = process.env.AI_SERVICE_API_KEY || process.env.AI_API_KEY || "";

  if (AI_URL) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (AI_KEY) headers["X-API-Key"] = AI_KEY;
      const r = await fetch(`${AI_URL}/api/recommendations/${encodeURIComponent(id)}/approve`, { method: "POST", headers, body: JSON.stringify({ quantity: qty }), cache: "no-store" });
      const txt = await r.text();
      if (r.ok) return new NextResponse(txt, { status: 200, headers: { "Content-Type": "application/json" } });
    } catch {}
  }

  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data: byId } = await supabase.from("restock_recommendations").select("id").eq("id", id).maybeSingle();
    if (byId) {
      await supabase.from("restock_recommendations").update({ status: "approved", approved_qty: qty != null ? Number(qty) : null }).eq("id", id);
      return NextResponse.json({ ok: true, id, status: "approved", approved_qty: qty });
    }
    const { data: pending } = await supabase.from("restock_recommendations").select("id").eq("product_id", id).eq("status", "pending").order("generated_at", { ascending: false }).limit(1).maybeSingle();
    if (pending) {
      await supabase.from("restock_recommendations").update({ status: "approved", approved_qty: qty != null ? Number(qty) : null }).eq("id", pending.id);
      return NextResponse.json({ ok: true, id: pending.id, status: "approved", approved_qty: qty });
    }
    return NextResponse.json({ message: "Rekomendasi tidak ditemukan" }, { status: 404 });
  } catch (e: unknown) {
    return NextResponse.json({ message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
