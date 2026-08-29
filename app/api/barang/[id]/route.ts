import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase env belum dikonfigurasi di Vercel")
  return createClient(url, key, { auth: { persistSession: false } })
}

// GET - Detail barang
export async function GET(request: NextRequest, { params }: any) {
  try {
    const supabase = getSupabase()
    const { id } = await params;

    const { data, error } = await supabase
      .from("products")
      .select("*, categories(name)")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ message: "Barang tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        id: data.id,
        nama: data.name,
        sku: data.sku,
        barcode: data.barcode,
        harga: Number(data.price),
        stok: data.stock,
        satuan: data.unit || 'pcs',
        unit: data.unit || 'pcs',
        kategori: data.categories?.name || null,
        image_url: data.image_url,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

// PUT - Update barang
export async function PUT(request: NextRequest, { params }: any) {
  try {
    const supabase = getSupabase()
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, any> = {};

    if (body.nama !== undefined) updateData.name = body.nama;
    if (body.harga !== undefined) updateData.price = Number(body.harga);
    if (body.stok !== undefined) updateData.stock = Number(body.stok);
    if (body.barcode !== undefined) updateData.barcode = body.barcode;
    if (body.satuan !== undefined || body.unit !== undefined) {
      updateData.unit = (body.satuan || body.unit || 'pcs').toString().trim().toLowerCase();
    }

    if (body.kategori !== undefined) {
      if (body.kategori) {
        const { data: cat } = await supabase
          .from("categories")
          .select("id")
          .ilike("name", body.kategori)
          .maybeSingle();
        updateData.category_id = cat?.id || null;
      } else {
        updateData.category_id = null;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: "Tidak ada field yang diupdate" }, { status: 400 });
    }

    updateData.updated_at = new Date().toISOString();

    let { data, error } = await supabase
      .from("products")
      .update(updateData)
      .eq("id", id)
      .select("*, categories(name)")
      .single();

    if (error && (error.message.includes("'unit'") || error.message.includes("schema cache"))) {
      const { unit: _u, ...fallbackUpdateData } = updateData;
      const retry = await supabase
        .from("products")
        .update(fallbackUpdateData)
        .eq("id", id)
        .select("*, categories(name)")
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ message: "Barang tidak ditemukan" }, { status: 404 });
      }
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        id: data.id,
        nama: data.name,
        sku: data.sku,
        harga: Number(data.price),
        stok: data.stock,
        satuan: data.unit || 'pcs',
        unit: data.unit || 'pcs',
        kategori: data.categories?.name || null,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

// DELETE - Hapus barang
export async function DELETE(request: NextRequest, { params }: any) {
  try {
    const supabase = getSupabase()
    const { id } = await params;

    // Cek barang dulu
    const { data: product, error: findError } = await supabase
      .from("products")
      .select("id, image_url")
      .eq("id", id)
      .single();

    if (findError || !product) {
      return NextResponse.json({ message: "Barang tidak ditemukan" }, { status: 404 });
    }

    // Hapus image dari storage jika ada
    if (product.image_url) {
      const pathMatch = product.image_url.match(/product-images\/(.+)$/);
      if (pathMatch) {
        await supabase.storage.from("product-images").remove([pathMatch[1]]);
      }
    }

    // Hapus stock_adjustments (foreign key constraint)
    await supabase.from("stock_adjustments").delete().eq("product_id", id);

    // Set product_id ke NULL di transaction_items (product_name snapshot tetap tersimpan)
    await supabase.from("transaction_items").update({ product_id: null }).eq("product_id", id);

    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Barang berhasil dihapus" });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
