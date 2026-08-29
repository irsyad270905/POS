'use client'

export const dynamic = 'force-dynamic'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useState } from 'react'
import { DollarSign, ShoppingCart, Package, AlertTriangle, TrendingUp, ArrowUpRight, CreditCard, Layers, BarChart3 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDashboard } from '@/lib/queries/dashboard'
import { useCategories } from '@/lib/queries/categories'
import { getCategoryVisual } from '@/lib/categoryVisual'
import RestockWidget from '@/components/restock/RestockWidget'

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

export default function AdminDashboard() {
  const [chartCategory, setChartCategory] = useState<string>('all')
  const { data: categories = [] } = useCategories()
  const { data, isLoading, isFetching } = useDashboard(chartCategory)
  const stats = data
    ? {
        todayRevenue: data.todayRevenue,
        todayTransactions: data.todayTransactions,
        totalProducts: data.totalProducts,
        lowStockCount: data.lowStockCount,
        monthlyRevenue: data.monthlyRevenue,
        sales7Days: data.sales7Days,
        paymentBreakdown: data.paymentBreakdown,
        categoryDistribution: data.categoryDistribution,
      }
    : {
        todayRevenue: 0,
        todayTransactions: 0,
        totalProducts: 0,
        lowStockCount: 0,
        monthlyRevenue: 0,
        sales7Days: [] as { date: string; label: string; revenue: number; count: number }[],
        paymentBreakdown: [] as { method: string; label: string; count: number; total: number }[],
        categoryDistribution: [] as { name: string; count: number }[],
      }
  const recentTxns = data?.recentTxns ?? []
  const loading = isLoading

  const statCards: StatCard[] = [
    {
      label: 'Pendapatan Hari Ini',
      value: `Rp ${stats.todayRevenue.toLocaleString('id-ID')}`,
      subtitle: `Bulan ini Rp ${stats.monthlyRevenue.toLocaleString('id-ID')}`,
      icon: DollarSign,
      borderColor: 'rgba(255, 107, 53, 0.25)',
      iconBg: 'rgba(255, 107, 53, 0.12)',
      iconColor: '#FF6B35',
      valueColor: '#FF6B35',
    },
    {
      label: 'Transaksi Hari Ini',
      value: stats.todayTransactions.toString(),
      subtitle: `${stats.sales7Days.reduce((a, b) => a + b.count, 0)} trx / 7 hari`,
      icon: ShoppingCart,
      borderColor: 'rgba(255, 140, 66, 0.25)',
      iconBg: 'rgba(255, 140, 66, 0.12)',
      iconColor: '#FF8C42',
      valueColor: '#FF8C42',
    },
    {
      label: 'Total Produk',
      value: stats.totalProducts.toString(),
      subtitle: `${stats.categoryDistribution.length} kategori`,
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

  // Chart helpers
  const selectedCatName = chartCategory === 'all' ? null : categories.find(c => c.id === chartCategory)?.name || null
  const selectedVisual = selectedCatName ? getCategoryVisual(selectedCatName) : null
  const maxRevenue = Math.max(...stats.sales7Days.map(d => d.revenue), 1)
  const paymentTotal = stats.paymentBreakdown.reduce((a, b) => a + b.count, 0) || 1
  const paymentColors: Record<string, string> = { cash: '#FF6B35', qris: '#FF8C42', transfer: '#E85D27' }
  const maxCatCount = Math.max(...stats.categoryDistribution.map(c => c.count), 1)

  // Donut calc
  let cumulative = 0
  const donutSegments = stats.paymentBreakdown.map(p => {
    const pct = (p.count / paymentTotal) * 100
    const dash = (pct / 100) * 251.2 // 2πr where r=40
    const offset = 251.2 - cumulative - dash
    // rotate start at -90deg (offset)
    const seg = { ...p, pct, dash, offset: -cumulative }
    cumulative += dash
    return seg
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Ringkasan bisnis Anda hari ini</p>
      </div>

      {/* KPI Cards */}
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
                <p className="text-2xl font-black tracking-tight mt-1 truncate" style={{ color: loading ? 'var(--text-muted)' : stat.valueColor }}>
                  {loading ? '—' : stat.value}
                </p>
                <p className="text-xs mt-1.5 truncate" style={{ color: 'var(--text-secondary)' }}>{stat.subtitle}</p>
              </div>
              <stat.icon className="absolute -right-5 -bottom-5 h-20 w-20 opacity-[0.04] group-hover:opacity-[0.08] group-hover:scale-110 transition-all duration-300 pointer-events-none" style={{ color: stat.iconColor }} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales 7 Days Chart */}
        <Card className="lg:col-span-2 border overflow-hidden backdrop-blur-sm rounded-2xl" style={{ background: 'var(--bg-card)', borderColor: 'rgba(255,107,53,0.12)' }}>
          <div className="p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: 'rgba(255,107,53,0.1)', background: 'rgba(255,107,53,0.03)' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.2)' }}>
                <BarChart3 className="h-5 w-5" style={{ color: '#FF6B35' }} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Penjualan 7 Hari Terakhir</h2>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{selectedCatName ? `Pendapatan ${selectedCatName}` : 'Pendapatan harian'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full shrink-0" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#6ee7b7' }}>
                <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: '#6ee7b7' }} />
                Live
                {isFetching && <span className="h-3 w-3 border-2 border-t-transparent rounded-full animate-spin ml-0.5" style={{ borderColor: '#6ee7b7', borderTopColor: 'transparent' }} />}
              </span>
              <Select value={chartCategory} onValueChange={(v) => setChartCategory(v || 'all')}>
                <SelectTrigger className="w-44 h-8 rounded-lg border-0 text-xs" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
                  <span className="flex-1 text-left truncate flex items-center gap-1.5">
                    {chartCategory === 'all' ? (
                      'Semua Kategori'
                    ) : (
                      (() => {
                        const cat = categories.find(c => c.id === chartCategory)
                        if (!cat) return 'Semua Kategori'
                        const v = getCategoryVisual(cat.name)
                        const Icon = v.icon
                        return (
                          <>
                            <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: v.iconColor }} />
                            <span className="truncate">{cat.name}</span>
                          </>
                        )
                      })()
                    )}
                  </span>
                </SelectTrigger>
                <SelectContent style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {categories.map(c => {
                    const v = getCategoryVisual(c.name)
                    const Icon = v.icon
                    return (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5" style={{ color: v.iconColor }} />{c.name}</span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <Badge className="font-bold rounded-lg px-2.5 shrink-0" style={{ background: selectedVisual ? selectedVisual.iconBg : 'var(--bg-surface)', border: `1px solid ${selectedVisual ? selectedVisual.iconBorder : 'rgba(255,107,53,0.2)'}`, color: selectedVisual ? selectedVisual.iconColor : 'var(--text-secondary)' }}>
                Rp {stats.sales7Days.reduce((a, b) => a + b.revenue, 0).toLocaleString('id-ID')}
              </Badge>
            </div>
          </div>
          <div className="p-5">
            {loading ? (
              <div className="h-48 flex items-center justify-center" style={{ color: 'var(--text-secondary)' }}>Memuat...</div>
            ) : stats.sales7Days.every(d => d.revenue === 0) ? (
              <div className="h-48 flex flex-col items-center justify-center" style={{ color: 'var(--text-secondary)' }}>
                <BarChart3 className="h-10 w-10 opacity-20 mb-2" />
                <p className="text-sm">{selectedCatName ? `Belum ada penjualan ${selectedCatName} 7 hari terakhir` : 'Belum ada penjualan 7 hari terakhir'}</p>
              </div>
            ) : (
              <div className="flex items-end gap-2 h-48">
                {stats.sales7Days.map((d, i) => {
                  const h = maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0
                  const barH = Math.max(h, 4) // min 4% visible
                  const barBg = selectedVisual
                    ? `linear-gradient(to top, ${selectedVisual.iconColor}, ${selectedVisual.iconColor}cc)`
                    : `linear-gradient(to top, #E85D27, #FF8C42 ${Math.min(60 + i * 3, 90)}%)`
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                      <div className="relative flex-1 w-full flex items-end">
                        <div
                          className="w-full rounded-t-xl transition-all duration-500 hover:brightness-110 cursor-pointer relative overflow-hidden"
                          style={{
                            height: `${barH}%`,
                            background: d.revenue > 0
                              ? barBg
                              : 'var(--bg-surface)',
                            boxShadow: d.revenue > 0 ? `0 4px 20px ${selectedVisual ? selectedVisual.iconBg : 'rgba(255,107,53,0.25)'}` : 'inset 0 0 0 1px var(--border)',
                            border: d.revenue > 0 ? `1px solid ${selectedVisual ? selectedVisual.iconBorder : 'rgba(255,107,53,0.25)'}` : '1px solid var(--border)',
                          }}
                          title={`${d.label}: Rp ${d.revenue.toLocaleString('id-ID')} (${d.count} trx)`}
                        >
                          {/* shine */}
                          <div className="absolute inset-0 opacity-20" style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.4), transparent)' }} />
                        </div>
                        {/* tooltip on hover */}
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 pointer-events-none">
                          <div className="px-2 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap" style={{ background: 'var(--bg-surface)', color: 'white', border: '1px solid var(--border)', boxShadow: '0 8px 20px rgba(0,0,0,0.4)' }}>
                            Rp {d.revenue.toLocaleString('id-ID')}<br /><span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{d.count} transaksi</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-center leading-tight" style={{ color: d.revenue > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{d.label.split(',')[0]}<br /><span className="font-medium" style={{ color: 'var(--text-muted)' }}>{d.label.split(',')[1]?.trim() || ''}</span></span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Card>

        {/* Payment Distribution Donut */}
        <Card className="border overflow-hidden backdrop-blur-sm rounded-2xl" style={{ background: 'var(--bg-card)', borderColor: 'rgba(255,107,53,0.12)' }}>
          <div className="p-5 border-b flex items-center gap-3" style={{ borderColor: 'rgba(255,107,53,0.1)', background: 'rgba(255,107,53,0.03)' }}>
            <div className="p-2 rounded-lg" style={{ background: 'rgba(255,140,66,0.1)', border: '1px solid rgba(255,140,66,0.2)' }}>
              <CreditCard className="h-5 w-5" style={{ color: '#FF8C42' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Metode Pembayaran</h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>7 hari terakhir</p>
            </div>
          </div>
          <div className="p-5 flex flex-col items-center">
            {loading ? (
              <div className="h-40 flex items-center justify-center" style={{ color: 'var(--text-secondary)' }}>Memuat...</div>
            ) : stats.paymentBreakdown.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center" style={{ color: 'var(--text-secondary)' }}>
                <CreditCard className="h-10 w-10 opacity-20 mb-2" />
                <p className="text-sm">Belum ada data</p>
              </div>
            ) : (
              <>
                <div className="relative h-40 w-40">
                  <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="var(--bg-surface)" strokeWidth="16" />
                    {donutSegments.map(seg => (
                      <circle
                        key={seg.method}
                        cx="50" cy="50" r="40" fill="none"
                        stroke={paymentColors[seg.method] || '#FF6B35'}
                        strokeWidth="16"
                        strokeDasharray={`${seg.dash} ${251.2 - seg.dash}`}
                        strokeDashoffset={seg.offset}
                        strokeLinecap="round"
                        className="transition-all duration-700"
                      />
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-white">{paymentTotal}</span>
                    <span className="text-[10px] font-bold tracking-widest" style={{ color: 'var(--text-secondary)' }}>TRANSAKSI</span>
                  </div>
                </div>
                <div className="mt-4 w-full space-y-2">
                  {stats.paymentBreakdown.map(p => (
                    <div key={p.method} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ background: paymentColors[p.method] || '#FF6B35' }} />
                        <span className="font-semibold text-white">{p.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{p.count} trx</span>
                        <span className="font-bold text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{((p.count / paymentTotal) * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* AI Restock Widget */}
      <RestockWidget />

      {/* Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border overflow-hidden backdrop-blur-sm rounded-2xl" style={{ background: 'var(--bg-card)', borderColor: 'rgba(255,107,53,0.12)' }}>
          <div className="p-5 border-b flex items-center gap-3" style={{ borderColor: 'rgba(255,107,53,0.1)', background: 'rgba(255,107,53,0.03)' }}>
            <div className="p-2 rounded-lg" style={{ background: 'rgba(232,93,39,0.1)', border: '1px solid rgba(232,93,39,0.2)' }}>
              <Layers className="h-5 w-5" style={{ color: '#E85D27' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Distribusi Produk per Kategori</h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{stats.totalProducts} produk total</p>
            </div>
          </div>
          <div className="p-5 space-y-3">
            {loading ? (
              <div className="py-10 text-center" style={{ color: 'var(--text-secondary)' }}>Memuat...</div>
            ) : stats.categoryDistribution.length === 0 ? (
              <div className="py-10 text-center" style={{ color: 'var(--text-secondary)' }}>
                <Layers className="h-10 w-10 opacity-20 mx-auto mb-2" />
                <p className="text-sm">Belum ada kategori</p>
              </div>
            ) : (
              stats.categoryDistribution.map(cat => {
                const v = getCategoryVisual(cat.name)
                const Icon = v.icon
                const pct = (cat.count / maxCatCount) * 100
                return (
                  <div key={cat.name} className="flex items-center gap-3 group">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: v.iconBg, border: `1px solid ${v.iconBorder}` }}>
                      <Icon className="h-4 w-4" style={{ color: v.iconColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-white truncate">{cat.name}</span>
                        <span className="text-xs font-bold" style={{ color: v.iconColor }}>{cat.count} produk</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: `linear-gradient(to right, ${v.iconColor}, ${v.iconColor}cc)`, boxShadow: `0 0 10px ${v.iconBg}` }} />
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>

        {/* Recent Transactions compact */}
        <Card className="border overflow-hidden backdrop-blur-sm rounded-2xl" style={{ background: 'var(--bg-card)', borderColor: 'rgba(255,107,53,0.12)' }}>
          <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,107,53,0.1)', background: 'rgba(255,107,53,0.03)' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.2)' }}>
                <TrendingUp className="h-5 w-5" style={{ color: '#FF6B35' }} />
              </div>
              <h2 className="text-sm font-bold text-white">Transaksi Terbaru</h2>
            </div>
            <Badge className="font-bold rounded-lg px-2.5" style={{ background: 'var(--bg-surface)', border: '1px solid rgba(255,107,53,0.2)', color: 'var(--text-secondary)' }}>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      Memuat data...
                    </TableCell>
                  </TableRow>
                ) : recentTxns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>
                      Belum ada transaksi
                    </TableCell>
                  </TableRow>
                ) : (
                  recentTxns.slice(0, 6).map((txn) => (
                    <TableRow key={txn.id} className="group transition-colors border-b" style={{ borderColor: 'rgba(255,107,53,0.06)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,107,53,0.04)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <TableCell className="font-mono text-xs font-bold" style={{ color: '#FF6B35' }}>
                        {txn.invoice_number}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-slate-200">
                        {txn.profiles?.full_name || txn.profiles?.email || '—'}
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={getPaymentBadgeStyle(txn.payment_method)}>
                          {paymentLabel(txn.payment_method)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-black text-xs text-slate-100">
                        Rp {Number(txn.total_amount).toLocaleString('id-ID')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  )
}
