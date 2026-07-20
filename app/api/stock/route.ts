import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST - Adjust stock via RPC
export async function POST(request: NextRequest) {
  try {
    const { createClient } = await import("@supabase/supabase-js");

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const body = await request.json();
    const { product_id, delta, keterangan } = body;

    if (!product_id || delta === undefined || delta === null) {
      return NextResponse.json(
        { message: "Field wajib: product_id, delta" },
        { status: 400 }
      );
    }

    if (isNaN(Number(delta))) {
      return NextResponse.json({ message: "Delta harus angka" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.rpc("adjust_stock", {
      p_product_id: product_id,
      p_delta: Number(delta),
      p_source: "whatsapp_bot",
      p_actor_identifier: "admin_wa",
      p_raw_message: keterangan || "",
    });

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        product_id: data.product_id,
        product_name: data.product_name,
        sku: data.sku,
        previous_stock: data.previous_stock,
        new_stock: data.new_stock,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
