'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Receipt, Search, Eye, Trash2, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'

type Transaction = {
  id: string
  invoice_number: string
  subtotal: number
  tax_amount: number
  total_amount: number
  payment_method: string
  amount_paid: number
  change_amount: number
  created_at: string
  profiles: { full_name: string | null; email: string } | null
}

type TransactionItem = {
  id: string; product_name: string; quantity: number; price_at_time: number
}

export default function AdminTransactionsPage() {
  const supabase = createClient()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPayment, setFilterPayment] = useState('all')
  const [filterDate, setFilterDate] = useState('all')
  const [detailTxn, setDetailTxn] = useState<Transaction | null>(null)
  const [detailItems, setDetailItems] = useState<TransactionItem[]>([])

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('transactions')
      .select('*, profiles(full_name, email)')
      .order('created_at', { ascending: false })
    setTransactions((data as unknown as Transaction[]) || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    let active = true
    setTimeout(() => {
      if (active) fetchTransactions()
    }, 0)
    return () => { active = false }
  }, [fetchTransactions])

  const openDetail = async (txn: Transaction) => {
    setDetailTxn(txn)
    const { data } = await supabase
      .from('transaction_items')
      .select('*')
      .eq('transaction_id', txn.id)
    setDetailItems(data || [])
  }

  const filtered = transactions.filter(t => {
    const matchSearch = t.invoice_number.toLowerCase().includes(search.toLowerCase())
    const matchPayment = filterPayment === 'all' || t.payment_method === filterPayment
    let matchDate = true
    if (filterDate !== 'all') {
      const txDate = new Date(t.created_at)
      const now = new Date()
      if (filterDate === 'today') {
        matchDate = txDate.toDateString() === now.toDateString()
      } else if (filterDate === 'yesterday') {
        const yesterday = new Date(now)
        yesterday.setDate(yesterday.getDate() - 1)
        matchDate = txDate.toDateString() === yesterday.toDateString()
      } else if (filterDate === 'this_month') {
        matchDate = txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear()
      }
    }
    return matchSearch && matchPayment && matchDate
  })

  const exportToExcel = () => {
    const headers = ['Invoice', 'Kasir', 'Metode Pembayaran', 'Total', 'Waktu']
    const rows = filtered.map(t => [
      t.invoice_number,
      t.profiles?.full_name || t.profiles?.email || '',
      paymentLabel(t.payment_method),
      t.total_amount,
      new Date(t.created_at).toLocaleString('id-ID').replace(',', '')
    ])
    const worksheetData = [headers, ...rows]
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Transaksi')
    const maxLens = headers.map((h, i) => Math.max(h.length, ...rows.map(row => String(row[i] || '').length)))
    worksheet['!cols'] = maxLens.map(len => ({ wch: len + 3 }))
    XLSX.writeFile(workbook, `Laporan_Transaksi_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.xlsx`)
    toast.success('Laporan Excel berhasil diunduh! 📊')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus transaksi ini? Stok produk akan dikembalikan secara otomatis.')) return
    try {
      const { error } = await supabase.rpc('delete_transaction', { p_transaction_id: id })
      if (error) throw error
      toast.success('Transaksi berhasil dihapus dan stok dikembalikan.')
      setDetailTxn(null)
      fetchTransactions()
    } catch (err: unknown) {
      toast.error('Gagal menghapus: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  const paymentLabel = (m: string) => {
    switch (m) { case 'cash': return 'Tunai'; case 'qris': return 'QRIS'; case 'transfer': return 'Transfer'; default: return m }
  }

  const getPaymentBadge = (method: string) => {
    switch (method) {
      case 'cash': return 'badge-success'
      case 'qris': return 'badge-warning'
      default: return 'badge-danger'
    }
  }

  const now = new Date()
  const todayTxns = transactions.filter(t => new Date(t.created_at).toDateString() === now.toDateString())
  const totalToday = todayTxns.reduce((sum, t) => sum + Number(t.total_amount), 0)
  const avgTxn = transactions.length > 0 ? (transactions.reduce((sum, t) => sum + Number(t.total_amount), 0) / transactions.length) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Riwayat Transaksi</h1>
        <p className="text-sm text-[var(--text-secondary)]">Seluruh transaksi dari semua kasir.</p>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 rounded-2xl bg-[var(--bg-card)]/40 border border-[var(--border)] backdrop-blur-sm items-center">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Total Hari Ini</p>
          <p className="text-xl font-bold text-[var(--success)]">Rp {totalToday.toLocaleString('id-ID')}</p>
        </div>
        <div className="w-px h-8 bg-[var(--border)] hidden md:block justify-self-center" />
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Rata-rata Transaksi</p>
          <p className="text-xl font-bold text-[var(--accent-primary)]">Rp {Math.round(avgTxn).toLocaleString('id-ID')}</p>
        </div>
        <div className="w-px h-8 bg-[var(--border)] hidden md:block justify-self-center" />
        <div className="col-span-2 md:col-span-1 space-y-1">
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Total Transaksi</p>
          <p className="text-xl font-bold text-white">{transactions.length}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]" />
          <Input
            placeholder="Cari nomor invoice..."
            className="pl-9 bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-primary)] focus-visible:ring-[var(--accent-primary)] focus-visible:border-[var(--accent-primary)] rounded-xl h-11"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterDate} onValueChange={(val) => setFilterDate(val || 'all')}>
          <SelectTrigger className="w-full sm:w-40 bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-primary)] rounded-xl h-11">
            <SelectValue>
              {filterDate === 'all' && 'Semua Waktu'}
              {filterDate === 'today' && 'Hari Ini'}
              {filterDate === 'yesterday' && 'Kemarin'}
              {filterDate === 'this_month' && 'Bulan Ini'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-[var(--bg-surface)] border-[var(--border)]">
            <SelectItem value="all" className="hover:bg-[var(--bg-card-hover)]">Semua Waktu</SelectItem>
            <SelectItem value="today" className="hover:bg-[var(--bg-card-hover)]">Hari Ini</SelectItem>
            <SelectItem value="yesterday" className="hover:bg-[var(--bg-card-hover)]">Kemarin</SelectItem>
            <SelectItem value="this_month" className="hover:bg-[var(--bg-card-hover)]">Bulan Ini</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPayment} onValueChange={(val) => setFilterPayment(val || 'all')}>
          <SelectTrigger className="w-full sm:w-40 bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-primary)] rounded-xl h-11">
            <SelectValue>
              {filterPayment === 'all' && 'Semua Metode'}
              {filterPayment === 'cash' && 'Tunai'}
              {filterPayment === 'qris' && 'QRIS'}
              {filterPayment === 'transfer' && 'Transfer'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-[var(--bg-surface)] border-[var(--border)]">
            <SelectItem value="all" className="hover:bg-[var(--bg-card-hover)]">Semua Metode</SelectItem>
            <SelectItem value="cash" className="hover:bg-[var(--bg-card-hover)]">Tunai</SelectItem>
            <SelectItem value="qris" className="hover:bg-[var(--bg-card-hover)]">QRIS</SelectItem>
            <SelectItem value="transfer" className="hover:bg-[var(--bg-card-hover)]">Transfer</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportToExcel} className="gap-2 shrink-0 border border-[var(--border)] bg-[var(--bg-card)] text-slate-200 hover:bg-[var(--bg-card-hover)] hover:text-white rounded-xl h-11 px-4 font-semibold text-sm transition-colors">
          <FileSpreadsheet className="h-4 w-4 text-[var(--success)]" /> Export Excel
        </Button>
      </div>

      <Card className="border border-[var(--border)] shadow-md overflow-hidden bg-[var(--bg-card)]/50 backdrop-blur-sm rounded-2xl">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[var(--bg-card)] border-b border-[var(--border)]">
                <TableHead className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Invoice</TableHead>
                <TableHead className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Kasir</TableHead>
                <TableHead className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Metode</TableHead>
                <TableHead className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider text-right">Total</TableHead>
                <TableHead className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider text-right">Waktu</TableHead>
                <TableHead className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider text-center w-[100px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-[var(--text-secondary)] font-semibold">Memuat...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16">
                    <div className="inline-flex p-4 rounded-full bg-slate-800/30 border border-slate-700/30 shadow-inner mb-3">
                      <Receipt className="h-14 w-14 text-[var(--text-secondary)] opacity-40" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Tidak Ada Transaksi</h3>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">Transaksi penjualan belum tersedia untuk filter terpilih.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((t) => (
                  <TableRow key={t.id} className="group hover:bg-[var(--bg-card-hover)]/30 transition-colors border-b border-[var(--border)] even:bg-[var(--bg-card)]/10">
                    <TableCell className="font-mono text-sm font-bold text-[var(--accent-primary)]">{t.invoice_number}</TableCell>
                    <TableCell className="text-sm font-semibold text-slate-200">{t.profiles?.full_name || t.profiles?.email || '—'}</TableCell>
                    <TableCell>
                      <span className={getPaymentBadge(t.payment_method)}>{paymentLabel(t.payment_method)}</span>
                    </TableCell>
                    <TableCell className="text-right font-black text-slate-100">
                      Rp {Number(t.total_amount).toLocaleString('id-ID')}
                    </TableCell>
                    <TableCell className="text-right text-xs text-[var(--text-secondary)] group-hover:text-slate-200 transition-colors">
                      {new Date(t.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1.5">
                        <Button variant="ghost" size="icon"
                          className="h-8 w-8 text-[var(--info)] hover:text-white hover:bg-[var(--info)]/20 transition-all rounded-lg active:scale-90 border border-transparent hover:border-[var(--info)]/30"
                          onClick={() => openDetail(t)} title="Detail Transaksi">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon"
                          className="h-8 w-8 text-[var(--danger)] hover:text-white hover:bg-[var(--danger)]/20 transition-all rounded-lg active:scale-90 border border-transparent hover:border-[var(--danger)]/30"
                          onClick={() => handleDelete(t.id)} title="Hapus Transaksi">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailTxn} onOpenChange={(o) => { if (!o) setDetailTxn(null) }}>
        <DialogContent className="sm:max-w-lg bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white font-bold text-lg">Detail Transaksi</DialogTitle>
          </DialogHeader>
          {detailTxn && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded-xl p-3.5">
                <div className="text-[var(--text-secondary)] font-medium">Invoice</div>
                <div className="font-mono font-bold text-[var(--accent-primary)]">{detailTxn.invoice_number}</div>
                <div className="text-[var(--text-secondary)] font-medium">Kasir</div>
                <div className="font-semibold text-slate-200">{detailTxn.profiles?.full_name || '—'}</div>
                <div className="text-[var(--text-secondary)] font-medium">Metode</div>
                <div><span className={getPaymentBadge(detailTxn.payment_method)}>{paymentLabel(detailTxn.payment_method)}</span></div>
                <div className="text-[var(--text-secondary)] font-medium">Waktu</div>
                <div className="text-slate-200">{new Date(detailTxn.created_at).toLocaleString('id-ID')}</div>
              </div>

              <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--bg-card)]/40">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[var(--bg-card)] border-b border-[var(--border)]">
                      <TableHead className="text-xs font-bold text-[var(--text-secondary)]">Produk</TableHead>
                      <TableHead className="text-xs font-bold text-[var(--text-secondary)] text-center">Qty</TableHead>
                      <TableHead className="text-xs font-bold text-[var(--text-secondary)] text-right">Harga</TableHead>
                      <TableHead className="text-xs font-bold text-[var(--text-secondary)] text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailItems.map(item => (
                      <TableRow key={item.id} className="border-b border-[var(--border)]/40 hover:bg-[var(--bg-card-hover)]/20 transition-colors">
                        <TableCell className="text-sm font-semibold text-slate-200">{item.product_name}</TableCell>
                        <TableCell className="text-center text-sm font-bold text-slate-300">{item.quantity}</TableCell>
                        <TableCell className="text-right text-sm text-[var(--text-secondary)]">Rp {Number(item.price_at_time).toLocaleString('id-ID')}</TableCell>
                        <TableCell className="text-right text-sm font-black text-white">Rp {(item.quantity * Number(item.price_at_time)).toLocaleString('id-ID')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-1.5 text-sm border-t border-[var(--border)] pt-3.5">
                <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Subtotal</span><span className="text-slate-200">Rp {Number(detailTxn.subtotal).toLocaleString('id-ID')}</span></div>
                <div className="flex justify-between font-bold text-base border-t border-[var(--border)] pt-2.5 mt-2.5 text-white">
                  <span>Total</span>
                  <span className="font-black text-xl text-[var(--accent-primary)]">Rp {Number(detailTxn.total_amount).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Dibayar</span><span className="text-slate-200">Rp {Number(detailTxn.amount_paid).toLocaleString('id-ID')}</span></div>
                <div className="flex justify-between font-bold text-[var(--success)]"><span>Kembalian</span><span>Rp {Number(detailTxn.change_amount).toLocaleString('id-ID')}</span></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
