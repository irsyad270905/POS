-- =====================================================
-- Migration: Produk Arsip (nonaktif sementara)
-- =====================================================
-- Arsip = dinonaktifkan sementara, tidak muncul di Kasir tapi tetap di histori transaksi.
-- Solusi untuk error: update or delete on table "products" violates foreign key constraint

ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- Optional: pastikan produk arsip tidak ikut hitungan stok rendah di kasir, tapi admin masih lihat
-- Tidak mengubah FK transaction_items.product_id -> tetap NOT NULL agar histori aman

COMMENT ON COLUMN products.is_active IS 'false = diarsipkan/dinonaktifkan sementara, tidak tampil di Kasir tapi tetap ada di laporan';
COMMENT ON COLUMN products.archived_at IS 'Waktu diarsipkan';
