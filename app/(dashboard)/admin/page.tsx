'use client'

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
      gradient: 'from-emerald-500 to-green-600',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'Transaksi Hari Ini',
      value: stats.todayTransactions.toString(),
      subtitle: 'Jumlah transaksi',
      icon: ShoppingCart,
      gradient: 'from-violet-500 to-indigo-600',
      iconColor: 'text-violet-600',
    },
    {
      label: 'Total Produk',
      value: stats.totalProducts.toString(),
      subtitle: 'Produk terdaftar',
      icon: Package,
      gradient: 'from-blue-500 to-cyan-600',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Stok Rendah',
      value: stats.lowStockCount.toString(),
      subtitle: 'Produk stok ≤ 5',
      icon: AlertTriangle,
      gradient: 'from-orange-500 to-red-600',
      iconColor: 'text-orange-600',
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Ringkasan bisnis Anda hari ini</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg`}>
                  <stat.icon className="h-5 w-5 text-white" />
                </div>
                <ArrowUpRight className={`h-4 w-4 ${stat.iconColor} opacity-50`} />
              </div>
              <div>
                <p className="text-2xl font-black tracking-tight">{loading ? '—' : stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Transactions */}
      <Card className="border-0 shadow-md">
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-violet-600" />
            <h2 className="text-lg font-bold">Transaksi Terbaru</h2>
          </div>
          <Badge variant="secondary">{recentTxns.length} terbaru</Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50/50 dark:bg-zinc-800/30">
                <TableHead>Invoice</TableHead>
                <TableHead>Kasir</TableHead>
                <TableHead>Metode</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Waktu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : recentTxns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    Belum ada transaksi
                  </TableCell>
                </TableRow>
              ) : (
                recentTxns.map((txn) => (
                  <TableRow key={txn.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <TableCell className="font-mono text-sm font-bold text-violet-700 dark:text-violet-400">
                      {txn.invoice_number}
                    </TableCell>
                    <TableCell className="text-sm">
                      {(txn.profiles as any)?.full_name || (txn.profiles as any)?.email || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-medium">
                        {paymentLabel(txn.payment_method)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      Rp {Number(txn.total_amount).toLocaleString('id-ID')}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
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
