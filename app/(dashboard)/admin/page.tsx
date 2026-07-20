'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DollarSign, ShoppingCart, Package, AlertTriangle, TrendingUp, ArrowUpRight } from 'lucide-react'

type StatCard = {
  label: string
  value: string
  subtitle: string
  icon: React.ElementType
  borderColor: string
  iconBg: string
  iconColor: string
  valueColor: string
}

type Transaction = {
  id: string
  invoice_number: string
  total_amount: number
  payment_method: string
  created_at: string
  profiles: { full_name: string | null; email: string } | null
}

export default function AdminDashboard() {
  const supabase = createClient()
  const [stats, setStats] = useState({
    todayRevenue: 0,
    todayTransactions: 0,
    totalProducts: 0,
    lowStockCount: 0,
  })
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data: todayTxns } = await supabase
      .from('transactions')
      .select('total_amount')
      .gte('created_at', todayStart.toISOString())

    const todayRevenue = todayTxns?.reduce((sum, t) => sum + Number(t.total_amount), 0) || 0
    const todayCount = todayTxns?.length || 0

    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })

    const { count: lowStock } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .lte('stock', 5)

    const { data: recent } = await supabase
      .from('transactions')
      .select('id, invoice_number, total_amount, payment_method, created_at, profiles(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(10)

    setStats({
      todayRevenue,
      todayTransactions: todayCount,
      totalProducts: productCount || 0,
      lowStockCount: lowStock || 0,
    })
    setRecentTxns((recent as unknown as Transaction[]) || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    let active = true
    setTimeout(() => {
      if (active) fetchDashboardData()
    }, 0)
    return () => { active = false }
  }, [fetchDashboardData])

  const statCards: StatCard[] = [
    {
      label: 'Pendapatan Hari Ini',
      value: `Rp ${stats.todayRevenue.toLocaleString('id-ID')}`,
      subtitle: 'Total penjualan hari ini',
      icon: DollarSign,
      borderColor: 'rgba(255, 107, 53, 0.25)',
      iconBg: 'rgba(255, 107, 53, 0.12)',
      iconColor: '#FF6B35',
      valueColor: '#FF6B35',
    },
    {
      label: 'Transaksi Hari Ini',
      value: stats.todayTransactions.toString(),
      subtitle: 'Jumlah transaksi',
      icon: ShoppingCart,
      borderColor: 'rgba(255, 140, 66, 0.25)',
      iconBg: 'rgba(255, 140, 66, 0.12)',
      iconColor: '#FF8C42',
      valueColor: '#FF8C42',
    },
    {
      label: 'Total Produk',
      value: stats.totalProducts.toString(),
      subtitle: 'Produk terdaftar',
      icon: Package,
      borderColor: 'rgba(232, 93, 39, 0.25)',
      iconBg: 'rgba(232, 93, 39, 0.12)',
      iconColor: '#E85D27',
      valueColor: '#E85D27',
    },
    {
      label: 'Stok Rendah',
      value: stats.lowStockCount.toString(),
      subtitle: 'Produk stok ≤ 5',
      icon: AlertTriangle,
      borderColor: 'rgba(239, 68, 68, 0.25)',
      iconBg: 'rgba(239, 68, 68, 0.12)',
      iconColor: '#ef4444',
      valueColor: '#ef4444',
    },
  ]

  const paymentLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'Tunai'
      case 'qris': return 'QRIS'
      case 'transfer': return 'Transfer'
      default: return method
    }
  }

  const getPaymentBadgeStyle = (method: string) => {
    switch (method) {
      case 'cash': return { background: 'rgba(255,107,53,0.1)', color: '#FF8C42', border: '1px solid rgba(255,107,53,0.25)' }
      case 'qris': return { background: 'rgba(255,140,66,0.1)', color: '#FF8C42', border: '1px solid rgba(255,140,66,0.25)' }
      default: return { background: 'rgba(232,93,39,0.1)', color: '#E85D27', border: '1px solid rgba(232,93,39,0.25)' }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Ringkasan bisnis Anda hari ini</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="group relative overflow-hidden backdrop-blur-sm transition-all duration-300 hover:-translate-y-1"
            style={{
              background: 'var(--bg-card)',
              border: `1px solid ${stat.borderColor}`,
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 35px -8px rgba(255,107,53,0.2)`
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)'
            }}
          >
            {/* Orange glow streak at top */}
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(to right, transparent, ${stat.iconColor}, transparent)` }} />

            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-xl border" style={{ background: stat.iconBg, borderColor: stat.borderColor }}>
                  <stat.icon className="h-5 w-5" style={{ color: stat.iconColor }} />
                </div>
                <ArrowUpRight className="h-4 w-4 opacity-30 group-hover:opacity-100 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all duration-200" style={{ color: stat.iconColor }} />
              </div>
              <div className="relative">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{stat.label}</p>
                <p className="text-3xl font-black tracking-tight mt-1" style={{ color: loading ? 'var(--text-muted)' : stat.valueColor }}>
                  {loading ? '—' : stat.value}
                </p>
                <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>{stat.subtitle}</p>
              </div>
              {/* Watermark icon */}
              <stat.icon className="absolute -right-5 -bottom-5 h-20 w-20 opacity-[0.04] group-hover:opacity-[0.08] group-hover:scale-110 transition-all duration-300 pointer-events-none" style={{ color: stat.iconColor }} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Transactions */}
      <Card className="border overflow-hidden backdrop-blur-sm rounded-2xl"
        style={{ background: 'var(--bg-card)', borderColor: 'rgba(255,107,53,0.12)' }}>
        <div className="p-5 border-b flex items-center justify-between"
          style={{ borderColor: 'rgba(255,107,53,0.1)', background: 'rgba(255,107,53,0.03)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.2)' }}>
              <TrendingUp className="h-5 w-5 animate-pulse" style={{ color: '#FF6B35' }} />
            </div>
            <h2 className="text-lg font-semibold text-white">Transaksi Terbaru</h2>
          </div>
          <Badge className="font-bold rounded-lg px-2.5"
            style={{ background: 'var(--bg-surface)', border: '1px solid rgba(255,107,53,0.2)', color: 'var(--text-secondary)' }}>
            {recentTxns.length} terbaru
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b" style={{ background: 'rgba(255,107,53,0.04)', borderColor: 'rgba(255,107,53,0.1)' }}>
                <TableHead className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Invoice</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Kasir</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Metode</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-right" style={{ color: 'var(--text-secondary)' }}>Total</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-right" style={{ color: 'var(--text-secondary)' }}>Waktu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : recentTxns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>
                    Belum ada transaksi
                  </TableCell>
                </TableRow>
              ) : (
                recentTxns.map((txn) => (
                  <TableRow key={txn.id} className="group transition-colors border-b"
                    style={{ borderColor: 'rgba(255,107,53,0.06)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,107,53,0.04)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <TableCell className="font-mono text-sm font-bold" style={{ color: '#FF6B35' }}>
                      {txn.invoice_number}
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-slate-200">
                      {txn.profiles?.full_name || txn.profiles?.email || '—'}
                    </TableCell>
                    <TableCell>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={getPaymentBadgeStyle(txn.payment_method)}>
                        {paymentLabel(txn.payment_method)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-black text-slate-100">
                      Rp {Number(txn.total_amount).toLocaleString('id-ID')}
                    </TableCell>
                    <TableCell className="text-right text-xs group-hover:text-slate-200 transition-colors" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(txn.created_at).toLocaleString('id-ID', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
