import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { restockKeys, productKeys, dashboardKeys } from "./keys";

export type RestockItem = {
  id?: string;
  batch_id?: string;
  product_id: string;
  product_name: string;
  sku: string;
  category?: string | null;
  unit: string;
  stock_current: number;
  stock_minimum: number;
  avg_daily_7: number;
  avg_daily_30: number;
  avg_daily: number;
  sold_7: number;
  sold_30: number;
  lead_time_days: number;
  safety_stock: number;
  reorder_point: number;
  target_stock: number;
  days_until_out: number | null;
  recommended_qty: number;
  priority: "tinggi" | "sedang" | "rendah" | "tidak_perlu";
  reason: string;
  insight?: string;
  status: string;
  supplier?: string | null;
  generated_at?: string;
};

export type RestockResponse = {
  generated_at: string;
  batch_id: string;
  settings: { analysis_period_days: number; analysis_short_days: number; safety_days: number; coverage_days: number };
  summary: { total_produk: number; tinggi: number; sedang: number; rendah: number; tidak_perlu: number };
  data: RestockItem[];
};

async function authedFetch(path: string, init: RequestInit = {}) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> || {}) };
  if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message || `Request failed ${res.status}`);
  }
  return res.json();
}

export function useRestock(priority?: string, period: number = 30) {
  return useQuery<RestockResponse>({
    queryKey: restockKeys.list(priority, period),
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (priority && priority !== "all") qs.set("priority", priority);
      if (period) qs.set("period", String(period));
      const path = `/api/restock${qs.toString() ? `?${qs.toString()}` : ""}`;
      return authedFetch(path);
    },
    staleTime: 30_000,
    gcTime: 120_000,
  });
}

export function useRestockDetail(productId: string | null) {
  return useQuery<RestockItem>({
    queryKey: productId ? restockKeys.detail(productId) : ["restock", "detail", "disabled"],
    queryFn: async () => authedFetch(`/api/restock/${encodeURIComponent(productId!)}`),
    enabled: !!productId,
  });
}

export function useDismissRestock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (idOrProductId: string) => authedFetch("/api/restock/dismiss", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: idOrProductId }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: restockKeys.all });
      qc.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}

export function useApproveRestock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity?: number }) =>
      authedFetch("/api/restock/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, quantity }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: restockKeys.all });
    },
  });
}

export function useRefreshRestock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (period?: number) => authedFetch("/api/restock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period_days: period }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: restockKeys.all }),
  });
}

export type Draft = {
  id: string;
  supplier_id: string | null;
  supplier_name?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;
  items: Array<{ product_id: string; quantity: number; product_name: string; sku?: string; price_at_time?: number }>;
};

export function useRestockDrafts() {
  return useQuery<{ data: Draft[] }>({
    queryKey: restockKeys.drafts(),
    queryFn: async () => authedFetch("/api/restock/drafts"),
  });
}

export function useCreateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { supplier_id?: string | null; batch_id?: string; notes?: string; items: Array<{ product_id: string; quantity: number; product_name?: string }> }) =>
      authedFetch("/api/restock/drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: restockKeys.drafts() });
      qc.invalidateQueries({ queryKey: restockKeys.all });
      qc.invalidateQueries({ queryKey: productKeys.all });
      qc.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

export function useSuppliers() {
  return useQuery<{ data: Array<{ id: string; name: string; lead_time_days: number }> }>({
    queryKey: restockKeys.suppliers(),
    queryFn: async () => authedFetch("/api/restock/suppliers"),
  });
}
