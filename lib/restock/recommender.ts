/**
 * Direct recommender (Node mirror dari AI/app/services/recommender.py)
 * Dipakai sebagai fallback jika AI_SERVICE_URL belum diset (dev mode).
 * Logika identik: SRS 2.7 - 2.10
 */
import { createClient } from "@supabase/supabase-js";

type Settings = {
  analysis_period_days: number;
  analysis_short_days: number;
  safety_days: number;
  coverage_days: number;
};

const DEFAULTS: Settings = {
  analysis_period_days: 30,
  analysis_short_days: 7,
  safety_days: 2,
  coverage_days: 14,
};

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function templateInsight(rec: Record<string, unknown>): string {
  const name = rec.product_name as string;
  const stock = rec.stock_current as number;
  const avg = rec.avg_daily as number;
  const days = rec.days_until_out as number | null;
  const lead = rec.lead_time_days as number;
  const priority = rec.priority as string;
  const qty = rec.recommended_qty as number;
  const unit = (rec.unit as string) || "pcs";

  if (avg === 0) return `${name} tidak ada penjualan 30 hari terakhir. Stok ${stock} masih aman, tidak perlu restock.`;
  if (priority === "tinggi")
    return `${name} diprioritaskan karena penjualan tinggi ${avg.toFixed(1)}/${unit}/hari dan stok ${stock} diperkirakan habis dalam ${days?.toFixed(0) ?? "-"} hari, lebih cepat dari lead time ${lead} hari. Disarankan restock ${qty} ${unit} segera.`;
  if (priority === "sedang")
    return `${name} perlu diperhatikan. Rata-rata ${avg.toFixed(1)}/${unit}/hari, stok ${stock} cukup untuk ~${days?.toFixed(0) ?? "-"} hari. Rekomendasi ${qty} ${unit}.`;
  if (priority === "rendah")
    return `${name} masih aman. Stok ${stock} cukup ~${days?.toFixed(0) ?? "-"} hari. Restock ${qty} ${unit} antisipatif.`;
  return `${name} stok ${stock} aman, tidak perlu restock.`;
}

export async function recomputeViaSupabase(opts: { periodDays?: number; shortDays?: number } = {}) {
  const supabase = supabaseAdmin();

  // settings
  let settings: Settings = { ...DEFAULTS };
  try {
    const { data } = await supabase.from("restock_settings").select("*").eq("id", 1).maybeSingle();
    if (data) {
      settings = {
        analysis_period_days: data.analysis_period_days ?? DEFAULTS.analysis_period_days,
        analysis_short_days: data.analysis_short_days ?? DEFAULTS.analysis_short_days,
        safety_days: data.safety_days ?? DEFAULTS.safety_days,
        coverage_days: data.coverage_days ?? DEFAULTS.coverage_days,
      };
    }
  } catch {}

  const period = opts.periodDays ?? settings.analysis_period_days;
  const short = opts.shortDays ?? settings.analysis_short_days;
  const safetyDays = settings.safety_days;
  const coverageDays = settings.coverage_days;

  // products
  const { data: products, error: prodErr } = await supabase.from("products").select("*, categories(name)");
  if (prodErr) throw new Error(prodErr.message);
  const active = (products || []).filter((p: Record<string, unknown>) => (p.is_active as boolean | null) !== false);

  // suppliers map
  let psMap: Record<string, { suppliers: { name: string; lead_time_days: number } | null }> = {};
  try {
    const { data } = await supabase.from("product_suppliers").select("product_id, suppliers(name, lead_time_days)");
    for (const r of (data as unknown as { product_id: string; suppliers: { name: string; lead_time_days: number } | null }[]) || []) {
      psMap[r.product_id] = { suppliers: r.suppliers };
    }
  } catch {}
  let defaultSupplier: { name: string } | null = null;
  try {
    const { data } = await supabase.from("suppliers").select("name").limit(1);
    if (data && data[0]) defaultSupplier = data[0] as { name: string };
  } catch {}

  // sales
  const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString();
  const sinceShort = new Date(Date.now() - short * 24 * 60 * 60 * 1000).toISOString();

  const { data: txns } = await supabase.from("transactions").select("id, created_at").gte("created_at", since);
  const txnIds: string[] = (txns || []).map((t: { id: string }) => t.id);
  const txnDate = new Map<string, string>((txns || []).map((t: { id: string; created_at: string }) => [t.id, t.created_at]));

  const sold7 = new Map<string, number>();
  const sold30 = new Map<string, number>();

  if (txnIds.length > 0) {
    const chunk = 900;
    for (let i = 0; i < txnIds.length; i += chunk) {
      const c = txnIds.slice(i, i + chunk);
      const { data: items } = await supabase.from("transaction_items").select("transaction_id, product_id, quantity").in("transaction_id", c);
      for (const it of (items as unknown as { transaction_id: string; product_id: string | null; quantity: number; created_at?: string }[]) || []) {
        if (!it.product_id) continue;
        const created = txnDate.get(it.transaction_id) || "";
        sold30.set(it.product_id, (sold30.get(it.product_id) || 0) + (it.quantity || 0));
        if (created >= sinceShort) {
          sold7.set(it.product_id, (sold7.get(it.product_id) || 0) + (it.quantity || 0));
        }
      }
    }
  }

  const nowIso = new Date().toISOString();
  const batchId = crypto.randomUUID();

  const results = active.map((p: Record<string, unknown>) => {
    const pid = p.id as string;
    const name = p.name as string;
    const sku = (p.sku as string) || "";
    const stock = Number(p.stock ?? 0);
    const stockMin = Number(p.stock_minimum ?? 10);
    let lead = Number(p.lead_time_days ?? 3);
    const unit = ((p.unit as string) || "pcs").toLowerCase();
    const catRaw = p.categories as { name: string } | { name: string }[] | null;
    const catName = Array.isArray(catRaw) ? catRaw[0]?.name : (catRaw as { name: string } | null)?.name || null;
    const supplierName = psMap[pid]?.suppliers?.name || defaultSupplier?.name || null;
    if (psMap[pid]?.suppliers?.lead_time_days != null) lead = Number(psMap[pid].suppliers!.lead_time_days);

    const s7 = sold7.get(pid) || 0;
    const s30 = sold30.get(pid) || 0;
    const avg7 = s7 / short;
    const avg30 = s30 / period;
    let avgDaily: number;
    if (s7 === 0 && s30 > 0) avgDaily = avg30;
    else if (s7 > 0 && period !== short) avgDaily = 0.6 * avg7 + 0.4 * avg30;
    else avgDaily = period >= short ? avg30 : avg7;

    const safetyDaysEff = Number(p.safety_stock_days ?? safetyDays);
    let safetyStock = avgDaily > 0 ? Math.ceil(avgDaily * safetyDaysEff) : 0;
    if (avgDaily > 0 && safetyStock === 0) safetyStock = 1;

    const demandLead = avgDaily * lead;
    const reorderPoint = Math.ceil(demandLead + safetyStock);
    const daysUntilOut = avgDaily > 0 ? stock / avgDaily : null;

    const targetOverride = p.target_stock as number | null;
    const targetStock = targetOverride && Number(targetOverride) > 0 ? Number(targetOverride) : avgDaily > 0 ? Math.ceil(avgDaily * coverageDays + safetyStock) : stockMin;

    let recommendedQty = 0;
    if (avgDaily > 0) {
      recommendedQty = Math.max(0, targetStock - stock);
      if (stock < reorderPoint && recommendedQty < reorderPoint - stock) recommendedQty = reorderPoint - stock;
    }

    // priority & reason
    let priority: string;
    let reason: string;
    if (avgDaily === 0) {
      priority = "tidak_perlu";
      reason = `${name} tidak ada penjualan 30 hari terakhir. Stok ${stock} ${unit} aman, tidak perlu restock.`;
      recommendedQty = 0;
    } else if (daysUntilOut !== null && daysUntilOut <= lead) {
      priority = "tinggi";
      reason = `Stok ${stock} ${unit} diperkirakan habis dalam ${daysUntilOut.toFixed(1)} hari, lebih cepat dari lead time ${lead} hari. Penjualan ${avgDaily.toFixed(1)}/${unit}/hari. Segera restock.`;
    } else if (stock <= Math.ceil(reorderPoint * 0.7)) {
      priority = "tinggi";
      reason = `Stok ${stock} ${unit} di bawah 70% reorder point (${reorderPoint}). Rata-rata ${avgDaily.toFixed(1)}/${unit}/hari. Prioritas tinggi.`;
    } else if (daysUntilOut !== null && daysUntilOut <= lead * 2) {
      priority = "sedang";
      reason = `Stok ${stock} ${unit} cukup untuk ~${daysUntilOut.toFixed(0)} hari (lead ${lead} hari). Mulai mendekati batas aman. Rekomendasi ${recommendedQty} ${unit}.`;
    } else if (stock <= reorderPoint) {
      priority = "sedang";
      reason = `Stok ${stock} ${unit} di bawah reorder point ${reorderPoint}. Rata-rata ${avgDaily.toFixed(1)}/${unit}/hari. Perlu diperhatikan.`;
    } else if (recommendedQty === 0) {
      priority = "tidak_perlu";
      reason = `Stok ${stock} ${unit} masih aman untuk ~${daysUntilOut?.toFixed(0) ?? "-"} hari. Tidak perlu restock.`;
    } else {
      priority = "rendah";
      reason = `Stok ${stock} ${unit} masih aman (~${daysUntilOut?.toFixed(0) ?? "-"} hari). Restock ${recommendedQty} ${unit} antisipatif.`;
    }

    if (priority === "tidak_perlu") recommendedQty = 0;

    const rec: Record<string, unknown> = {
      product_id: pid,
      product_name: name,
      sku,
      category: catName,
      unit,
      stock_current: stock,
      stock_minimum: stockMin,
      avg_daily_7: Math.round(avg7 * 100) / 100,
      avg_daily_30: Math.round(avg30 * 100) / 100,
      avg_daily: Math.round(avgDaily * 100) / 100,
      sold_7: s7,
      sold_30: s30,
      lead_time_days: lead,
      safety_stock: safetyStock,
      reorder_point: reorderPoint,
      target_stock: targetStock,
      days_until_out: daysUntilOut !== null ? Math.round(daysUntilOut * 10) / 10 : null,
      recommended_qty: recommendedQty,
      priority,
      reason,
      supplier: supplierName,
      batch_id: batchId,
      generated_at: nowIso,
    };
    rec.insight = templateInsight(rec as Record<string, unknown>);
    return rec;
  });

  const order: Record<string, number> = { tinggi: 0, sedang: 1, rendah: 2, tidak_perlu: 3 };
  results.sort((a, b) => {
    const pa = order[a.priority as string] ?? 9;
    const pb = order[b.priority as string] ?? 9;
    if (pa !== pb) return pa - pb;
    const da = (a.days_until_out as number | null) ?? 999;
    const db = (b.days_until_out as number | null) ?? 999;
    return da - db;
  });

  // persist (best effort)
  try {
    const toInsert = results.map((r) => ({
      batch_id: batchId,
      product_id: r.product_id,
      stock_current: r.stock_current,
      stock_minimum: r.stock_minimum,
      avg_daily_7: r.avg_daily_7,
      avg_daily_30: r.avg_daily_30,
      avg_daily: r.avg_daily,
      sold_7: r.sold_7,
      sold_30: r.sold_30,
      lead_time_days: r.lead_time_days,
      safety_stock: r.safety_stock,
      reorder_point: r.reorder_point,
      target_stock: r.target_stock,
      days_until_out: r.days_until_out,
      recommended_qty: r.recommended_qty,
      priority: r.priority,
      reason: r.reason,
      insight: r.insight,
      status: "pending",
    }));
    for (let i = 0; i < toInsert.length; i += 100) {
      const chunk = toInsert.slice(i, i + 100);
      await supabase.from("restock_recommendations").insert(chunk as unknown as never);
    }
  } catch (e) {
    console.warn("[restock] gagal simpan rekomendasi:", e);
  }

  const summary = {
    total_produk: results.length,
    tinggi: results.filter((r) => r.priority === "tinggi").length,
    sedang: results.filter((r) => r.priority === "sedang").length,
    rendah: results.filter((r) => r.priority === "rendah").length,
    tidak_perlu: results.filter((r) => r.priority === "tidak_perlu").length,
  };

  return {
    generated_at: nowIso,
    batch_id: batchId,
    settings: {
      analysis_period_days: period,
      analysis_short_days: short,
      safety_days: safetyDays,
      coverage_days: coverageDays,
    },
    summary,
    data: results,
  };
}
