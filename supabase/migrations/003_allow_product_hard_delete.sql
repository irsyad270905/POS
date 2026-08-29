-- =====================================================
-- Migration: Allow hard delete of archived products
-- =====================================================
-- Produk yang sudah ada transaksi tetap bisa dihapus permanen
-- tanpa menghapus histori: product_id di transaction_items jadi NULL
-- tapi product_name tetap tersimpan (snapshot).

-- 1. Jadikan product_id nullable
ALTER TABLE transaction_items ALTER COLUMN product_id DROP NOT NULL;

-- 2. Ganti FK jadi ON DELETE SET NULL
ALTER TABLE transaction_items DROP CONSTRAINT IF EXISTS transaction_items_product_id_fkey;
ALTER TABLE transaction_items ADD CONSTRAINT transaction_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- 3. Policy: admin boleh update product_id jadi null saat hapus produk
DROP POLICY IF EXISTS "transaction_items_update_admin" ON transaction_items;
CREATE POLICY "transaction_items_update_admin" ON transaction_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_inventory'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_inventory'));

COMMENT ON COLUMN transaction_items.product_id IS 'NULL jika produk sudah dihapus permanen, product_name tetap simpan histori';
