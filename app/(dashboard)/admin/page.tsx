'use client'

// CHANGED: Redesigned stats cards with big background icons, custom gradient surfaces, zebra striped rows, and typography hierarchies
// UNCHANGED: Supabase date fetches, dashboard stats calculation models, paymentMethod triggers

import { useState, useEffect } from 'react'
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
  gradient: string
  iconColor: string
  accentColor: string
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

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    // Today's transactions
    const { data: todayTxns } = await supabase
      .from('transactions')
      .select('total_amount')
      .gte('created_at', todayStart.toISOString())

    const todayRevenue = todayTxns?.reduce((sum, t) => sum + Number(t.total_amount), 0) || 0
    const todayCount = todayTxns?.length || 0

    // Total products
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })

    // Low stock (<=5)
    const { count: lowStock } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .lte('stock', 5)

    // Recent transactions
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
    setRecentTxns((recent as any) || [])
    setLoading(false)
  }

  const statCards: StatCard[] = [
    {
      label: 'Pendapatan Hari Ini',
      value: `Rp ${stats.todayRevenue.toLocaleString('id-ID')}`,
      subtitle: 'Total penjualan hari ini',
      icon: DollarSign,
      gradient: 'from-emerald-500/10 to-teal-500/5 hover:border-emerald-500/30',
      iconColor: 'text-emerald-400 bg-emerald-500/10',
      accentColor: 'text-[var(--success)]',
    },
    {
      label: 'Transaksi Hari Ini',
      value: stats.todayTransactions.toString(),
      subtitle: 'Jumlah transaksi',
      icon: ShoppingCart,
      gradient: 'from-teal-500/10 to-cyan-500/5 hover:border-teal-500/30',
      iconColor: 'text-teal-400 bg-teal-500/10',
      accentColor: 'text-[var(--accent-primary)]',
    },
    {
      label: 'Total Produk',
      value: stats.totalProducts.toString(),
      subtitle: 'Produk terdaftar',
      icon: Package,
      gradient: 'from-blue-500/10 to-indigo-500/5 hover:border-blue-500/30',
      iconColor: 'text-blue-400 bg-blue-500/10',
      accentColor: 'text-[var(--info)]',
    },
    {
      label: 'Stok Rendah',
      value: stats.lowStockCount.toString(),
      subtitle: 'Produk stok ≤ 5',
      icon: AlertTriangle,
      gradient: 'from-orange-500/10 to-red-500/5 hover:border-orange-500/30',
      iconColor: 'text-orange-400 bg-orange-500/10',
      accentColor: 'text-[var(--warning)]',
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

  const getPaymentBadgeClass = (method: string) => {
    switch (method) {
      case 'cash': return 'badge-success'
      case 'qris': return 'badge-warning'
      default: return 'badge-danger'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
        <p className="text-sm text-[var(--text-secondary)]">Ringkasan bisnis Anda hari ini</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className={`group relative overflow-hidden border border-[var(--border)] bg-[var(--bg-card)]/50 backdrop-blur-sm hover:shadow-[0_10px_30px_-10px_var(--accent-glow)] transition-all duration-300 bg-gradient-to-br ${stat.gradient}`}>
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2.5 rounded-xl ${stat.iconColor} border border-white/5`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-[var(--text-secondary)] opacity-35 group-hover:opacity-100 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all duration-200" />
              </div>
              <div className="relative">
                <p className="text-sm text-[var(--text-secondary)] font-semibold uppercase tracking-wider">{stat.label}</p>
                <p className={`text-3xl font-bold tracking-tight mt-1 ${stat.accentColor}`}>{loading ? '—' : stat.value}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1.5">{stat.subtitle}</p>
              </div>
              {/* Giant background corner icon */}
              <stat.icon className="absolute -right-6 -bottom-6 h-24 w-24 text-white/3 opacity-3 group-hover:scale-105 transition-transform duration-300 pointer-events-none" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Transactions */}
      <Card className="border border-[var(--border)] shadow-md overflow-hidden bg-[var(--bg-card)]/50 backdrop-blur-sm rounded-2xl">
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-card)]/40">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--accent-primary)]/10 rounded-lg border border-[var(--accent-primary)]/20">
              <TrendingUp className="h-5 w-5 text-[var(--accent-primary)] animate-pulse" />
            </div>
            <h2 className="text-lg font-semibold text-white">Transaksi Terbaru</h2>
          </div>
          <Badge className="bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] font-bold rounded-lg px-2.5">{recentTxns.length} terbaru</Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[var(--bg-card)] border-b border-[var(--border)]">
                <TableHead className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Invoice</TableHead>
                <TableHead className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Kasir</TableHead>
                <TableHead className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Metode</TableHead>
                <TableHead className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider text-right">Total</TableHead>
                <TableHead className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider text-right">Waktu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-[var(--text-secondary)] font-semibold">
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : recentTxns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-[var(--text-secondary)]">
                    Belum ada transaksi
                  </TableCell>
                </TableRow>
              ) : (
                recentTxns.map((txn) => (
                  <TableRow key={txn.id} className="group hover:bg-[var(--bg-card-hover)]/30 transition-colors border-b border-[var(--border)] even:bg-[var(--bg-card)]/10">
                    <TableCell className="font-mono text-sm font-bold text-[var(--accent-primary)]">
                      {txn.invoice_number}
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-slate-200">
                      {(txn.profiles as any)?.full_name || (txn.profiles as any)?.email || '—'}
                    </TableCell>
                    <TableCell>
                      <span className={getPaymentBadgeClass(txn.payment_method)}>
                        {paymentLabel(txn.payment_method)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-black text-slate-100">
                      Rp {Number(txn.total_amount).toLocaleString('id-ID')}
                    </TableCell>
                    <TableCell className="text-right text-xs text-[var(--text-secondary)] group-hover:text-slate-200 transition-colors">
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
