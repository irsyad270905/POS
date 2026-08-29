import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { productKeys, dashboardKeys, transactionKeys, categoryKeys } from './keys'

export type Category = { id: string; name: string }

export type Product = {
  id: string
  name: string
  sku: string
  barcode: string | null
  price: number
  stock: number
  category_id: string | null
  categories: { name: string } | null
  unit?: string | null
  image_url: string | null
  is_active?: boolean | null
  archived_at?: string | null
  created_at?: string
  updated_at?: string
}

export type ProductPayload = {
  name: string
  sku: string
  price: number
  stock: number
  barcode: string | null
  category_id: string | null
  unit?: string | null
  image_url?: string | null
  updated_at?: string
}

export function useProducts() {
  return useQuery({
    queryKey: productKeys.lists(),
    queryFn: async (): Promise<Product[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name)')
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return (data as unknown as Product[]) || []
    },
  })
}

export function useKasirProducts() {
  return useQuery({
    queryKey: productKeys.kasirLists(),
    queryFn: async (): Promise<Product[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name)')
        .eq('is_active', true)
        .gt('stock', 0)
        .order('name')
      if (error) {
        // fallback jika kolom is_active belum ada (belum migrasi)
        if (String(error.message).includes('is_active') || String((error as unknown as { code?: string }).code) === '42703') {
          const { data: fb, error: fbErr } = await supabase.from('products').select('*, categories(name)').gt('stock', 0).order('name')
          if (fbErr) throw new Error(fbErr.message)
          return (fb as unknown as Product[]) || []
        }
        throw new Error(error.message)
      }
      return (data as unknown as Product[]) || []
    },
  })
}

export function useProductCategories() {
  return useQuery({
    queryKey: categoryKeys.lists(),
    queryFn: async (): Promise<Category[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.from('categories').select('*').order('name')
      if (error) throw new Error(error.message)
      return data || []
    },
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      payload,
      productId,
    }: {
      payload: ProductPayload
      productId: string
    }) => {
      const supabase = createClient()

      // Helper untuk mencoba insert dengan payload tertentu
      const attemptInsert = async (p: ProductPayload) => {
        let res = await supabase.from('products').insert([{ id: productId, ...p }]).select().single()
        
        // Fallback jika kolom 'unit' belum ada di DB
        if (res.error) {
          const msg = String(res.error.message || '').toLowerCase()
          if (msg.includes("'unit'") || msg.includes('"unit"') || msg.includes('schema cache')) {
            const { unit: _u, ...withoutUnit } = p
            res = await supabase.from('products').insert([{ id: productId, ...withoutUnit }]).select().single()
          }
        }
        return res
      }

      let res = await attemptInsert(payload)

      // Jika error karena SKU duplikat (unique constraint 23505)
      if (res.error) {
        const msg = String(res.error.message || '').toLowerCase()
        const code = (res.error as unknown as { code?: string })?.code
        const isSkuDuplicate = code === '23505' || msg.includes('products_sku_key') || msg.includes('duplicate key')

        if (isSkuDuplicate) {
          // Cari SKU baru yang unik berdasarkan prefix
          const currentSku = payload.sku || 'SKU-01'
          const prefix = currentSku.split('-')[0] || 'SKU'
          
          // Ambil semua SKU yang berawalan prefix tersebut dari database
          const { data: existingProducts } = await supabase
            .from('products')
            .select('sku')
            .ilike('sku', `${prefix}-%`)

          const existingSkus = (existingProducts || []).map((p: { sku: string }) => p.sku)
          let nextNum = 1
          if (existingSkus.length > 0) {
            const numbers = existingSkus.map(s => parseInt(s.split('-').pop() || '0', 10)).filter(n => !isNaN(n))
            if (numbers.length > 0) {
              nextNum = Math.max(...numbers) + 1
            }
          }
          const uniqueSku = `${prefix.toUpperCase()}-${String(nextNum).padStart(2, '0')}`

          // Retry insert dengan SKU unik baru
          const newPayload = { ...payload, sku: uniqueSku }
          res = await attemptInsert(newPayload)
        }
      }

      if (res.error) throw new Error(res.error.message)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}

export function useCreateBulkProducts() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (items: { id?: string; payload: ProductPayload }[]) => {
      const supabase = createClient()
      if (!items || items.length === 0) return []

      const createdList = []
      for (const item of items) {
        const productId = item.id || crypto.randomUUID()
        const payload = item.payload

        const attemptInsert = async (p: ProductPayload) => {
          let res = await supabase.from('products').insert([{ id: productId, ...p }]).select().single()
          if (res.error) {
            const msg = String(res.error.message || '').toLowerCase()
            if (msg.includes("'unit'") || msg.includes('"unit"') || msg.includes('schema cache')) {
              const { unit: _u, ...withoutUnit } = p
              res = await supabase.from('products').insert([{ id: productId, ...withoutUnit }]).select().single()
            }
          }
          return res
        }

        let res = await attemptInsert(payload)
        if (res.error) {
          const msg = String(res.error.message || '').toLowerCase()
          const code = (res.error as unknown as { code?: string })?.code
          const isSkuDuplicate = code === '23505' || msg.includes('products_sku_key') || msg.includes('duplicate key')
          if (isSkuDuplicate) {
            const currentSku = payload.sku || 'SKU-01'
            const prefix = currentSku.split('-')[0] || 'SKU'
            const { data: existingProducts } = await supabase
              .from('products')
              .select('sku')
              .ilike('sku', `${prefix}-%`)

            const existingSkus = (existingProducts || []).map((p: { sku: string }) => p.sku)
            let nextNum = 1
            if (existingSkus.length > 0) {
              const numbers = existingSkus.map(s => parseInt(s.split('-').pop() || '0', 10)).filter(n => !isNaN(n))
              if (numbers.length > 0) nextNum = Math.max(...numbers) + 1
            }
            const uniqueSku = `${prefix.toUpperCase()}-${String(nextNum).padStart(2, '0')}`
            res = await attemptInsert({ ...payload, sku: uniqueSku })
          }
        }

        if (res.error) throw new Error(`Gagal menyimpan "${payload.name}": ${res.error.message}`)
        if (res.data) createdList.push(res.data)
      }

      return createdList
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string
      payload: ProductPayload
    }) => {
      const supabase = createClient()
      const finalPayload = {
        ...payload,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase.from('products').update(finalPayload).eq('id', id).select().single()
      
      // Fallback jika kolom 'unit' belum ada di remote DB Supabase
      if (error) {
        const msg = String(error.message || '').toLowerCase()
        const isUnitMissing = msg.includes("'unit'") || msg.includes('"unit"') || msg.includes('schema cache')
        if (isUnitMissing) {
          const { unit: _u, ...fallbackPayload } = finalPayload
          const retry = await supabase.from('products').update(fallbackPayload).eq('id', id).select().single()
          if (!retry.error) return retry.data
          throw new Error(retry.error.message)
        }
        throw new Error(error.message)
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      // Gunakan API route server-side yang pakai service role key
      // sehingga bisa handle FK constraint (hapus stock_adjustments & transaction_items dulu)
      const res = await fetch(`/api/barang/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Gagal menghapus produk' }))
        throw new Error(body.message || 'Gagal menghapus produk')
      }
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all })
      queryClient.invalidateQueries({ queryKey: transactionKeys.all })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}
