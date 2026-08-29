-- =====================================================
-- Migration: AI Rekomendasi Restock (SRS 2.x)
-- =====================================================
-- Menambahkan kolom & tabel untuk fitur restock AI sesuai srs.md
-- Jalankan di Supabase SQL Editor

-- 1. Perluas tabel products (srs.md 2.4)
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_minimum INTEGER DEFAULT 10 NOT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS target_stock INTEGER DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 3 NOT NULL CHECK (lead_time_days >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS safety_stock_days INTEGER DEFAULT 2 NOT NULL CHECK (safety_stock_days >= 0);

COMMENT ON COLUMN products.stock_minimum IS 'Stok minimum sebelum trigger restock (srs.md 2.4)';
COMMENT ON COLUMN products.target_stock IS 'Stok target setelah restock, NULL = auto hitung avg*coverage + safety';
COMMENT ON COLUMN products.lead_time_days IS 'Lead time pemasok dalam hari (srs.md 2.4)';
COMMENT ON COLUMN products.safety_stock_days IS 'Hari safety stock untuk buffer';

-- 2. Suppliers (srs.md 2.4)
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  lead_time_days INTEGER DEFAULT 3 NOT NULL CHECK (lead_time_days >= 0),
  contact TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS product_suppliers (
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE NOT NULL,
  is_primary BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (product_id, supplier_id)
);

INSERT INTO suppliers (name, lead_time_days, contact)
VALUES ('Supplier Umum', 3, '-') ON CONFLICT (name) DO NOTHING;

-- 3. Settings global (periode analisis, target coverage)
CREATE TABLE IF NOT EXISTS restock_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  analysis_period_days INTEGER DEFAULT 30 NOT NULL CHECK (analysis_period_days > 0),
  analysis_short_days INTEGER DEFAULT 7 NOT NULL CHECK (analysis_short_days > 0),
  safety_days INTEGER DEFAULT 2 NOT NULL CHECK (safety_days >= 0),
  coverage_days INTEGER DEFAULT 14 NOT NULL CHECK (coverage_days > 0),
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

INSERT INTO restock_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 4. Rekomendasi history (FR-RESTOCK-12, NFR-RESTOCK-03)
CREATE TABLE IF NOT EXISTS restock_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID DEFAULT gen_random_uuid() NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  stock_current INTEGER NOT NULL,
  stock_minimum INTEGER NOT NULL,
  avg_daily_7 NUMERIC NOT NULL DEFAULT 0,
  avg_daily_30 NUMERIC NOT NULL DEFAULT 0,
  avg_daily NUMERIC NOT NULL DEFAULT 0,
  sold_7 INTEGER NOT NULL DEFAULT 0,
  sold_30 INTEGER NOT NULL DEFAULT 0,
  lead_time_days INTEGER NOT NULL DEFAULT 3,
  safety_stock INTEGER NOT NULL DEFAULT 0,
  reorder_point INTEGER NOT NULL DEFAULT 0,
  target_stock INTEGER NOT NULL DEFAULT 0,
  days_until_out NUMERIC,
  recommended_qty INTEGER NOT NULL DEFAULT 0,
  priority TEXT NOT NULL CHECK (priority IN ('tinggi','sedang','rendah','tidak_perlu')),
  reason TEXT NOT NULL,
  insight TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','dismissed')),
  dismissed_at TIMESTAMPTZ,
  approved_qty INTEGER,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_restock_recs_product ON restock_recommendations(product_id);
CREATE INDEX IF NOT EXISTS idx_restock_recs_batch ON restock_recommendations(batch_id);
CREATE INDEX IF NOT EXISTS idx_restock_recs_priority ON restock_recommendations(priority);
CREATE INDEX IF NOT EXISTS idx_restock_recs_generated ON restock_recommendations(generated_at DESC);

-- 5. Draft pembelian (FR-RESTOCK-11, srs.md 2.13)
CREATE TABLE IF NOT EXISTS restock_drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  batch_id UUID,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ordered','cancelled')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS restock_draft_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID REFERENCES restock_drafts(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  product_name TEXT NOT NULL,
  sku TEXT,
  price_at_time NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_restock_drafts_status ON restock_drafts(status);
CREATE INDEX IF NOT EXISTS idx_restock_draft_items_draft ON restock_draft_items(draft_id);

-- 6. RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE restock_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE restock_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE restock_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE restock_draft_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_select" ON suppliers;
CREATE POLICY "suppliers_select" ON suppliers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "suppliers_cud_admin" ON suppliers;
CREATE POLICY "suppliers_cud_admin" ON suppliers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_inventory'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_inventory'));

DROP POLICY IF EXISTS "product_suppliers_select" ON product_suppliers;
CREATE POLICY "product_suppliers_select" ON product_suppliers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "product_suppliers_cud_admin" ON product_suppliers;
CREATE POLICY "product_suppliers_cud_admin" ON product_suppliers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_inventory'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_inventory'));

DROP POLICY IF EXISTS "restock_settings_select" ON restock_settings;
CREATE POLICY "restock_settings_select" ON restock_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "restock_settings_update_admin" ON restock_settings;
CREATE POLICY "restock_settings_update_admin" ON restock_settings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_inventory'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_inventory'));

DROP POLICY IF EXISTS "restock_recs_select" ON restock_recommendations;
CREATE POLICY "restock_recs_select" ON restock_recommendations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_inventory'));
DROP POLICY IF EXISTS "restock_recs_update_admin" ON restock_recommendations;
CREATE POLICY "restock_recs_update_admin" ON restock_recommendations FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_inventory'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_inventory'));
-- INSERT hanya via service_role (AI service), tidak ada policy INSERT untuk authenticated

DROP POLICY IF EXISTS "restock_drafts_select" ON restock_drafts;
CREATE POLICY "restock_drafts_select" ON restock_drafts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_inventory'));
DROP POLICY IF EXISTS "restock_drafts_cud_admin" ON restock_drafts;
CREATE POLICY "restock_drafts_cud_admin" ON restock_drafts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_inventory'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_inventory'));

DROP POLICY IF EXISTS "restock_draft_items_select" ON restock_draft_items;
CREATE POLICY "restock_draft_items_select" ON restock_draft_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_inventory'));
DROP POLICY IF EXISTS "restock_draft_items_cud_admin" ON restock_draft_items;
CREATE POLICY "restock_draft_items_cud_admin" ON restock_draft_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_inventory'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_inventory'));

-- 7. Helper function untuk cron cleanup (opsional)
CREATE OR REPLACE FUNCTION public.cleanup_old_restock_recommendations(p_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE v_deleted INTEGER;
BEGIN
  DELETE FROM restock_recommendations WHERE generated_at < now() - (p_days || ' days')::interval;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
