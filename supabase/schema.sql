-- =====================================================
-- AISh POS — Complete Database Schema (v2.0)
-- =====================================================
-- INSTRUCTIONS: Copy this ENTIRE file and run it in your
-- Supabase SQL Editor (https://supabase.com/dashboard)
-- If you already ran the old schema, run the DROP section first.
-- =====================================================

-- =====================
-- DROP OLD TABLES (if upgrading)
-- =====================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.process_checkout(json);
DROP FUNCTION IF EXISTS public.generate_invoice_number();
DROP TABLE IF EXISTS transaction_items CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- =====================
-- 1. PROFILES
-- =====================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('kasir', 'admin_inventory')),
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =====================
-- 2. CATEGORIES
-- =====================
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Seed default categories
INSERT INTO categories (name) VALUES ('Makanan'), ('Minuman'), ('Snack'), ('Lainnya');

-- =====================
-- 3. PRODUCTS
-- =====================
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  barcode TEXT UNIQUE,
  price NUMERIC NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =====================
-- 4. TRANSACTIONS
-- =====================
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  cashier_id UUID REFERENCES profiles(id) NOT NULL,
  subtotal NUMERIC NOT NULL CHECK (subtotal >= 0),
  tax_amount NUMERIC NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount NUMERIC NOT NULL CHECK (total_amount >= 0),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'qris', 'transfer')),
  amount_paid NUMERIC NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  change_amount NUMERIC NOT NULL DEFAULT 0 CHECK (change_amount >= 0),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =====================
-- 5. TRANSACTION ITEMS
-- =====================
CREATE TABLE transaction_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  product_name TEXT NOT NULL, -- snapshot so it persists even if product is deleted
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_at_time NUMERIC NOT NULL CHECK (price_at_time >= 0)
);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Categories: everyone can read, only admin can CUD
CREATE POLICY "categories_select" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories_insert" ON categories FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_inventory'));
CREATE POLICY "categories_update" ON categories FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_inventory'));
CREATE POLICY "categories_delete" ON categories FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_inventory'));

-- Products: everyone can read, only admin can CUD (kasir updates stock ONLY via RPC)
CREATE POLICY "products_select" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_insert" ON products FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_inventory'));
CREATE POLICY "products_update" ON products FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_inventory'));
CREATE POLICY "products_delete" ON products FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_inventory'));

-- Transactions: authenticated users can read all, only RPC inserts
CREATE POLICY "transactions_select" ON transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "transactions_insert" ON transactions FOR INSERT TO authenticated WITH CHECK (true);

-- Transaction Items: authenticated users can read all, only RPC inserts
CREATE POLICY "transaction_items_select" ON transaction_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "transaction_items_insert" ON transaction_items FOR INSERT TO authenticated WITH CHECK (true);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'kasir'),
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Generate invoice number: INV-YYYYMMDD-XXXX
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  today_str TEXT;
  seq INTEGER;
BEGIN
  today_str := to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYYMMDD');
  SELECT COUNT(*) + 1 INTO seq
    FROM transactions
    WHERE invoice_number LIKE 'INV-' || today_str || '-%';
  RETURN 'INV-' || today_str || '-' || LPAD(seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ATOMIC CHECKOUT RPC
-- This function handles the entire checkout in ONE transaction.
-- If any step fails (e.g. insufficient stock), EVERYTHING rolls back.
-- =====================================================
CREATE OR REPLACE FUNCTION public.process_checkout(
  p_items JSONB,           -- array of {product_id, quantity}
  p_payment_method TEXT,   -- 'cash', 'qris', 'transfer'
  p_amount_paid NUMERIC    -- amount customer paid
)
RETURNS JSONB AS $$
DECLARE
  v_cashier_id UUID;
  v_subtotal NUMERIC := 0;
  v_tax NUMERIC := 0;
  v_total NUMERIC := 0;
  v_change NUMERIC := 0;
  v_invoice TEXT;
  v_txn_id UUID;
  v_item JSONB;
  v_product RECORD;
BEGIN
  -- Get the current user
  v_cashier_id := auth.uid();
  IF v_cashier_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify user is a cashier
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_cashier_id AND role = 'kasir') THEN
    RAISE EXCEPTION 'Only cashiers can process transactions';
  END IF;

  -- Calculate totals and verify stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_product FROM products WHERE id = (v_item->>'product_id')::UUID FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', v_item->>'product_id';
    END IF;

    IF v_product.stock < (v_item->>'quantity')::INTEGER THEN
      RAISE EXCEPTION 'Insufficient stock for %: available %, requested %',
        v_product.name, v_product.stock, (v_item->>'quantity')::INTEGER;
    END IF;

    v_subtotal := v_subtotal + (v_product.price * (v_item->>'quantity')::INTEGER);
  END LOOP;

  -- Calculate tax and total
  v_tax := ROUND(v_subtotal * 0.11, 0);
  v_total := v_subtotal + v_tax;
  v_change := p_amount_paid - v_total;

  IF v_change < 0 THEN
    RAISE EXCEPTION 'Insufficient payment: total %, paid %', v_total, p_amount_paid;
  END IF;

  -- Generate invoice
  v_invoice := public.generate_invoice_number();

  -- Insert transaction
  INSERT INTO transactions (invoice_number, cashier_id, subtotal, tax_amount, total_amount, payment_method, amount_paid, change_amount)
  VALUES (v_invoice, v_cashier_id, v_subtotal, v_tax, v_total, p_payment_method, p_amount_paid, v_change)
  RETURNING id INTO v_txn_id;

  -- Insert items and update stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_product FROM products WHERE id = (v_item->>'product_id')::UUID;

    INSERT INTO transaction_items (transaction_id, product_id, product_name, quantity, price_at_time)
    VALUES (v_txn_id, v_product.id, v_product.name, (v_item->>'quantity')::INTEGER, v_product.price);

    UPDATE products SET stock = stock - (v_item->>'quantity')::INTEGER, updated_at = now()
    WHERE id = v_product.id;
  END LOOP;

  RETURN jsonb_build_object(
    'transaction_id', v_txn_id,
    'invoice_number', v_invoice,
    'subtotal', v_subtotal,
    'tax_amount', v_tax,
    'total_amount', v_total,
    'payment_method', p_payment_method,
    'amount_paid', p_amount_paid,
    'change_amount', v_change,
    'created_at', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
