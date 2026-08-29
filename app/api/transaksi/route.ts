import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase env belum dikonfigurasi di Vercel")
  return createClient(url, key, { auth: { persistSession: false } })
}

// GET - List transaksi + filter by date
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date"); // YYYY-MM-DD

  try {
    const supabase = getSupabase()

    let query = supabase
      .from("transactions")
      .select("*, profiles!inner(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(20);

    if (date) {
      const startDate = `${date}T00:00:00+07:00`;
      const endDate = `${date}T23:59:59+07:00`;
      query = query.gte("created_at", startDate).lte("created_at", endDate);
    }

    const { data: txns, error } = await query;

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    // Ambil items per transaksi
    const txnIds = (txns || []).map((t) => t.id);
    const { data: items } = await supabase
      .from("transaction_items")
      .select("*")
      .in("transaction_id", txnIds);

    const itemsByTxn: Record<string, any[]> = {};
    for (const item of items || []) {
      if (!itemsByTxn[item.transaction_id]) itemsByTxn[item.transaction_id] = [];
      itemsByTxn[item.transaction_id].push({
        id: item.id,
        product_id: item.product_id,
        nama: item.product_name,
        quantity: item.quantity,
        harga: Number(item.price_at_time),
        subtotal: Number(item.price_at_time) * item.quantity,
      });
    }

    const result = (txns || []).map((t) => ({
      id: t.id,
      invoice: t.invoice_number,
      kasir: t.profiles?.full_name || t.profiles?.email || "Unknown",
      subtotal: Number(t.subtotal),
      pajak: Number(t.tax_amount),
      total: Number(t.total_amount),
      metode: t.payment_method,
      dibayar: Number(t.amount_paid),
      kembalian: Number(t.change_amount),
      tanggal: t.created_at,
      items: itemsByTxn[t.id] || [],
    }));

    return NextResponse.json({ data: result });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
