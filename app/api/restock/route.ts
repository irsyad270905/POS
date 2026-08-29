import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function supabaseFromRequest(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  // gunakan anon client dengan forward auth header untuk RLS check, tapi data fetch pakai service_role di recommender
  return { authHeader: auth };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ? Number(searchParams.get("period")) : undefined;
  const short = searchParams.get("short") ? Number(searchParams.get("short")) : undefined;
  const priority = searchParams.get("priority") || undefined;
  const useFallback = searchParams.get("fallback") === "1";

  // RBAC: cek user role via supabase auth (client)
  try {
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: req.headers.get("authorization") || "" } },
        auth: { persistSession: false },
      }
    );
    // tidak wajib block jika tidak ada auth (dev), tapi di prod harus admin
  } catch {}

  const AI_URL = process.env.AI_SERVICE_URL?.replace(/\/$/, "");
  const AI_KEY = process.env.AI_SERVICE_API_KEY || process.env.AI_API_KEY || "";

  // Jika AI VPS tersedia dan bukan fallback, proxy ke AI
  if (AI_URL && !useFallback) {
    try {
      const qs = new URLSearchParams();
      if (period) qs.set("period", String(period));
      if (short) qs.set("short", String(short));
      if (priority) qs.set("priority", priority);
      const url = `${AI_URL}/api/recommendations${qs.toString() ? `?${qs.toString()}` : ""}`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (AI_KEY) headers["X-API-Key"] = AI_KEY;
      const auth = req.headers.get("authorization");
      if (auth) headers["Authorization"] = auth;

      const r = await fetch(url, { headers, cache: "no-store" });
      const body = await r.text();
      if (r.ok) {
        return new NextResponse(body, { status: 200, headers: { "Content-Type": "application/json" } });
      }
      // jika AI error, fallback ke direct
      console.warn("[restock proxy] AI error", r.status, body.slice(0, 500));
    } catch (e: unknown) {
      console.warn("[restock proxy] AI fetch failed, fallback direct:", e instanceof Error ? e.message : String(e));
    }
  }

  // Fallback direct (tanpa VPS)
  try {
    const { recomputeViaSupabase } = await import("@/lib/restock/recommender");
    const result = await recomputeViaSupabase({ periodDays: period, shortDays: short });
    let data = result.data as unknown[];
    if (priority) {
      data = (result.data as Array<{ priority: string }>).filter((d) => d.priority === priority) as unknown[];
    }
    return NextResponse.json({ ...result, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // refresh trigger
  const body = await req.json().catch(() => ({}));
  const period = body.period_days || body.period;

  const AI_URL = process.env.AI_SERVICE_URL?.replace(/\/$/, "");
  const AI_KEY = process.env.AI_SERVICE_API_KEY || process.env.AI_API_KEY || "";

  if (AI_URL) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (AI_KEY) headers["X-API-Key"] = AI_KEY;
      const r = await fetch(`${AI_URL}/api/recommendations/refresh`, {
        method: "POST",
        headers,
        body: JSON.stringify({ period_days: period, use_llm: body.use_llm || false }),
        cache: "no-store",
      });
      const txt = await r.text();
      if (r.ok) return new NextResponse(txt, { status: 200, headers: { "Content-Type": "application/json" } });
      console.warn("[restock refresh] AI error", txt.slice(0, 500));
    } catch (e) {
      console.warn("[restock refresh] AI fail", e);
    }
  }

  try {
    const { recomputeViaSupabase } = await import("@/lib/restock/recommender");
    const result = await recomputeViaSupabase({ periodDays: period });
    return NextResponse.json({ ok: true, generated_at: result.generated_at, batch_id: result.batch_id, summary: result.summary, count: (result.data as unknown[]).length });
  } catch (err: unknown) {
    return NextResponse.json({ message: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
