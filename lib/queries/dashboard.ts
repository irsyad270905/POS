import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { dashboardKeys } from './keys'

type Transaction = {
  id: string
  invoice_number: string
  total_amount: number
  payment_method: string
  created_at: string
  profiles: { full_name: string | null; email: string } | null
}

type DashboardData = {
  todayRevenue: number
  todayTransactions: number
  totalProducts: number
  lowStockCount: number
  recentTxns: Transaction[]
  sales7Days: { date: string; label: string; revenue: number; count: number }[]
  paymentBreakdown: { method: string; label: string; count: number; total: number }[]
  categoryDistribution: { name: string; count: number }[]
  monthlyRevenue: number
}

export function useDashboard(categoryId: string = 'all') {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: [...dashboardKeys.stats(), categoryId],
    staleTime: 0,
    gcTime: 30_000,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: async (): Promise<DashboardData> => {
      const supabase = createClient()
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
      sevenDaysAgo.setHours(0, 0, 0, 0)

      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)

      const [
        { data: todayTxns },
        { count: productCount },
        { count: lowStock },
        { data: recent },
        { data: last7DaysTxns },
        { data: monthTxns },
        { data: categories },
        { data: productsByCategory },
      ] = await Promise.all([
        supabase.from('transactions').select('total_amount').gte('created_at', todayStart.toISOString()),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('*', { count: 'exact', head: true }).lte('stock', 5),
        supabase
          .from('transactions')
          .select('id, invoice_number, total_amount, payment_method, created_at, profiles(full_name, email)')
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('transactions')
          .select('id, total_amount, created_at, payment_method')
          .gte('created_at', sevenDaysAgo.toISOString())
          .order('created_at', { ascending: true }),
        supabase.from('transactions').select('total_amount').gte('created_at', monthStart.toISOString()),
        supabase.from('categories').select('id, name'),
        supabase.from('products').select('category_id, categories(name)'),
      ])

      const todayRevenue = todayTxns?.reduce((sum, t) => sum + Number(t.total_amount), 0) || 0
      const todayCount = todayTxns?.length || 0
      const monthlyRevenue = monthTxns?.reduce((sum, t) => sum + Number(t.total_amount), 0) || 0

      // Helper: local date key YYYY-MM-DD tanpa masalah timezone UTC
      const toLocalDateKey = (date: Date | string) => {
        const d = typeof date === 'string' ? new Date(date) : date
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      }

      // Build 7-day sales — logis: jika filter kategori, hitung hanya item yang kategori = dipilih
      let sales7Days: DashboardData['sales7Days']

      // Build dayMap template 7 hari
      const buildDayMap = () => {
        const map = new Map<string, { revenue: number; count: number; txSet: Set<string> }>()
        for (let i = 0; i < 7; i++) {
          const d = new Date(sevenDaysAgo)
          d.setDate(sevenDaysAgo.getDate() + i)
          const key = toLocalDateKey(d)
          map.set(key, { revenue: 0, count: 0, txSet: new Set() })
        }
        return map
      }

      const dayMapToArray = (map: Map<string, { revenue: number; count: number; txSet: Set<string> }>) =>
        Array.from(map.entries()).map(([date, v]) => {
          const [y, m, d] = date.split('-').map(Number)
          const dt = new Date(y, m - 1, d)
          return {
            date,
            label: dt.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit' }),
            revenue: v.revenue,
            count: v.txSet.size || v.count,
          }
        })

      if (categoryId === 'all') {
        const dayMap = buildDayMap()
        ;(last7DaysTxns || []).forEach((t: { total_amount: number; created_at: string }) => {
          const key = toLocalDateKey(t.created_at)
          const entry = dayMap.get(key)
          if (entry) {
            entry.revenue += Number(t.total_amount)
            entry.count += 1
            entry.txSet.add('x') // dummy, pakai count langsung
          }
        })
        // Override txSet.size with count for 'all' mode
        sales7Days = Array.from(dayMap.entries()).map(([date, v]) => {
          const [y, m, d] = date.split('-').map(Number)
          const dt = new Date(y, m - 1, d)
          return {
            date,
            label: dt.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit' }),
            revenue: v.revenue,
            count: v.count,
          }
        })
      } else {
        // per kategori: ambil transaction_items 7 hari terakhir, join product → category
        const txIds = (last7DaysTxns || []).map((t: { id: string }) => t.id)
        let items: { quantity: number; price_at_time: number; transaction_id: string; product_id: string | null; products: { category_id: string | null } | null }[] = []
        if (txIds.length > 0) {
          const chunkSize = 900
          for (let i = 0; i < txIds.length; i += chunkSize) {
            const chunk = txIds.slice(i, i + chunkSize)
            const { data, error } = await supabase
              .from('transaction_items')
              .select('quantity, price_at_time, transaction_id, product_id, products(category_id)')
              .in('transaction_id', chunk)
            if (!error && data) items.push(...(data as unknown as typeof items))
          }
        }

        // txn id -> tanggal
        const txnDate = new Map<string, string>()
        ;(last7DaysTxns || []).forEach((t: { id: string; created_at: string }) => txnDate.set(t.id, t.created_at))

        const dayMap = buildDayMap()
        items.forEach(it => {
          // Cek kategori produk — ambil dari join langsung
          const itemCatId = it.products
            ? (Array.isArray(it.products) ? (it.products as { category_id: string | null }[])[0]?.category_id : it.products.category_id)
            : null
          if (itemCatId !== categoryId) return
          const created = txnDate.get(it.transaction_id)
          if (!created) return
          const key = toLocalDateKey(created)
          const entry = dayMap.get(key)
          if (entry) {
            entry.revenue += Number(it.quantity) * Number(it.price_at_time)
            entry.txSet.add(it.transaction_id)
          }
        })
        sales7Days = dayMapToArray(dayMap)
      }

      // Payment breakdown
      const payMap = new Map<string, { count: number; total: number }>()
      ;(last7DaysTxns || []).forEach((t: { payment_method: string; total_amount: number }) => {
        const cur = payMap.get(t.payment_method) || { count: 0, total: 0 }
        cur.count += 1
        cur.total += Number(t.total_amount)
        payMap.set(t.payment_method, cur)
      })
      const paymentLabels: Record<string, string> = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer' }
      const paymentBreakdown = Array.from(payMap.entries()).map(([method, v]) => ({
        method,
        label: paymentLabels[method] || method,
        count: v.count,
        total: v.total,
      }))

      // Category distribution
      const catNameById = new Map<string, string>()
      ;(categories || []).forEach((c: { id: string; name: string }) => catNameById.set(c.id, c.name))
      const catCount = new Map<string, number>()
      ;((productsByCategory as unknown as { category_id: string | null; categories: { name: string } | { name: string }[] | null }[]) || []).forEach((p) => {
        const cat = Array.isArray(p.categories) ? p.categories[0] : p.categories
        const name = cat?.name || catNameById.get(p.category_id || '') || 'Tanpa Kategori'
        catCount.set(name, (catCount.get(name) || 0) + 1)
      })
      const categoryDistribution = Array.from(catCount.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)

      return {
        todayRevenue,
        todayTransactions: todayCount,
        totalProducts: productCount || 0,
        lowStockCount: lowStock || 0,
        recentTxns: (recent as unknown as Transaction[]) || [],
        sales7Days,
        paymentBreakdown,
        categoryDistribution,
        monthlyRevenue,
      }
    },
  })

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`dashboard-realtime-${categoryId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, () => {
        queryClient.invalidateQueries({ queryKey: [...dashboardKeys.stats(), categoryId] })
        // juga refresh semua varian kategori agar total 7 hari semua kategori sinkron
        queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transaction_items' }, () => {
        queryClient.invalidateQueries({ queryKey: [...dashboardKeys.stats(), categoryId] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient, categoryId])

  return query
}
