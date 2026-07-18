-- =====================================================
-- AISh POS — Supabase Storage Setup for Product Images
-- =====================================================
-- INSTRUKSI:
-- 1. Buka Supabase Dashboard → Storage → Create a new bucket
-- 2. Nama bucket: product-images
-- 3. Centang "Public bucket" agar gambar bisa diakses tanpa auth
-- 4. Lalu jalankan SQL di bawah ini di SQL Editor untuk policy upload
-- =====================================================

-- LANGKAH 1: Buat bucket (jika belum ada)
-- CATATAN: Buat bucket melalui Dashboard karena SQL storage API
-- memerlukan akses service_role. Buka:
-- Dashboard → Storage → New bucket → "product-images" → Public = ON

-- LANGKAH 2: Jalankan policy berikut di SQL Editor:

-- Policy: Public read access (semua orang bisa lihat gambar)
CREATE POLICY "Public read product images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- Policy: Authenticated users (admin) can upload images
CREATE POLICY "Admin upload product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin_inventory'
  )
);

-- Policy: Admin can update (overwrite) images
CREATE POLICY "Admin update product images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin_inventory'
  )
);

-- Policy: Admin can delete images
CREATE POLICY "Admin delete product images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin_inventory'
  )
);
