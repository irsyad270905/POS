'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Receipt, Search, Eye } from 'lucide-react'
import { useKasirTransactions, useTransactionItems } from '@/lib/queries/transactions'
import type { KasirTransaction } from '@/lib/queries/transactions'

export default function KasirHistoryPage() {
  const { data: transactions = [], isLoading: loading } = useKasirTransactions()
  const [search, setSearch] = useState('')
  const [filterDate, setFilterDate] = useState('all')
  const [detailTxn, setDetailTxn] = useState<KasirTransaction | null>(null)
  const { data: detailItems = [] } = useTransactionItems(detailTxn?.id ?? null)

  const openDetail = (txn: KasirTransaction) => setDetailTxn(txn)

  const filtered = transactions.filter(t => {
    const matchSearch = t.invoice_number.toLowerCase().includes(search.toLowerCase())
    let matchDate = true
    if (filterDate !== 'all') {
      const txDate = new Date(t.created_at)
      const now = new Date()
      if (filterDate === 'today') matchDate = txDate.toDateString() === now.toDateString()
      else if (filterDate === 'yesterday') { const y = new Date(now); y.setDate(y.getDate() - 1); matchDate = txDate.toDateString() === y.toDateString() }
      else if (filterDate === 'this_month') matchDate = txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear()
    }
    return matchSearch && matchDate
  })

  const paymentLabel = (m: string) => m === 'cash' ? 'Tunai' : m === 'qris' ? 'QRIS' : m === 'transfer' ? 'Transfer' : m
  const getPaymentBadge = (method: string) => method === 'cash' ? 'badge-success' : method === 'qris' ? 'badge-warning' : 'badge-danger'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Riwayat Transaksi Saya</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Daftar transaksi yang telah Anda lakukan.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          <Input
            placeholder="Cari nomor invoice..."
            className="pl-10 h-11 rounded-xl border-0 focus-visible:ring-1"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--border)' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterDate} onValueChange={(val) => setFilterDate(val || 'all')}>
          <SelectTrigger className="w-full sm:w-48 h-11 rounded-xl border-0" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
            <SelectValue placeholder="Semua Waktu">
              {filterDate === 'all' && 'Semua Waktu'}
              {filterDate === 'today' && 'Hari Ini'}
              {filterDate === 'yesterday' && 'Kemarin'}
              {filterDate === 'this_month' && 'Bulan Ini'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}>
            <SelectItem value="all">Semua Waktu</SelectItem>
            <SelectItem value="today">Hari Ini</SelectItem>
            <SelectItem value="yesterday">Kemarin</SelectItem>
            <SelectItem value="this_month">Bulan Ini</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-0 overflow-hidden rounded-2xl shadow-xl" style={{ background: 'var(--bg-card)', boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 0 0 1px var(--border)' }}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b hover:bg-transparent" style={{ background: 'rgba(255,107,53,0.04)', borderColor: 'var(--border)' }}>
                <TableHead className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Invoice</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Metode</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-right" style={{ color: 'var(--text-secondary)' }}>Total</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-right" style={{ color: 'var(--text-secondary)' }}>Dibayar</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-right" style={{ color: 'var(--text-secondary)' }}>Kembalian</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-right" style={{ color: 'var(--text-secondary)' }}>Waktu</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-center w-[70px]" style={{ color: 'var(--text-secondary)' }}>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 font-medium" style={{ color: 'var(--text-secondary)' }}>Memuat...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16">
                    <div className="inline-flex p-4 rounded-full mb-3" style={{ background: 'rgba(255,107,53,0.08)', border: '1px solid var(--border)' }}>
                      <Receipt className="h-10 w-10 opacity-40" style={{ color: '#ff6b35' }} />
                    </div>
                    <h3 className="text-base font-bold text-white">Tidak Ada Transaksi</h3>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Anda belum mencatat penjualan.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(t => (
                  <TableRow key={t.id} className="border-b hover:bg-white/[0.02] transition-colors" style={{ borderColor: 'var(--border)' }}>
                    <TableCell className="font-mono text-sm font-bold" style={{ color: '#ff8c42' }}>{t.invoice_number}</TableCell>
                    <TableCell><span className={getPaymentBadge(t.payment_method)}>{paymentLabel(t.payment_method)}</span></TableCell>
                    <TableCell className="text-right font-black text-white">Rp {Number(t.total_amount).toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-right text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Rp {Number(t.amount_paid).toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-right text-sm font-bold" style={{ color: '#6ee7b7' }}>Rp {Number(t.change_amount).toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-right text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(t.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</TableCell>
                    <TableCell><div className="flex justify-center"><Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg border-0 hover:bg-white/5" style={{ color: '#ffb86a' }} onClick={() => openDetail(t)}><Eye className="h-4 w-4" /></Button></div></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!detailTxn} onOpenChange={(o) => { if (!o) setDetailTxn(null) }}>
        <DialogContent className="sm:max-w-lg rounded-2xl border-0 shadow-2xl" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
          <DialogHeader><DialogTitle className="text-white font-bold text-lg">Detail Transaksi</DialogTitle></DialogHeader>
          {detailTxn && (
            <div className="space-y-4">
              <div className="text-center p-3.5 rounded-xl" style={{ background: 'var(--bg-card)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
                <p className="font-mono font-bold text-lg" style={{ color: '#ff8c42' }}>{detailTxn.invoice_number}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{new Date(detailTxn.created_at).toLocaleString('id-ID')}</p>
              </div>
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
                <Table>
                  <TableHeader><TableRow className="hover:bg-transparent border-b" style={{ borderColor: 'var(--border)', background: 'rgba(255,107,53,0.03)' }}><TableHead className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Produk</TableHead><TableHead className="text-xs font-bold text-center" style={{ color: 'var(--text-secondary)' }}>Qty</TableHead><TableHead className="text-xs font-bold text-right" style={{ color: 'var(--text-secondary)' }}>Harga</TableHead><TableHead className="text-xs font-bold text-right" style={{ color: 'var(--text-secondary)' }}>Subtotal</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {detailItems.map(item => (
                      <TableRow key={item.id} className="border-b hover:bg-white/[0.02]" style={{ borderColor: 'var(--border)' }}>
                        <TableCell className="text-sm font-semibold text-white">{item.product_name}</TableCell>
                        <TableCell className="text-center font-bold text-white/80">{item.quantity}</TableCell>
                        <TableCell className="text-right text-sm" style={{ color: 'var(--text-muted)' }}>Rp {Number(item.price_at_time).toLocaleString('id-ID')}</TableCell>
                        <TableCell className="text-right font-black text-white">Rp {(item.quantity * Number(item.price_at_time)).toLocaleString('id-ID')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-1.5 text-sm border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>Subtotal</span><span className="text-white">Rp {Number(detailTxn.subtotal).toLocaleString('id-ID')}</span></div>
                <div className="flex justify-between font-bold border-t pt-2 mt-2" style={{ borderColor: 'var(--border)' }}><span className="text-white">Total</span><span className="font-black text-lg" style={{ color: '#ff6b35' }}>Rp {Number(detailTxn.total_amount).toLocaleString('id-ID')}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>Dibayar ({paymentLabel(detailTxn.payment_method)})</span><span className="font-semibold text-white">Rp {Number(detailTxn.amount_paid).toLocaleString('id-ID')}</span></div>
                <div className="flex justify-between font-bold" style={{ color: '#6ee7b7' }}><span>Kembalian</span><span>Rp {Number(detailTxn.change_amount).toLocaleString('id-ID')}</span></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
