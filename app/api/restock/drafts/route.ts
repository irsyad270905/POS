import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") || "20");

  const AI_URL = process.env.AI_SERVICE_URL?.replace(/\/$/, "");
  const AI_KEY = process.env.AI_SERVICE_API_KEY || process.env.AI_API_KEY || "";
  if (AI_URL) {
    try {
      const headers: Record<string, string> = {};
      if (AI_KEY) headers["X-API-Key"] = AI_KEY;
      const r = await fetch(`${AI_URL}/api/drafts?limit=${limit}`, { headers, cache: "no-store" });
      const txt = await r.text();
      if (r.ok) return new NextResponse(txt, { status: 200, headers: { "Content-Type": "application/json" } });
    } catch {}
  }

  // fallback direct
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data: drafts, error } = await supabase.from("restock_drafts").select("*, suppliers(name)").order("created_at", { ascending: false }).limit(limit);
    if (error) throw new Error(error.message);
    for (const d of (drafts as unknown as Array<Record<string, unknown>>) || []) {
      const { data: items } = await supabase.from("restock_draft_items").select("*").eq("draft_id", d.id);
      (d as Record<string, unknown>).items = items || [];
      const sup = d.suppliers as { name: string } | { name: string }[] | null;
      if (Array.isArray(sup) && sup[0]) (d as Record<string, unknown>).supplier_name = sup[0].name;
      else if (sup && typeof sup === "object" && "name" in sup) (d as Record<string, unknown>).supplier_name = (sup as { name: string }).name;
    }
    return NextResponse.json({ data: drafts || [] });
  } catch (e: unknown) {
    return NextResponse.json({ message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const items: Array<{ product_id: string; quantity: number; product_name?: string }> | undefined = body.items;
  if (!items || items.length === 0) return NextResponse.json({ message: "Items wajib diisi" }, { status: 400 });
  for (const it of items) {
    if (!it.product_id || !it.quantity || Number(it.quantity) <= 0) {
      return NextResponse.json({ message: `Item ${it.product_id} quantity harus >0` }, { status: 400 });
    }
  }

  const AI_URL = process.env.AI_SERVICE_URL?.replace(/\/$/, "");
  const AI_KEY = process.env.AI_SERVICE_API_KEY || process.env.AI_API_KEY || "";
  if (AI_URL) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (AI_KEY) headers["X-API-Key"] = AI_KEY;
      const r = await fetch(`${AI_URL}/api/drafts`, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store" });
      const txt = await r.text();
      if (r.ok) return new NextResponse(txt, { status: 200, headers: { "Content-Type": "application/json" } });
      // jika AI error, lanjut fallback
      console.warn("[drafts POST] AI error", txt.slice(0, 500));
    } catch (e) {
      console.warn("[drafts POST] AI fail", e);
    }
  }

  // fallback direct
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const productIds = items.map((i) => i.product_id);
    const { data: products } = await supabase.from("products").select("id, name, sku, price").in("id", productIds);
    const prodMap = new Map<string, { id: string; name: string; sku: string; price: number }>((products as unknown as { id: string; name: string; sku: string; price: number }[] | null)?.map((p) => [p.id, p]) || []);

    let supplierId: string | null = body.supplier_id || null;
    let supplierName: string | null = null;
    if (supplierId) {
      const { data: sup } = await supabase.from("suppliers").select("id, name").eq("id", supplierId).maybeSingle();
      if (!sup) return NextResponse.json({ message: "Supplier tidak ditemukan" }, { status: 404 });
      supplierName = (sup as { name: string }).name;
    } else {
      const { data: sups } = await supabase.from("suppliers").select("id, name").limit(1);
      if (sups && sups[0]) {
        supplierId = (sups[0] as { id: string }).id;
        supplierName = (sups[0] as { name: string }).name;
      }
    }

    const { data: draft, error: draftErr } = await supabase
      .from("restock_drafts")
      .insert({ supplier_id: supplierId, batch_id: body.batch_id || null, notes: body.notes || null, status: "draft" } as never)
      .select("*")
      .single();
    if (draftErr) throw new Error(draftErr.message);
    const draftId = (draft as { id: string }).id;

    const toInsert = items.map((it) => {
      const p = prodMap.get(it.product_id);
      return {
        draft_id: draftId,
        product_id: it.product_id,
        quantity: Number(it.quantity),
        product_name: it.product_name || p?.name || it.product_id,
        sku: p?.sku || null,
        price_at_time: p?.price ?? null,
      };
    });
    const { error: itemsErr } = await supabase.from("restock_draft_items").insert(toInsert as unknown as never);
    if (itemsErr) throw new Error(itemsErr.message);

    // tandai recommendations approved jika batch_id ada
    if (body.batch_id) {
      for (const it of items) {
        await supabase.from("restock_recommendations").update({ status: "approved", approved_qty: Number(it.quantity) } as never).eq("batch_id", body.batch_id).eq("product_id", it.product_id).eq("status", "pending");
      }
    }

    return NextResponse.json({
      ok: true,
      draft: {
        id: draftId,
        supplier_id: supplierId,
        supplier_name: supplierName,
        status: (draft as { status: string }).status,
        notes: (draft as { notes: string | null }).notes,
        created_at: (draft as { created_at: string }).created_at,
        items: toInsert,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
