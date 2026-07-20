-- =====================================================
-- Migration: Chatbot Stock Update Feature
-- =====================================================

-- 1. Tabel audit log perubahan stok via bot
CREATE TABLE stock_adjustments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) NOT NULL,
  delta INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'chatbot',
  actor_identifier TEXT,
  raw_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_adjustments_select" ON stock_adjustments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_inventory'));
-- Tidak ada policy INSERT untuk role authenticated biasa — hanya lewat RPC (SECURITY DEFINER)
-- atau service role key dari backend bot.

-- 2. Whitelist pengirim yang boleh pakai bot
CREATE TABLE bot_authorized_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'telegram')),
  identifier TEXT NOT NULL,          -- nomor WA (format 62812xxxx) atau Telegram user id
  display_name TEXT,
  profile_id UUID REFERENCES profiles(id),
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(channel, identifier)
);

ALTER TABLE bot_authorized_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bot_authorized_users_select" ON bot_authorized_users FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_inventory'));
CREATE POLICY "bot_authorized_users_cud" ON bot_authorized_users FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_inventory'));

-- 3. State percakapan sementara (untuk alur konfirmasi & disambiguasi)
CREATE TABLE bot_pending_actions (
  identifier TEXT PRIMARY KEY,       -- channel:identifier, mis. "whatsapp:62812xxxx"
  action_type TEXT NOT NULL CHECK (action_type IN ('confirm_stock_update', 'disambiguate_product')),
  payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- Tabel ini diakses murni lewat service role key dari backend, RLS tidak perlu policy authenticated.
ALTER TABLE bot_pending_actions ENABLE ROW LEVEL SECURITY;

-- 4. RPC: adjust_stock — inti dari fitur ini
CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_product_id UUID,
  p_delta INTEGER,
  p_source TEXT DEFAULT 'chatbot',
  p_actor_identifier TEXT DEFAULT NULL,
  p_raw_message TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_product RECORD;
  v_new_stock INTEGER;
BEGIN
  SELECT * INTO v_product FROM products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produk tidak ditemukan';
  END IF;

  v_new_stock := v_product.stock + p_delta;
  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'Stok tidak boleh negatif (saat ini: %, perubahan: %)', v_product.stock, p_delta;
  END IF;

  UPDATE products SET stock = v_new_stock, updated_at = now() WHERE id = p_product_id;

  INSERT INTO stock_adjustments (product_id, delta, previous_stock, new_stock, source, actor_identifier, raw_message)
  VALUES (p_product_id, p_delta, v_product.stock, v_new_stock, p_source, p_actor_identifier, p_raw_message);

  RETURN jsonb_build_object(
    'product_id', v_product.id,
    'product_name', v_product.name,
    'sku', v_product.sku,
    'previous_stock', v_product.stock,
    'new_stock', v_new_stock
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Fungsi bantu untuk bersihkan pending actions kadaluarsa (jalankan via cron/pg_cron opsional)
CREATE OR REPLACE FUNCTION public.cleanup_expired_pending_actions()
RETURNS VOID AS $$
BEGIN
  DELETE FROM bot_pending_actions WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
