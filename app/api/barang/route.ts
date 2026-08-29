import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// GET - List barang + search
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");

  try {
    let query = supabase
      .from("products")
      .select("*, categories(name)")
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    const result = (data || []).map((p) => ({
      id: p.id,
      nama: p.name,
      sku: p.sku,
      barcode: p.barcode,
      harga: Number(p.price),
      stok: p.stock,
      satuan: p.unit || 'pcs',
      unit: p.unit || 'pcs',
      kategori: p.categories?.name || null,
      image_url: p.image_url,
      created_at: p.created_at,
    }));

    return NextResponse.json({ data: result });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

// POST - Tambah barang baru
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nama, harga, stok, kategori } = body;

    if (!nama || harga === undefined || harga === null || stok === undefined || stok === null) {
      return NextResponse.json(
        { message: "Field wajib: nama, harga, stok" },
        { status: 400 }
      );
    }

    if (isNaN(Number(harga)) || Number(harga) < 0) {
      return NextResponse.json(
        { message: "Harga harus angka positif" },
        { status: 400 }
      );
    }

    if (isNaN(Number(stok)) || Number(stok) < 0) {
      return NextResponse.json(
        { message: "Stok harus angka positif" },
        { status: 400 }
      );
    }

    // Cek duplikat berdasarkan nama (case-insensitive)
    const { data: existing } = await supabase
      .from("products")
      .select("id, name, stock, sku, price, categories(name)")
      .ilike("name", nama.trim())
      .maybeSingle();

    if (existing) {
      const newStock = existing.stock + Number(stok);
      const { data: updated, error: updateErr } = await supabase
        .from("products")
        .update({ stock: newStock, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select("*, categories(name)")
        .single();

      if (updateErr) {
        return NextResponse.json({ message: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({
        message: `Stok "${existing.name}" ditambah: ${existing.stock} → ${newStock}`,
        data: {
          id: updated.id,
          nama: updated.name,
          sku: updated.sku,
          harga: Number(updated.price),
          stok: updated.stock,
          kategori: updated.categories?.name || null,
          updated: true,
        },
      }, { status: 200 });
    }

    // Auto-generate SKU
    const firstWord = nama.trim().split(/\s+/)[0].toLowerCase();
    const consonants = firstWord.replace(/[aiueo]/g, "").toUpperCase().slice(0, 3).padEnd(3, "X");
    const { count } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true });
    const seq = ((count ?? 0) + 1).toString().padStart(2, "0");
    const sku = `${consonants}-${seq}`;

    // Lookup atau auto-create category
    let categoryId: string | null = null;
    if (kategori) {
      let { data: cat } = await supabase
        .from("categories")
        .select("id")
        .ilike("name", kategori.trim())
        .maybeSingle();

      if (!cat) {
        const { data: newCat } = await supabase
          .from("categories")
          .insert({ name: kategori.trim() })
          .select("id")
          .single();
        cat = newCat;
      }

      if (cat) {
        categoryId = cat.id;
      }
    }

    const unit = body.satuan || body.unit || 'pcs';

    let insertData: Record<string, any> = {
      name: nama,
      sku,
      price: Number(harga),
      stock: Number(stok),
      unit: unit.trim().toLowerCase(),
      category_id: categoryId,
    };

    let { data, error } = await supabase
      .from("products")
      .insert(insertData)
      .select("*, categories(name)")
      .single();

    if (error && (error.message.includes("'unit'") || error.message.includes("schema cache"))) {
      const { unit: _u, ...fallbackData } = insertData;
      const retry = await supabase
        .from("products")
        .insert(fallbackData)
        .select("*, categories(name)")
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        data: {
          id: data.id,
          nama: data.name,
          sku: data.sku,
          harga: Number(data.price),
          stok: data.stock,
          satuan: data.unit || 'pcs',
          unit: data.unit || 'pcs',
          kategori: data.categories?.name || kategori || null,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
