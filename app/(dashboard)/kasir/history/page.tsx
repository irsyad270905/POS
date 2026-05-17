'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Receipt, Search, Eye } from 'lucide-react'

type Transaction = {
  id: string; invoice_number: string; subtotal: number; tax_amount: number
  total_amount: number; payment_method: string; amount_paid: number
  change_amount: number; created_at: string
}

type TransactionItem = {
  id: string; product_name: string; quantity: number; price_at_time: number
}

export default function KasirHistoryPage() {
  const supabase = createClient()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [detailTxn, setDetailTxn] = useState<Transaction | null>(null)
  const [detailItems, setDetailItems] = useState<TransactionItem[]>([])

  useEffect(() => { fetchMyTransactions() }, [])

  const fetchMyTransactions = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('cashier_id', user.id)
      .order('created_at', { ascending: false })
    setTransactions(data || [])
    setLoading(false)
  }

  const openDetail = async (txn: Transaction) => {
    setDetailTxn(txn)
    const { data } = await supabase.from('transaction_items').select('*').eq('transaction_id', txn.id)
    setDetailItems(data || [])
  }

  const filtered = transactions.filter(t => t.invoice_number.toLowerCase().includes(search.toLowerCase()))

  const paymentLabel = (m: string) => {
    switch (m) { case 'cash': return 'Tunai'; case 'qris': return 'QRIS'; case 'transfer': return 'Transfer'; default: return m }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Riwayat Transaksi Saya</h1>
        <p className="text-muted-foreground">Daftar transaksi yang telah Anda lakukan.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cari nomor invoice..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card className="border-0 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50/50 dark:bg-zinc-800/30">
                <TableHead>Invoice</TableHead>
                <TableHead>Metode</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Dibayar</TableHead>
                <TableHead className="text-right">Kembalian</TableHead>
                <TableHead className="text-right">Waktu</TableHead>
                <TableHead className="text-center w-[80px]">Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16">
                    <Receipt className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
                    <p className="text-muted-foreground">Belum ada transaksi</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(t => (
                  <TableRow key={t.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/20">
                    <TableCell className="font-mono text-sm font-bold text-violet-700 dark:text-violet-400">{t.invoice_number}</TableCell>
                    <TableCell><Badge variant="outline">{paymentLabel(t.payment_method)}</Badge></TableCell>
                    <TableCell className="text-right font-bold">Rp {Number(t.total_amount).toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-right text-sm">Rp {Number(t.amount_paid).toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-right text-sm">Rp {Number(t.change_amount).toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {new Date(t.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(t)}>
                        <Eye className="h-4 w-4" />
                      </Button>
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Detail Transaksi</DialogTitle></DialogHeader>
          {detailTxn && (
            <div className="space-y-4">
              <div className="text-center p-3 rounded-xl bg-violet-50 dark:bg-violet-950/30">
                <p className="font-mono font-bold text-violet-700 dark:text-violet-400 text-lg">{detailTxn.invoice_number}</p>
                <p className="text-xs text-muted-foreground">{new Date(detailTxn.created_at).toLocaleString('id-ID')}</p>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-zinc-50 dark:bg-zinc-800/50">
                      <TableHead className="text-xs">Produk</TableHead>
                      <TableHead className="text-xs text-center">Qty</TableHead>
                      <TableHead className="text-xs text-right">Harga</TableHead>
                      <TableHead className="text-xs text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailItems.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm">{item.product_name}</TableCell>
                        <TableCell className="text-center text-sm">{item.quantity}</TableCell>
                        <TableCell className="text-right text-sm">Rp {Number(item.price_at_time).toLocaleString('id-ID')}</TableCell>
                        <TableCell className="text-right text-sm font-medium">Rp {(item.quantity * Number(item.price_at_time)).toLocaleString('id-ID')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-1 text-sm border-t pt-3">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>Rp {Number(detailTxn.subtotal).toLocaleString('id-ID')}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">PPN (11%)</span><span>Rp {Number(detailTxn.tax_amount).toLocaleString('id-ID')}</span></div>
                <div className="flex justify-between font-bold text-base border-t pt-2 mt-2"><span>Total</span><span>Rp {Number(detailTxn.total_amount).toLocaleString('id-ID')}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Dibayar ({paymentLabel(detailTxn.payment_method)})</span><span>Rp {Number(detailTxn.amount_paid).toLocaleString('id-ID')}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Kembalian</span><span>Rp {Number(detailTxn.change_amount).toLocaleString('id-ID')}</span></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
