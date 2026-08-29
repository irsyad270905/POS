import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase env belum dikonfigurasi di Vercel")
  return createClient(url, key, { auth: { persistSession: false } })
}

// GET - Ringkasan transaksi hari ini
export async function GET() {
  try {
    const supabase = getSupabase()

    // Tanggal hari ini di Asia/Jakarta
    const now = new Date();
    const jakartaOffset = 7 * 60 * 60 * 1000;
    const jakartaDate = new Date(now.getTime() + jakartaOffset);
    const today = jakartaDate.toISOString().slice(0, 10);

    const startDate = `${today}T00:00:00+07:00`;
    const endDate = `${today}T23:59:59+07:00`;

    const { data: txns, error } = await supabase
      .from("transactions")
      .select("total_amount")
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    const totalRevenue = (txns || []).reduce(
      (sum, t) => sum + Number(t.total_amount),
      0
    );
    const count = (txns || []).length;
    const average = count > 0 ? totalRevenue / count : 0;

    return NextResponse.json({
      data: {
        tanggal: today,
        total_transaksi: count,
        total_pendapatan: totalRevenue,
        rata_rata: Math.round(average * 100) / 100,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
