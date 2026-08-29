-- =====================================================
-- Migration: Add unit (satuan) column to products table
-- =====================================================
-- Menambahkan kolom unit (satuan) untuk produk (pcs, kg, liter, dus, pack, dll.)
-- Terpisah dari kategori produk.

ALTER TABLE products ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'pcs';

COMMENT ON COLUMN products.unit IS 'Satuan produk: pcs, kg, gram, liter, ml, dus, pack, botol, porsi, lusin, dll.';
