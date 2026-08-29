import { createClient } from "@supabase/supabase-js";

// Lightweight AI client for server-side proxy.
// AI service di VPS terpisah. Jika AI_SERVICE_URL tidak diset, fallback ke direct calculation via Supabase (dev mode tanpa VPS).
const AI_URL = process.env.AI_SERVICE_URL?.replace(/\/$/, "") || "";
const AI_KEY = process.env.AI_SERVICE_API_KEY || process.env.AI_API_KEY || "";

function aiHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (AI_KEY) h["X-API-Key"] = AI_KEY;
  return h;
}

export function isAiConfigured(): boolean {
  return !!AI_URL;
}

export async function aiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!AI_URL) throw new Error("AI_SERVICE_URL belum dikonfigurasi");
  const url = `${AI_URL}${path}`;
  const headers = { ...aiHeaders(), ...(init.headers as Record<string, string> | undefined) };
  return fetch(url, { ...init, headers, cache: "no-store" });
}

// Fallback: hitung langsung dari Supabase jika AI VPS belum tersedia.
// Dipakai oleh proxy route GET /api/restock sebagai fallback agar fitur tetap jalan di dev.
export async function computeDirectRecommendations(periodDays: number = 30, shortDays: number = 7) {
  const { recomputeViaSupabase } = await import("./recommender");
  return recomputeViaSupabase({ periodDays, shortDays });
}
