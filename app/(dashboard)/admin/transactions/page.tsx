'use client'

export const dynamic = 'force-dynamic'

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Receipt, Search, Eye, Trash2, FileSpreadsheet, Boxes, Calculator, Calendar as CalendarIcon } from 'lucide-react'
import * as XLSX from 'xlsx'
import { createClient } from '@/utils/supabase/client'
import { useAdminTransactions, useTransactionItems, useDeleteTransaction, useBulkTransactionItems } from '@/lib/queries/transactions'
import { useProducts } from '@/lib/queries/products'
import { getCategoryVisual } from '@/lib/categoryVisual'
import type { AdminTransaction } from '@/lib/queries/transactions'

export default function AdminTransactionsPage() {
  const { data: transactions = [], isLoading: loading } = useAdminTransactions()
  const { data: products = [] } = useProducts()
  const [search, setSearch] = useState('')
  const [filterPayment, setFilterPayment] = useState('all')
  const [filterDate, setFilterDate] = useState('all') // all | YYYY-MM-DD
  const [detailTxn, setDetailTxn] = useState<AdminTransaction | null>(null)
  const { data: detailItems = [] } = useTransactionItems(detailTxn?.id ?? null)
  const deleteTransaction = useDeleteTransaction()

  const openDetail = (txn: AdminTransaction) => {
    setDetailTxn(txn)
  }

  const filtered = transactions.filter(t => {
    const matchSearch = t.invoice_number.toLowerCase().includes(search.toLowerCase())
    const matchPayment = filterPayment === 'all' || t.payment_method === filterPayment
    let matchDate = true
    if (filterDate !== 'all') {
      // jika format YYYY-MM-DD (dari kalender), cocokkan tanggal persis
      if (/^\d{4}-\d{2}-\d{2}$/.test(filterDate)) {
        const key = new Date(t.created_at).toISOString().slice(0, 10)
        matchDate = key === filterDate
      } else {
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
    }
    return matchSearch && matchPayment && matchDate
  })

  // ---- per-kategori & overall barang summary for filtered set ----
  const filteredIds = useMemo(() => filtered.map(t => t.id), [filtered])
  const { data: bulkItems = [], isLoading: bulkLoading } = useBulkTransactionItems(filteredIds)

  const productCategoryMap = useMemo(() => {
    const m = new Map<string, string>()
    products.forEach(p => {
      if (p.id && p.categories?.name) m.set(p.id, p.categories.name)
      else if (p.id && p.category_id) m.set(p.id, 'Tanpa Kategori')
    })
    return m
  }, [products])

  const { perCategory, overallBarang, overallQtyByTxn } = useMemo(() => {
    if (bulkLoading || bulkItems.length === 0) {
      // still compute category from filtered alone if no bulk (fallback 0)
      return { perCategory: [] as { name: string; qty: number; total: number; txns: number }[], overallBarang: 0, overallQtyByTxn: 0 }
    }
    const catMap = new Map<string, { qty: number; total: number; txns: Set<string> }>()
    let totalQty = 0
    bulkItems.forEach(item => {
      const cat = (item.product_id && productCategoryMap.get(item.product_id)) || 'Lainnya'
      const qty = Number(item.quantity) || 0
      const total = qty * Number(item.price_at_time || 0)
      totalQty += qty
      const cur = catMap.get(cat) || { qty: 0, total: 0, txns: new Set<string>() }
      cur.qty += qty
      cur.total += total
      if (item.transaction_id) cur.txns.add(item.transaction_id)
      catMap.set(cat, cur)
    })
    const perCat = Array.from(catMap.entries())
      .map(([name, v]) => ({ name, qty: v.qty, total: v.total, txns: v.txns.size }))
      .sort((a, b) => b.total - a.total)
    return { perCategory: perCat, overallBarang: totalQty, overallQtyByTxn: perCat.reduce((a, c) => a + c.qty, 0) }
  }, [bulkItems, bulkLoading, productCategoryMap])

  const totalPendapatanFiltered = useMemo(() => filtered.reduce((s, t) => s + Number(t.total_amount), 0), [filtered])
  const avgPerTxn = filtered.length ? totalPendapatanFiltered / filtered.length : 0
  const avgBarangPerTxn = filtered.length ? overallBarang / filtered.length : 0

  const exportToExcel = async () => {
    if (filtered.length === 0) {
      toast.error('Tidak ada data untuk diekspor')
      return
    }
    try {
      // fetch fresh items for export (to handle race where bulkItems still loading)
      const supabase = createClient()
      let exportItems: { product_id: string | null; product_name: string; quantity: number; price_at_time: number; transaction_id: string }[] = []
      if (filteredIds.length > 0) {
        const chunkSize = 900
        for (let i = 0; i < filteredIds.length; i += chunkSize) {
          const chunk = filteredIds.slice(i, i + chunkSize)
          const { data, error } = await supabase
            .from('transaction_items')
            .select('product_id, product_name, quantity, price_at_time, transaction_id')
            .in('transaction_id', chunk)
          if (error) throw new Error(error.message)
          exportItems.push(...(data as typeof exportItems))
        }
      }
      // compute per-kategori for export (independent from hook, uses same product map)
      const catMap = new Map<string, { qty: number; total: number }>()
      let totalBarangExport = 0
      exportItems.forEach(it => {
        const cat = (it.product_id && productCategoryMap.get(it.product_id)) || 'Lainnya'
        const qty = Number(it.quantity) || 0
        const tot = qty * Number(it.price_at_time || 0)
        totalBarangExport += qty
        const cur = catMap.get(cat) || { qty: 0, total: 0 }
        cur.qty += qty
        cur.total += tot
        catMap.set(cat, cur)
      })
      const perCatExport = Array.from(catMap.entries()).map(([name, v]) => ({ name, qty: v.qty, total: v.total })).sort((a, b) => b.total - a.total)

      // helpers for styling
      const headerStyle = {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
        fill: { fgColor: { rgb: 'FF6B35' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
          top: { style: 'thin', color: { rgb: 'E85D27' } },
          bottom: { style: 'thin', color: { rgb: 'E85D27' } },
          left: { style: 'thin', color: { rgb: 'E85D27' } },
          right: { style: 'thin', color: { rgb: 'E85D27' } },
        },
      } as const
      const totalStyle = {
        font: { bold: true, color: { rgb: '7C2D12' }, sz: 11 },
        fill: { fgColor: { rgb: 'FFF7ED' } },
        border: {
          top: { style: 'medium', color: { rgb: 'FF6B35' } },
          bottom: { style: 'medium', color: { rgb: 'FF6B35' } },
          left: { style: 'thin', color: { rgb: 'FF6B3533' } },
          right: { style: 'thin', color: { rgb: 'FF6B3533' } },
        },
      } as const
      const applyHeader = (ws: XLSX.WorkSheet, cols: number) => {
        for (let c = 0; c < cols; c++) {
          const addr = XLSX.utils.encode_cell({ r: 0, c })
          if (!ws[addr]) continue
          // @ts-ignore style
          ws[addr].s = headerStyle
        }
      }
      const applyTotalRow = (ws: XLSX.WorkSheet, row: number, cols: number) => {
        for (let c = 0; c < cols; c++) {
          const addr = XLSX.utils.encode_cell({ r: row, c })
          if (!ws[addr]) ws[addr] = { v: '', t: 's' } as XLSX.CellObject
          // @ts-ignore
          ws[addr].s = totalStyle
        }
      }

      // Sheet 1: Daftar Barang Terjual (detail per produk) + rekap kategori di bawah
      // Kolom diminta: nama produk,kategori,kasir,metode,hari,jam (ditambah No/Qty/Subtotal agar logis)
      const h1 = ['No', 'Nama Produk', 'Kategori', 'Kasir', 'Metode', 'Hari', 'Jam', 'Qty', 'Subtotal (Rp)']
      const txnMap = new Map(filtered.map(t => [t.id, t]))
      const rows1 = exportItems.map((it, idx) => {
        const txn = txnMap.get(it.transaction_id) as typeof filtered[number] | undefined
        const cat = (it.product_id && productCategoryMap.get(it.product_id)) || 'Lainnya'
        const kasir = txn?.profiles?.full_name || txn?.profiles?.email || ''
        const metode = txn ? paymentLabel(txn.payment_method) : ''
        const d = txn ? new Date(txn.created_at) : null
        const hari = d ? d.toLocaleDateString('id-ID') : ''
        const jam = d ? d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':') : ''
        const qty = Number(it.quantity) || 0
        const subtotal = qty * Number(it.price_at_time || 0)
        return [idx + 1, it.product_name, cat, kasir, metode, hari, jam, qty, subtotal]
      })
      const totalQtyAll = rows1.reduce((a, r) => a + Number(r[7]), 0)
      const totalSubAll = rows1.reduce((a, r) => a + Number(r[8]), 0)
      const totalRow1 = ['', '', '', '', '', '', 'TOTAL', totalQtyAll, totalSubAll]

      // second table inline: rekap per kategori di bawah main table (jarak 2 baris kosong)
      const hCatInline = ['No', 'Kategori', 'Jumlah Barang', 'Total Pendapatan (Rp)']
      const catRowsInline = perCatExport.map((c, i) => [i + 1, c.name, c.qty, c.total])
      const totalCatQty = perCatExport.reduce((a, c) => a + c.qty, 0)
      const totalCatRp = perCatExport.reduce((a, c) => a + c.total, 0)
      const totalCatInline = ['', 'TOTAL', totalCatQty, totalCatRp]

      const wsData1: (string | number)[][] = [
        h1,
        ...rows1,
        totalRow1,
        [],
        [],
        ['Rekap per Kategori'],
        hCatInline,
        ...catRowsInline,
        totalCatInline,
      ]
      const ws1 = XLSX.utils.aoa_to_sheet(wsData1)
      // style header main (row 0) and header kategori (row = 1+rows1.length+3)
      const catHeaderRow = 1 + rows1.length + 1 + 2 + 1 // 0-indexed: h1 + rows + total + 2 empty + title + header
      for (let c = 0; c < h1.length; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c })
        if (ws1[addr]) ws1[addr].s = headerStyle as unknown as XLSX.CellObject['s']
      }
      for (let c = 0; c < hCatInline.length; c++) {
        const addr = XLSX.utils.encode_cell({ r: catHeaderRow, c })
        if (ws1[addr]) ws1[addr].s = headerStyle as unknown as XLSX.CellObject['s']
      }
      // total rows styling
      const mainTotalRow = 1 + rows1.length
      applyTotalRow(ws1, mainTotalRow, h1.length)
      const catTotalRow = wsData1.length - 1
      for (let c = 0; c < hCatInline.length; c++) {
        const addr = XLSX.utils.encode_cell({ r: catTotalRow, c })
        if (!ws1[addr]) ws1[addr] = { v: '', t: 's' } as XLSX.CellObject
        ws1[addr].s = totalStyle as unknown as XLSX.CellObject['s']
      }
      // title rekap
      const inlineTitleAddr = XLSX.utils.encode_cell({ r: catHeaderRow - 1, c: 0 })
      if (ws1[inlineTitleAddr]) ws1[inlineTitleAddr].s = { font: { bold: true, sz: 11, color: { rgb: 'FF6B35' } } } as unknown as XLSX.CellObject['s']
      ws1['!merges'] = [{ s: { r: catHeaderRow - 1, c: 0 }, e: { r: catHeaderRow - 1, c: 2 } }]
      // number formats
      for (let r = 1; r <= rows1.length; r++) {
        for (const col of [7, 8]) {
          const addr = XLSX.utils.encode_cell({ r, c: col })
          if (ws1[addr]) { ws1[addr].z = '#,##0'; (ws1[addr] as XLSX.CellObject).t = 'n' }
        }
      }
      for (let r = catHeaderRow + 1; r < wsData1.length; r++) {
        for (const col of [2, 3]) {
          const addr = XLSX.utils.encode_cell({ r, c: col })
          if (ws1[addr] && typeof ws1[addr].v === 'number') { ws1[addr].z = '#,##0'; (ws1[addr] as XLSX.CellObject).t = 'n' }
        }
      }
      ws1['!cols'] = [{ wch: 5 }, { wch: 26 }, { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 13 }, { wch: 10 }, { wch: 8 }, { wch: 18 }]
      ws1['!freeze'] = { xSplit: 0, ySplit: 1 }
      ws1['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: h1.length - 1 } }) }

      // Sheet 2: Rekap per Kategori
      const h2 = ['No', 'Kategori', 'Jumlah Barang', 'Total Pendapatan (Rp)', 'Jumlah Transaksi', 'Rata-rata / Barang (Rp)']
      const rows2 = perCatExport.map((c, i) => [
        i + 1,
        c.name,
        c.qty,
        c.total,
        // count txns for that category (recompute from exportItems)
        new Set(exportItems.filter(it => ((it.product_id && productCategoryMap.get(it.product_id)) || 'Lainnya') === c.name).map(it => it.transaction_id)).size,
        c.qty ? Math.round(c.total / c.qty) : 0,
      ])
      const totalQtyCat = perCatExport.reduce((a, c) => a + c.qty, 0)
      const totalCatPendapatan = perCatExport.reduce((a, c) => a + c.total, 0)
      const totalRow2 = ['', 'TOTAL', totalQtyCat, totalCatPendapatan, filtered.length, totalQtyCat ? Math.round(totalCatPendapatan / totalQtyCat) : 0]
      const wsData2 = [h2, ...rows2, totalRow2]
      const ws2 = XLSX.utils.aoa_to_sheet(wsData2)
      applyHeader(ws2, h2.length)
      applyTotalRow(ws2, wsData2.length - 1, h2.length)
      for (let r = 1; r < wsData2.length; r++) {
        for (const col of [2, 3, 5]) {
          const addr = XLSX.utils.encode_cell({ r, c: col })
          if (ws2[addr]) { ws2[addr].z = '#,##0'; (ws2[addr] as XLSX.CellObject).t = 'n' }
        }
      }
      ws2['!cols'] = [{ wch: 5 }, { wch: 22 }, { wch: 16 }, { wch: 22 }, { wch: 18 }, { wch: 20 }]
      ws2['!freeze'] = { xSplit: 0, ySplit: 1 }
      ws2['!autofilter'] = { ref: `A1:F${wsData2.length - 1}` }

      // Sheet 3: Ringkasan Keseluruhan
      const ringkasanRows: (string | number)[][] = [
        ['Ringkasan Laporan Transaksi', ''],
        ['Periode Filter', filterDate === 'all' ? 'Semua Waktu' : /^\d{4}-\d{2}-\d{2}$/.test(filterDate) ? new Date(filterDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : filterDate === 'today' ? 'Hari Ini' : filterDate === 'yesterday' ? 'Kemarin' : 'Bulan Ini'],
        ['Tanggal Ekspor', new Date().toLocaleString('id-ID')],
        ['', ''],
        ['Metrik', 'Nilai'],
        ['Total Transaksi', filtered.length],
        ['Total Barang Terjual', totalBarangExport],
        ['Total Pendapatan', totalPendapatanFiltered],
        ['Rata-rata per Transaksi', Math.round(avgPerTxn)],
        ['Rata-rata Barang / Transaksi', Number(avgBarangPerTxn.toFixed(1))],
        ['Jumlah Kategori Terjual', perCatExport.length],
        ['Metode Tunai', filtered.filter(t => t.payment_method === 'cash').length],
        ['Metode QRIS', filtered.filter(t => t.payment_method === 'qris').length],
        ['Metode Transfer', filtered.filter(t => t.payment_method === 'transfer').length],
      ]
      const ws3 = XLSX.utils.aoa_to_sheet(ringkasanRows)
      // style title
      const titleAddr = 'A1'
      if (ws3[titleAddr]) ws3[titleAddr].s = { font: { bold: true, sz: 14, color: { rgb: 'FF6B35' } } } as unknown as XLSX.CellObject['s']
      // header for table inside sheet
      const hdrAddrA = XLSX.utils.encode_cell({ r: 4, c: 0 })
      const hdrAddrB = XLSX.utils.encode_cell({ r: 4, c: 1 })
      if (ws3[hdrAddrA]) ws3[hdrAddrA].s = headerStyle as unknown as XLSX.CellObject['s']
      if (ws3[hdrAddrB]) ws3[hdrAddrB].s = headerStyle as unknown as XLSX.CellObject['s']
      for (let r = 5; r < ringkasanRows.length; r++) {
        const cAddr = XLSX.utils.encode_cell({ r, c: 1 })
        if (ws3[cAddr] && typeof ringkasanRows[r][1] === 'number') {
          ws3[cAddr].z = '#,##0'
          ;(ws3[cAddr] as XLSX.CellObject).t = 'n'
        }
      }
      ws3['!cols'] = [{ wch: 28 }, { wch: 26 }]
      ws3['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]
      // col widths and print setup
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws1, 'Laporan Transaksi')
      XLSX.utils.book_append_sheet(wb, ws2, 'Per Kategori')
      XLSX.utils.book_append_sheet(wb, ws3, 'Ringkasan')
      XLSX.writeFile(wb, `Laporan_Transaksi_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.xlsx`)
      toast.success('Laporan Excel berhasil diunduh — 3 sheet dengan rekap kategori & ringkasan 📊')
    } catch (e: unknown) {
      toast.error('Gagal ekspor: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus transaksi ini? Stok produk akan dikembalikan secara otomatis.')) return
    try {
      await deleteTransaction.mutateAsync(id)
      toast.success('Transaksi berhasil dihapus dan stok dikembalikan.')
      setDetailTxn(null)
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 rounded-2xl backdrop-blur-sm items-center" style={{ background: 'var(--bg-card)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
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
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          <Input
            placeholder="Cari nomor invoice..."
            className="pl-10 h-11 rounded-xl border-0 focus-visible:ring-1 text-sm"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--border)' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative flex items-center gap-2 shrink-0">
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
            <Input
              type="date"
              value={filterDate !== 'all' && /^\d{4}-\d{2}-\d{2}$/.test(filterDate) ? filterDate : ''}
              onChange={(e) => setFilterDate(e.target.value || 'all')}
              placeholder="Pilih tanggal"
              className="pl-9 pr-3 w-40 h-11 rounded-xl border-0 text-sm"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--border)', colorScheme: 'dark' }}
            />
          </div>
          {filterDate !== 'all' ? (
            <Button variant="ghost" size="sm" onClick={() => setFilterDate('all')} className="h-11 rounded-xl border-0 text-xs px-3" style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
              Semua
            </Button>
          ) : (
            <span className="hidden sm:inline text-xs px-2 py-1 rounded-full font-semibold" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Semua Waktu</span>
          )}
        </div>
        <Select value={filterPayment} onValueChange={(val) => setFilterPayment(val || 'all')}>
          <SelectTrigger className="w-full sm:w-40 h-11 rounded-xl border-0" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
            <SelectValue placeholder="Semua Metode" />
          </SelectTrigger>
          <SelectContent style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}>
            <SelectItem value="all">Semua Metode</SelectItem>
            <SelectItem value="cash">Tunai</SelectItem>
            <SelectItem value="qris">QRIS</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" onClick={exportToExcel} className="gap-2 shrink-0 border-0 rounded-xl h-11 px-4 font-semibold text-sm" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
          <FileSpreadsheet className="h-4 w-4" style={{ color: '#6ee7b7' }} /> Export Excel
        </Button>
      </div>

      {/* Ringkasan Keseluruhan + Per Kategori — tabel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Ringkasan Keseluruhan */}
        <Card className="border-0 overflow-hidden rounded-2xl shadow-xl" style={{ background: 'var(--bg-card)', boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 0 0 1px var(--border)' }}>
          <div className="p-4 border-b flex items-center gap-3" style={{ borderColor: 'var(--border)', background: 'rgba(255,107,53,0.04)' }}>
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.18)' }}>
              <Calculator className="h-4 w-4" style={{ color: '#6ee7b7' }} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Ringkasan Keseluruhan</h3>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{filtered.length} transaksi terfilter</p>
            </div>
          </div>
          <div className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b" style={{ borderColor: 'var(--border)', background: 'rgba(255,107,53,0.03)' }}>
                  <TableHead className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Metrik</TableHead>
                  <TableHead className="text-xs font-bold text-right" style={{ color: 'var(--text-secondary)' }}>Nilai</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <TableCell className="text-sm text-slate-200">Total Transaksi</TableCell>
                  <TableCell className="text-right font-bold text-white">{filtered.length}</TableCell>
                </TableRow>
                <TableRow className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <TableCell className="text-sm text-slate-200">Total Barang Terjual</TableCell>
                  <TableCell className="text-right font-bold text-white">{bulkLoading ? '...' : overallBarang.toLocaleString('id-ID')} pcs</TableCell>
                </TableRow>
                <TableRow className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <TableCell className="text-sm text-slate-200">Total Pendapatan</TableCell>
                  <TableCell className="text-right font-black" style={{ color: '#ff6b35' }}>Rp {totalPendapatanFiltered.toLocaleString('id-ID')}</TableCell>
                </TableRow>
                <TableRow className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <TableCell className="text-sm text-slate-200">Rata-rata / Transaksi</TableCell>
                  <TableCell className="text-right font-semibold text-slate-200">Rp {Math.round(avgPerTxn).toLocaleString('id-ID')}</TableCell>
                </TableRow>
                <TableRow style={{ borderColor: 'var(--border)' }}>
                  <TableCell className="text-sm text-slate-200">Rata-rata Barang / Transaksi</TableCell>
                  <TableCell className="text-right font-semibold text-slate-200">{avgBarangPerTxn.toFixed(1)} pcs</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Per Kategori */}
        <Card className="lg:col-span-2 border-0 overflow-hidden rounded-2xl shadow-xl" style={{ background: 'var(--bg-card)', boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 0 0 1px var(--border)' }}>
          <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)', background: 'rgba(255,107,53,0.04)' }}>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,107,53,0.12)', border: '1px solid rgba(255,107,53,0.18)' }}>
                <Boxes className="h-4 w-4" style={{ color: '#ff8c42' }} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Rekap per Kategori</h3>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Barang & pendapatan per kategori</p>
              </div>
            </div>
            {bulkLoading && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Memuat...</span>}
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b" style={{ borderColor: 'var(--border)', background: 'rgba(255,107,53,0.03)' }}>
                  <TableHead className="text-xs font-bold w-10" style={{ color: 'var(--text-secondary)' }}>No</TableHead>
                  <TableHead className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Kategori</TableHead>
                  <TableHead className="text-xs font-bold text-center" style={{ color: 'var(--text-secondary)' }}>Jml Barang</TableHead>
                  <TableHead className="text-xs font-bold text-right" style={{ color: 'var(--text-secondary)' }}>Total Pendapatan</TableHead>
                  <TableHead className="text-xs font-bold text-center" style={{ color: 'var(--text-secondary)' }}>Transaksi</TableHead>
                  <TableHead className="text-xs font-bold text-right" style={{ color: 'var(--text-secondary)' }}>% Pendapatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bulkLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>Memuat rekap...</TableCell></TableRow>
                ) : perCategory.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10" style={{ color: 'var(--text-secondary)' }}>{filtered.length === 0 ? 'Tidak ada transaksi terfilter' : 'Belum ada barang terjual pada periode ini'}</TableCell></TableRow>
                ) : (
                  <>
                    {perCategory.map((c, i) => {
                      const v = getCategoryVisual(c.name)
                      const Icon = v.icon
                      const pct = totalPendapatanFiltered ? (c.total / totalPendapatanFiltered) * 100 : 0
                      return (
                        <TableRow key={c.name} className="border-b hover:bg-white/[0.02]" style={{ borderColor: 'var(--border)' }}>
                          <TableCell className="text-xs text-slate-400">{i + 1}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                              <span className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: v.iconBg, border: `1px solid ${v.iconBorder}` }}>
                                <Icon className="h-3.5 w-3.5" style={{ color: v.iconColor }} />
                              </span>
                              {c.name}
                            </span>
                          </TableCell>
                          <TableCell className="text-center font-bold text-white">{c.qty.toLocaleString('id-ID')}</TableCell>
                          <TableCell className="text-right font-bold text-white">Rp {c.total.toLocaleString('id-ID')}</TableCell>
                          <TableCell className="text-center text-xs text-slate-300">{c.txns}</TableCell>
                          <TableCell className="text-right">
                            <span className="inline-flex items-center gap-1 font-bold text-xs px-2 py-1 rounded-full" style={{ background: v.iconBg, color: v.iconColor, border: `1px solid ${v.iconBorder}` }}>
                              {pct.toFixed(1)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    <TableRow className="font-black" style={{ background: 'rgba(255,107,53,0.06)', borderColor: 'var(--border)' }}>
                      <TableCell colSpan={2} className="text-sm text-white">TOTAL</TableCell>
                      <TableCell className="text-center text-white">{overallBarang.toLocaleString('id-ID')}</TableCell>
                      <TableCell className="text-right" style={{ color: '#ff6b35' }}>Rp {perCategory.reduce((a, c) => a + c.total, 0).toLocaleString('id-ID')}</TableCell>
                      <TableCell className="text-center text-white">{filtered.length}</TableCell>
                      <TableCell className="text-right text-white">100%</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <Card className="border-0 overflow-hidden rounded-2xl shadow-xl" style={{ background: 'var(--bg-card)', boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 0 0 1px var(--border)' }}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
                <TableRow className="bg-[var(--bg-card)] border-b" style={{ borderColor: 'var(--border)' }}>
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
                    <div className="inline-flex p-4 rounded-full mb-3" style={{ background: 'rgba(255,107,53,0.08)', border: '1px solid var(--border)' }}>
                      <Receipt className="h-14 w-14 text-[var(--text-secondary)] opacity-40" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Tidak Ada Transaksi</h3>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">Transaksi penjualan belum tersedia untuk filter terpilih.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((t) => (
                  <TableRow key={t.id} className="group border-b hover:bg-white/[0.02] transition-colors" style={{ borderColor: 'var(--border)' }}>
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
                          className="h-8 w-8 text-[var(--info)] hover:text-white hover:bg-[var(--info)]/20 transition-all rounded-lg active:scale-90 border-0"
                          onClick={() => openDetail(t)} title="Detail Transaksi">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon"
                          className="h-8 w-8 text-[var(--danger)] hover:text-white hover:bg-[var(--danger)]/20 transition-all rounded-lg active:scale-90 border-0"
                          onClick={() => handleDelete(t.id)} title="Hapus Transaksi" disabled={deleteTransaction.isPending}>
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
        <DialogContent className="sm:max-w-lg rounded-2xl border-0 shadow-2xl" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
          <DialogHeader>
            <DialogTitle className="text-white font-bold text-lg">Detail Transaksi</DialogTitle>
          </DialogHeader>
          {detailTxn && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm rounded-xl p-3.5" style={{ background: 'var(--bg-card)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
                <div className="text-[var(--text-secondary)] font-medium">Invoice</div>
                <div className="font-mono font-bold text-[var(--accent-primary)]">{detailTxn.invoice_number}</div>
                <div className="text-[var(--text-secondary)] font-medium">Kasir</div>
                <div className="font-semibold text-slate-200">{detailTxn.profiles?.full_name || '—'}</div>
                <div className="text-[var(--text-secondary)] font-medium">Metode</div>
                <div><span className={getPaymentBadge(detailTxn.payment_method)}>{paymentLabel(detailTxn.payment_method)}</span></div>
                <div className="text-[var(--text-secondary)] font-medium">Waktu</div>
                <div className="text-slate-200">{new Date(detailTxn.created_at).toLocaleString('id-ID')}</div>
              </div>

              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[var(--bg-card)] border-b" style={{ borderColor: 'var(--border)' }}>
                      <TableHead className="text-xs font-bold text-[var(--text-secondary)]">Produk</TableHead>
                      <TableHead className="text-xs font-bold text-[var(--text-secondary)] text-center">Qty</TableHead>
                      <TableHead className="text-xs font-bold text-[var(--text-secondary)] text-right">Harga</TableHead>
                      <TableHead className="text-xs font-bold text-[var(--text-secondary)] text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailItems.map(item => (
                      <TableRow key={item.id} className="border-b hover:bg-white/[0.02] transition-colors" style={{ borderColor: 'rgba(255,107,53,0.05)' }}>
                        <TableCell className="text-sm font-semibold text-slate-200">{item.product_name}</TableCell>
                        <TableCell className="text-center text-sm font-bold text-slate-300">{item.quantity}</TableCell>
                        <TableCell className="text-right text-sm text-[var(--text-secondary)]">Rp {Number(item.price_at_time).toLocaleString('id-ID')}</TableCell>
                        <TableCell className="text-right text-sm font-black text-white">Rp {(item.quantity * Number(item.price_at_time)).toLocaleString('id-ID')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-1.5 text-sm border-t pt-3.5" style={{ borderColor: 'var(--border)' }}>
                <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Subtotal</span><span className="text-slate-200">Rp {Number(detailTxn.subtotal).toLocaleString('id-ID')}</span></div>
                <div className="flex justify-between font-bold text-base border-t pt-2.5 mt-2.5 text-white" style={{ borderColor: 'var(--border)' }}>
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
