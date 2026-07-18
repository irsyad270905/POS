# AISh POS — Security Improvement Plan

> **Priority Legend:** 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low
> **Effort:**  S M L XL

---

## 🔴 CRITICAL — Fix Immediately

### #1 `delete_transaction` RPC — Missing Authorization

| Field | Detail |
|-------|--------|
| **File** | `supabase/schema.sql` (line 260–276) |
| **Issue** | The function is `SECURITY DEFINER` (runs as DB owner) but never checks the caller's role. Any authenticated user can delete any transaction. |
| **Root Cause** | No `auth.uid()` / role verification before allowing deletion. |
| **Risk** | Kasir (or any authenticated user) can call `supabase.rpc('delete_transaction', ...)` from browser console and delete arbitrary transactions. |
| **Effort** | S |

**Action Items:**

- [ ] Add role check at the top of `delete_transaction`:
  ```sql
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin_inventory'
  ) THEN
    RAISE EXCEPTION 'Only admin_inventory can delete transactions';
  END IF;
  ```
- [ ] Re-run the updated function in Supabase SQL Editor.

---

### #2 Remove Direct `INSERT` Policies on `transactions` & `transaction_items`

| Field | Detail |
|-------|--------|
| **File** | `supabase/schema.sql` (lines 122, 126) |
| **Issue** | `transactions_insert` and `transaction_items_insert` allow `INSERT` for any authenticated user, bypassing `process_checkout`. |
| **Root Cause** | Policies use `WITH CHECK (true)` — no restrictions. |
| **Risk** | Users can insert fake transactions with arbitrary amounts, bypass stock deductions, and forge payment records. |
| **Effort** | S |

**Action Items:**

- [ ] Delete both INSERT policies:
  ```sql
  DROP POLICY IF EXISTS "transactions_insert" ON transactions;
  DROP POLICY IF EXISTS "transaction_items_insert" ON transaction_items;
  ```
- [ ] Only `process_checkout` (SECURITY DEFINER) should write to these tables.
- [ ] Re-run SQL in Supabase SQL Editor.

---

## 🟠 HIGH — Fix Soon

### #3 Restrict `transactions_select` Policy by Role

| Field | Detail |
|-------|--------|
| **File** | `supabase/schema.sql` (line 121) |
| **Issue** | All authenticated users can `SELECT` all transactions — kasir can see other cashiers' data. |
| **Root Cause** | Policy uses `USING (true)`. |
| **Risk** | Data leakage between cashiers (e.g., a kasir can enumerate all transactions via browser console). |
| **Effort** | S |

**Action Items:**

- [ ] Replace existing policy with role-aware policy:
  ```sql
  DROP POLICY IF EXISTS "transactions_select" ON transactions;
  CREATE POLICY "transactions_select" ON transactions FOR SELECT TO authenticated
  USING (
    cashier_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_inventory'
    )
  );
  ```
- [ ] Re-run SQL in Supabase SQL Editor.

---

### #4 Server-Side Image Validation

| Field | Detail |
|-------|--------|
| **File** | `app/(dashboard)/admin/products/page.tsx` (lines 94–108) |
| **Issue** | File type/size validation is client-only. A malicious admin can bypass via `supabase.storage.from('product-images').upload(...)` directly. |
| **Root Cause** | No server-side MIME/size validation. |
| **Risk** | Arbitrary file upload (malware, phishing content) to Supabase Storage. |
| **Effort** | M |

**Action Items:**

- [ ] Option A: Add a Supabase Storage `BEFORE INSERT` trigger to validate MIME type and size.
- [ ] Option B (recommended): Create a Next.js API route (`/api/upload-image`) that:
  - Validates authentication and admin role server-side
  - Validates file MIME type (`image/png`, `image/jpeg`, `image/webp`)
  - Validates file size (≤ 5MB)
  - Uploads to Supabase Storage
  - Returns the public URL
- [ ] Refactor client code to call the API route instead of uploading directly.

---

## 🟡 MEDIUM — Plan for Next Sprint

### #5 Rate Limiting

| Field | Detail |
|-------|--------|
| **Files** | `app/login/page.tsx` (line 24), `app/(dashboard)/kasir/page.tsx` (line 161) |
| **Issue** | No rate limiting on login or checkout RPC calls. |
| **Root Cause** | All auth and RPC calls go directly to Supabase; no proxy layer. |
| **Risk** | Brute-force password attacks, checkout spam / DoS. |
| **Effort** | L |

**Action Items:**

- [ ] Option A: Use Supabase's built-in rate limiting (available on Pro plan).
- [ ] Option B: Create Next.js API routes `/api/auth/login` and `/api/checkout` that:
  - Implement in-memory or Redis-based rate limiting (e.g., `express-rate-limit` pattern)
  - Forward requests to Supabase
- [ ] Add rate limiting headers to response.

---

### #6 Security Headers (CSP, HSTS, etc.)

| Field | Detail |
|-------|--------|
| **File** | `next.config.ts` |
| **Issue** | No security headers configured. |
| **Root Cause** | Missing `headers()` config in `next.config.ts`. |
| **Risk** | XSS, clickjacking, MIME-type sniffing, downgrade attacks. |
| **Effort** | S |

**Action Items:**

- [ ] Add security headers to `next.config.ts`:
  ```ts
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ]
  }
  ```

---

### #7 Generic Login Error Messages

| Field | Detail |
|-------|--------|
| **File** | `app/login/page.tsx` (line 30) |
| **Issue** | Displaying raw `error.message` from Supabase enables user enumeration. |
| **Root Cause** | Direct pass-through of auth error messages. |
| **Risk** | Attacker can distinguish between "user exists" vs "wrong password". |
| **Effort** | S |

**Action Items:**

- [ ] Replace line 30 with a generic message:
  ```tsx
  toast.error('Login gagal', {
    description: 'Email atau password salah. Silakan coba lagi.',
  })
  ```

---

## 🟢 LOW — Nice to Have

### #8 Audit Logging

| Field | Detail |
|-------|--------|
| **Files** | All admin mutation pages |
| **Issue** | No log of who deleted/modified products, categories, or transactions. |
| **Risk** | No accountability for destructive actions. |
| **Effort** | L |

**Action Items:**

- [ ] Create an `audit_logs` table:
  ```sql
  CREATE TABLE audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
  ```
- [ ] Add triggers on `products`, `categories`, `transactions` for DELETE and UPDATE operations.
- [ ] Add RPC function for manual audit entries.

---

### #9 Immutable Transaction Records

| Field | Detail |
|-------|--------|
| **File** | `supabase/schema.sql` — `transactions` table |
| **Issue** | Transactions can be updated/deleted. For POS systems, financial records should be immutable (void only). |
| **Risk** | Audit trail can be tampered with. |
| **Effort** | M |

**Action Items:**

- [ ] Add a `status` column to `transactions` (`active`, `voided`).
- [ ] Replace DELETE with a void operation that marks the transaction as `voided` and reverses stock.
- [ ] Remove UPDATE/DELETE policies on `transactions` and `transaction_items`.

---

### #10 Role Verification on Admin Pages (Defense in Depth)

| Field | Detail |
|-------|--------|
| **File** | `app/(dashboard)/layout.tsx` (line 53–65) |
| **Issue** | Admin pages rely solely on middleware for route protection. If middleware fails, there's no server-side verification. |
| **Risk** | Client-side role check can be bypassed. |
| **Effort** | S |

**Action Items:**

- [ ] Add a `useEffect` guard in the dashboard layout that redirects if role doesn't match:
  ```tsx
  useEffect(() => {
    const checkAccess = async () => {
      if (!role) return
      const isAdminRoute = pathname.startsWith('/admin')
      const isKasirRoute = pathname.startsWith('/kasir')
      if (isAdminRoute && role !== 'admin_inventory') router.push('/kasir')
      if (isKasirRoute && role !== 'kasir') router.push('/admin')
    }
    checkAccess()
  }, [role, pathname, router])
  ```

---

## Execution Roadmap

| Phase | Items | Timeline |
|-------|-------|----------|
| **P0 — Immediate** | #1, #2 | Today |
| **P1 — This Sprint** | #3, #4, #6, #7 | This sprint |
| **P2 — Next Sprint** | #5, #8, #9, #10 | Next sprint |

---

## How to Apply SQL Changes

1. Open Supabase Dashboard → SQL Editor.
2. For each SQL change, run the relevant `DROP POLICY` / `CREATE POLICY` / `CREATE OR REPLACE FUNCTION` statement.
3. After execution, test with a browser console by calling `supabase.rpc(...)` or `supabase.from(...)` as different roles.

## How to Apply Code Changes

1. Make edits to the files listed in each issue.
2. Run `npm run lint` to verify code quality.
3. Run `npm run build` to verify no TypeScript errors.
4. Deploy via `git push` to your hosting provider (Vercel, etc.).
