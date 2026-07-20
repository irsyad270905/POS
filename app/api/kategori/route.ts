import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// GET - List kategori + jumlah produk
export async function GET() {
  try {

    const { data, error } = await supabase
      .from("categories")
      .select("id, name, created_at, products(count)")
      .order("name");

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    const result = (data || []).map((c) => ({
      id: c.id,
      nama: c.name,
      jumlah_produk: (c.products as any)?.count || 0,
    }));

    return NextResponse.json({ data: result });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

// POST - Tambah kategori
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nama } = body;

    if (!nama || !nama.trim()) {
      return NextResponse.json({ message: "Nama kategori wajib diisi" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("categories")
      .insert({ name: nama.trim() })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ message: "Kategori sudah ada" }, { status: 409 });
      }
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { data: { id: data.id, nama: data.name } },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
