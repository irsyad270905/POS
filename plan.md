# Plan Implementasi: Chatbot Update Stok untuk AISh POS

> Fitur: Update stok produk via chat natural language (WhatsApp/Telegram), misal: **"lampu philips nambah 50 stok"**
> Stack: Next.js 16 + Supabase (Postgres) + Groq API (tool use)
> Target repo: `irsyad270905/POS`

---

## 0. Ringkasan Arsitektur

```
User kirim pesan WA/Telegram
        │
        ▼
Webhook Meta/Telegram → POST /api/bot/webhook
        │
        ▼
1. Verifikasi pengirim (bot_authorized_users)
2. Cek apakah ini balasan konfirmasi tertunda (bot_pending_actions)
        │
        ▼
3. Parsing pesan → Groq API (tool use) → {product_query, action, quantity}
        │
        ▼
4. Fuzzy match product_query ke tabel products (fuse.js)
        │
        ├─ 0 match  → balas "produk tidak ditemukan"
        ├─ >1 match → balas list pilihan, simpan ke bot_pending_actions, tunggu user pilih
        └─ 1 match  → tampilkan preview, simpan ke bot_pending_actions, tunggu "YA"
        │
        ▼
5. User balas "YA" → panggil RPC adjust_stock() (service role key)
        │
        ▼
6. Update products.stock + insert stock_adjustments (audit log)
        │
        ▼
7. Balas konfirmasi ke user + hapus bot_pending_actions
```

**Prinsip desain (mengikuti pola yang sudah ada di project ini, mis. `process_checkout`):**
- Semua mutasi stok lewat RPC `SECURITY DEFINER`, bukan query langsung dari Next.js.
- Validasi bisnis (stok tidak boleh negatif, produk harus ada) dijaga di level database.
- Setiap perubahan wajib ada audit log.
- Tidak ada eksekusi tanpa konfirmasi eksplisit dari user.

---

## 1. Fase 1 — Database (Supabase)

### 1.1 Buat migration baru
Jangan edit `supabase/schema.sql` langsung — buat file baru `supabase/migrations/001_chatbot_stock.sql` supaya history jelas dan bisa di-rollback.

```sql
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
```

### 1.2 Checklist Fase 1
- [ ] Jalankan migration di Supabase SQL Editor (staging dulu, baru production)
- [ ] Tambahkan minimal 1 baris ke `bot_authorized_users` untuk nomor testing Anda sendiri
- [ ] Test manual RPC lewat SQL editor: `SELECT adjust_stock('<product_id>', 10, 'manual_test', 'tester', 'test');`
- [ ] Verifikasi `stock_adjustments` dan `products.stock` ter-update dengan benar
- [ ] Cek RLS: pastikan role `kasir` (bukan admin) TIDAK bisa SELECT `stock_adjustments` langsung

---

## 2. Fase 2 — Setup Environment & Dependencies

### 2.1 Environment variables baru (`.env.local`)
```bash
# Sudah ada (pastikan tetap ada)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# BARU — jangan pernah expose ke client, hanya dipakai di API route server-side
SUPABASE_SERVICE_ROLE_KEY=...          # dari Supabase Dashboard > Settings > API
GROQ_API_KEY=...                       # dari console.groq.com

# Untuk WhatsApp Cloud API (Meta)
WHATSAPP_VERIFY_TOKEN=...              # token bebas yang Anda tentukan sendiri
WHATSAPP_ACCESS_TOKEN=...              # dari Meta for Developers
WHATSAPP_PHONE_NUMBER_ID=...
```

> **Penting**: `SUPABASE_SERVICE_ROLE_KEY` bypass semua RLS. Jangan pernah pakai di komponen client (`"use client"`), hanya di API route server-side. Tambahkan `.env.local` ke `.gitignore` (biasanya sudah otomatis di Next.js).

### 2.2 Install dependencies
```bash
npm install openai fuse.js
```

### 2.3 Checklist Fase 2
- [ ] Daftar akun Groq Console (console.groq.com), buat API key
- [ ] Daftar Meta for Developers → buat App → aktifkan WhatsApp product
- [ ] Catat `Phone Number ID` dan `Access Token` (temporary token dulu untuk testing, permanent token untuk production)
- [ ] Set semua env var di `.env.local` (lokal) DAN di dashboard Vercel/hosting (production)

---

## 3. Fase 3 — Struktur Kode Baru

Tambahan file yang perlu dibuat (tidak mengubah struktur lama):

```
app/
  api/
    bot/
      webhook/
        route.ts          ← entry point webhook WhatsApp
lib/
  bot/
    parser.ts             ← parsing pesan pakai Groq LLM (OpenAI-compatible)
    productMatch.ts         ← fuzzy matching produk
    supabaseAdmin.ts        ← Supabase client pakai service role key
    session.ts               ← helper baca/tulis bot_pending_actions
    whatsapp.ts              ← kirim pesan balasan via WhatsApp Cloud API
    types.ts                  ← TypeScript types untuk payload bot
```

### 3.1 `lib/bot/supabaseAdmin.ts`
```typescript
import { createClient } from "@supabase/supabase-js";

// Client khusus backend, bypass RLS. JANGAN import file ini di komponen client.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
```

### 3.2 `lib/bot/types.ts`
```typescript
export type StockAction = "tambah" | "kurang" | "set";

export interface ParsedStockCommand {
  product_query: string;
  action: StockAction;
  quantity: number;
}

export interface ProductMatch {
  id: string;
  name: string;
  sku: string;
  stock: number;
  score: number; // 0 = exact match, semakin besar semakin jauh (dari fuse.js)
}

export interface PendingConfirmPayload {
  type: "confirm_stock_update";
  product_id: string;
  product_name: string;
  action: StockAction;
  quantity: number;
  previous_stock: number;
  raw_message: string;
}

export interface PendingDisambiguatePayload {
  type: "disambiguate_product";
  candidates: ProductMatch[];
  action: StockAction;
  quantity: number;
  raw_message: string;
}
```

### 3.3 `lib/bot/parser.ts`
```typescript
import OpenAI from "openai";
import type { ParsedStockCommand } from "./types";

// Groq API — OpenAI-compatible, sangat cepat & murah
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const STOCK_TOOL: OpenAI.ChatCompletionTool = {
  type: "function",
  function: {
    name: "extract_stock_update",
    description:
      "Ekstrak informasi perubahan stok produk dari pesan bahasa natural (Bahasa Indonesia).",
    parameters: {
      type: "object",
      properties: {
        product_query: {
          type: "string",
          description: "Nama produk yang disebutkan user, apa adanya (jangan dikoreksi/dinormalisasi)",
        },
        action: {
          type: "string",
          enum: ["tambah", "kurang", "set"],
          description:
            "'tambah' jika stok bertambah (nambah, masuk, restock), 'kurang' jika berkurang (rusak, hilang, retur), 'set' jika user menyebutkan angka stok akhir (mis. 'stoknya jadi 50')",
        },
        quantity: {
          type: "number",
          description: "Jumlah angka yang disebutkan",
        },
      },
      required: ["product_query", "action", "quantity"],
    },
  },
};

export async function parseStockMessage(
  message: string
): Promise<ParsedStockCommand | null> {
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0,
    max_tokens: 300,
    messages: [
      {
        role: "system",
        content:
          "Kamu adalah parser untuk sistem POS. Ekstrak perintah update stok dari pesan user. " +
          "Jika pesan TIDAK berkaitan dengan update stok produk, JANGAN panggil tool apapun.",
      },
      { role: "user", content: message },
    ],
    tools: [STOCK_TOOL],
    tool_choice: "auto",
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall) return null;

  return JSON.parse(toolCall.function.arguments) as ParsedStockCommand;
}
```

### 3.4 `lib/bot/productMatch.ts`
```typescript
import Fuse from "fuse.js";
import { supabaseAdmin } from "./supabaseAdmin";
import type { ProductMatch } from "./types";

export async function findMatchingProducts(
  query: string,
  limit = 5
): Promise<ProductMatch[]> {
  // MVP: fetch semua produk. Kalau katalog > ~2000 item, ganti ke pg_trgm di Postgres.
  const { data: products, error } = await supabaseAdmin
    .from("products")
    .select("id, name, sku, stock");

  if (error || !products) return [];

  const fuse = new Fuse(products, {
    keys: ["name", "sku"],
    threshold: 0.4, // 0 = harus exact, 1 = sangat longgar
    includeScore: true,
  });

  return fuse
    .search(query)
    .slice(0, limit)
    .map((r) => ({
      id: r.item.id,
      name: r.item.name,
      sku: r.item.sku,
      stock: r.item.stock,
      score: r.score ?? 1,
    }));
}
```

### 3.5 `lib/bot/session.ts`
```typescript
import { supabaseAdmin } from "./supabaseAdmin";
import type { PendingConfirmPayload, PendingDisambiguatePayload } from "./types";

type PendingPayload = PendingConfirmPayload | PendingDisambiguatePayload;

export async function setPendingAction(identifier: string, payload: PendingPayload) {
  await supabaseAdmin.from("bot_pending_actions").upsert({
    identifier,
    action_type: payload.type,
    payload,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
}

export async function getPendingAction(identifier: string): Promise<PendingPayload | null> {
  const { data } = await supabaseAdmin
    .from("bot_pending_actions")
    .select("*")
    .eq("identifier", identifier)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  return data ? (data.payload as PendingPayload) : null;
}

export async function clearPendingAction(identifier: string) {
  await supabaseAdmin.from("bot_pending_actions").delete().eq("identifier", identifier);
}
```

### 3.6 `lib/bot/whatsapp.ts`
```typescript
export async function sendWhatsAppMessage(to: string, text: string) {
  const url = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
}
```

### 3.7 `app/api/bot/webhook/route.ts`
```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/bot/supabaseAdmin";
import { parseStockMessage } from "@/lib/bot/parser";
import { findMatchingProducts } from "@/lib/bot/productMatch";
import { getPendingAction, setPendingAction, clearPendingAction } from "@/lib/bot/session";
import { sendWhatsAppMessage } from "@/lib/bot/whatsapp";
import type { PendingConfirmPayload, PendingDisambiguatePayload } from "@/lib/bot/types";

// --- Verifikasi webhook (dipanggil Meta sekali saat setup) ---
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// --- Terima pesan masuk ---
export async function POST(req: NextRequest) {
  const body = await req.json();

  const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message || message.type !== "text") {
    return NextResponse.json({ ok: true }); // abaikan event non-text (status, dsb)
  }

  const from = message.from as string; // nomor pengirim
  const text = (message.text.body as string).trim();
  const identifier = `whatsapp:${from}`;

  // 1. Verifikasi whitelist
  const { data: authUser } = await supabaseAdmin
    .from("bot_authorized_users")
    .select("*")
    .eq("channel", "whatsapp")
    .eq("identifier", from)
    .eq("active", true)
    .maybeSingle();

  if (!authUser) {
    await sendWhatsAppMessage(from, "Maaf, nomor Anda belum terdaftar untuk mengakses bot ini.");
    return NextResponse.json({ ok: true });
  }

  // 2. Cek apakah ada pending action (menunggu konfirmasi/disambiguasi)
  const pending = await getPendingAction(identifier);
  if (pending) {
    await handlePendingResponse(identifier, from, text, pending);
    return NextResponse.json({ ok: true });
  }

  // 3. Parsing pesan baru
  const parsed = await parseStockMessage(text);
  if (!parsed) {
    await sendWhatsAppMessage(
      from,
      "Maaf, saya tidak paham maksud pesan Anda. Contoh: 'lampu philips nambah 50 stok'"
    );
    return NextResponse.json({ ok: true });
  }

  // 4. Fuzzy match produk
  const matches = await findMatchingProducts(parsed.product_query);

  if (matches.length === 0) {
    await sendWhatsAppMessage(from, `Produk "${parsed.product_query}" tidak ditemukan.`);
    return NextResponse.json({ ok: true });
  }

  if (matches.length > 1 && matches[0].score > 0.05) {
    // ambigu → minta user pilih
    const payload: PendingDisambiguatePayload = {
      type: "disambiguate_product",
      candidates: matches,
      action: parsed.action,
      quantity: parsed.quantity,
      raw_message: text,
    };
    await setPendingAction(identifier, payload);

    const list = matches
      .map((m, i) => `${i + 1}. ${m.name} (stok: ${m.stock})`)
      .join("\n");
    await sendWhatsAppMessage(from, `Produk mana yang dimaksud?\n${list}\n\nBalas dengan nomor.`);
    return NextResponse.json({ ok: true });
  }

  // 5. Match tunggal jelas → minta konfirmasi
  const product = matches[0];
  await presentConfirmation(identifier, from, product, parsed, text);

  return NextResponse.json({ ok: true });
}

async function presentConfirmation(
  identifier: string,
  from: string,
  product: { id: string; name: string; stock: number },
  parsed: { action: string; quantity: number },
  rawMessage: string
) {
  const payload: PendingConfirmPayload = {
    type: "confirm_stock_update",
    product_id: product.id,
    product_name: product.name,
    action: parsed.action as any,
    quantity: parsed.quantity,
    previous_stock: product.stock,
    raw_message: rawMessage,
  };
  await setPendingAction(identifier, payload);

  const newStock =
    parsed.action === "tambah"
      ? product.stock + parsed.quantity
      : parsed.action === "kurang"
      ? product.stock - parsed.quantity
      : parsed.quantity;

  await sendWhatsAppMessage(
    from,
    `Update stok *${product.name}*\n${product.stock} → ${newStock}\n\nBalas *YA* untuk konfirmasi atau *BATAL* untuk membatalkan.`
  );
}

async function handlePendingResponse(
  identifier: string,
  from: string,
  text: string,
  pending: PendingConfirmPayload | PendingDisambiguatePayload
) {
  const normalized = text.trim().toLowerCase();

  if (pending.type === "disambiguate_product") {
    const idx = parseInt(normalized) - 1;
    const chosen = pending.candidates[idx];
    if (!chosen) {
      await sendWhatsAppMessage(from, "Nomor tidak valid. Silakan balas dengan nomor dari daftar.");
      return;
    }
    await clearPendingAction(identifier);
    await presentConfirmation(
      identifier,
      from,
      chosen,
      { action: pending.action, quantity: pending.quantity },
      pending.raw_message
    );
    return;
  }

  // type === "confirm_stock_update"
  if (normalized === "batal") {
    await clearPendingAction(identifier);
    await sendWhatsAppMessage(from, "Dibatalkan.");
    return;
  }

  if (normalized !== "ya") {
    await sendWhatsAppMessage(from, "Balas *YA* untuk konfirmasi atau *BATAL* untuk membatalkan.");
    return;
  }

  const delta =
    pending.action === "tambah"
      ? pending.quantity
      : pending.action === "kurang"
      ? -pending.quantity
      : pending.quantity - pending.previous_stock; // untuk 'set'

  const { data, error } = await supabaseAdmin.rpc("adjust_stock", {
    p_product_id: pending.product_id,
    p_delta: delta,
    p_source: "whatsapp_bot",
    p_actor_identifier: from,
    p_raw_message: pending.raw_message,
  });

  await clearPendingAction(identifier);

  if (error) {
    await sendWhatsAppMessage(from, `Gagal update stok: ${error.message}`);
    return;
  }

  await sendWhatsAppMessage(
    from,
    `✅ Stok *${data.product_name}* berhasil diupdate: ${data.previous_stock} → ${data.new_stock}`
  );
}
```

### 3.8 Checklist Fase 3
- [ ] Buat semua file di atas sesuai struktur folder
- [ ] Pastikan `tsconfig.json` sudah punya path alias `@/*` (biasanya default di Next.js — cek `paths` di `tsconfig.json`)
- [ ] `npm run build` harus sukses tanpa error TypeScript

---

## 4. Fase 4 — Setup WhatsApp Cloud API

1. Buat App di [Meta for Developers](https://developers.facebook.com) → tipe **Business**
2. Tambahkan produk **WhatsApp**
3. Di halaman WhatsApp > API Setup, catat:
   - `Phone Number ID`
   - `Temporary Access Token` (untuk testing, berlaku 24 jam — nanti generate permanent token via System User untuk production)
4. Set Webhook:
   - Callback URL: `https://<domain-anda>/api/bot/webhook`
   - Verify Token: samakan dengan `WHATSAPP_VERIFY_TOKEN` di `.env.local`
   - Subscribe ke field **messages**
5. Tambahkan nomor testing Anda di **To** (WhatsApp API hanya bisa kirim ke nomor terdaftar selama masih mode development)

### Checklist Fase 4
- [ ] Webhook berhasil diverifikasi (Meta akan hit endpoint GET, harus balas challenge)
- [ ] Kirim pesan test dari WA ke nomor test business, cek log Next.js apakah payload masuk

---

## 5. Fase 5 — Testing

### 5.1 Test skenario manual (checklist end-to-end)
- [ ] Pesan dari nomor **tidak terdaftar** → bot tolak dengan sopan
- [ ] Pesan jelas: `"lampu philips nambah 50 stok"` → muncul preview, balas `YA` → stok bertambah, cek di dashboard admin produk
- [ ] Pesan dengan produk ambigu (2+ produk mirip nama) → muncul list pilihan, balas nomor → lanjut ke konfirmasi
- [ ] Balas `BATAL` saat konfirmasi → tidak ada perubahan stok
- [ ] Pesan `"stok lampu philips jadi 100"` (action = set) → hitung delta dengan benar
- [ ] Pesan yang tidak berkaitan stok (mis. "halo") → bot balas tidak paham, tidak crash
- [ ] Coba kurangi stok sampai negatif → RPC harus reject dengan pesan error yang jelas
- [ ] Cek tabel `stock_adjustments` — setiap transaksi tercatat dengan `raw_message` dan `actor_identifier` yang benar
- [ ] Cek dashboard admin (`/admin/products`) — stok yang berubah lewat bot ter-refresh dan konsisten

### 5.2 Unit test opsional (kalau mau lebih rapi)
- Test `productMatch.ts` dengan berbagai variasi typo nama produk
- Test parsing Groq LLM dengan berbagai variasi kalimat: "nambah", "masuk 50 pcs", "restock 50", "stoknya jadi 100"

---

## 6. Fase 6 — Deployment

- [ ] Set semua environment variable di dashboard hosting (Vercel/lainnya): `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `WHATSAPP_*`
- [ ] Pastikan `SUPABASE_SERVICE_ROLE_KEY` **tidak pernah** ter-commit ke git (cek `.gitignore` sudah cover `.env.local`)
- [ ] Update Webhook URL di Meta App ke domain production
- [ ] Ajukan App Review ke Meta jika ingin kirim pesan ke nomor customer di luar whitelist testing (untuk internal tool biasanya cukup mode development + whitelist manual)
- [ ] (Opsional) Setup `pg_cron` di Supabase untuk jalankan `cleanup_expired_pending_actions()` setiap jam

---

## 7. Fase 7 — Perbaikan Lanjutan (Opsional, Setelah MVP Jalan)

Prioritas rendah, kerjakan setelah alur dasar terbukti stabil:

- [ ] **Halaman admin untuk kelola `bot_authorized_users`** — sekarang tambah lewat SQL editor manual, nanti bisa lewat UI di `/admin`
- [ ] **Halaman log `stock_adjustments`** di dashboard admin — supaya bisa audit history perubahan stok dari bot vs manual
- [ ] **Rate limiting** di webhook — cegah spam/abuse (mis. pakai Upstash Redis)
- [ ] **Ganti fuzzy match ke `pg_trgm`** kalau katalog produk sudah > 1000–2000 item (fuse.js fetch semua row tiap request akan mulai lambat)
- [ ] **Support Telegram** sebagai channel kedua (arsitektur di atas sudah didesain multi-channel lewat kolom `channel`)
- [ ] **Voice note support** — WhatsApp bisa kirim voice note, bisa ditranskrip pakai Groq Whisper (`whisper-large-v3`) sebelum diparse LLM
- [ ] **Bulk update** — "lampu philips nambah 50, kabel nambah 20" dalam satu pesan (butuh ubah tool schema jadi array)

---

## 8. Ringkasan File yang Perlu Dibuat/Diubah

| File | Status |
|---|---|
| `supabase/migrations/001_chatbot_stock.sql` | Baru |
| `.env.local` | Ubah (tambah var baru) |
| `package.json` | Ubah (tambah `openai`, `fuse.js`) |
| `lib/bot/supabaseAdmin.ts` | Baru |
| `lib/bot/types.ts` | Baru |
| `lib/bot/parser.ts` | Baru |
| `lib/bot/productMatch.ts` | Baru |
| `lib/bot/session.ts` | Baru |
| `lib/bot/whatsapp.ts` | Baru |
| `app/api/bot/webhook/route.ts` | Baru |

Tidak ada file lama yang perlu diubah — fitur ini murni additive, tidak menyentuh flow kasir/checkout yang sudah ada.
