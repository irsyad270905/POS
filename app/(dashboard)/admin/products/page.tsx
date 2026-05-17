'use client'

// CHANGED: Added dynamic product category thumbnails, visual status progress bars, stock critical animations, and elegant action states
// UNCHANGED: Supabase RPC calls, product validations, category listings, deletion handlers

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, PackageSearch, Search } from 'lucide-react'

type Category = { id: string; name: string }
type Product = {
  id: string; name: string; sku: string; barcode: string | null
  price: number; stock: number; category_id: string | null
  categories: { name: string } | null
}

export default function AdminProductsPage() {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')

  // Form
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [categoryId, setCategoryId] = useState('')

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name')
    setCategories(data || [])
  }

  const fetchProducts = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(name)')
      .order('created_at', { ascending: false })
    if (error) toast.error('Gagal mengambil data produk')
    else setProducts((data as any) || [])
    setLoading(false)
  }

  const resetForm = () => {
    setName(''); setSku(''); setBarcode(''); setPrice(''); setStock(''); setCategoryId(''); setEditingId(null)
  }

  const handleOpenEdit = (p: Product) => {
    setName(p.name); setSku(p.sku); setBarcode(p.barcode || ''); setPrice(p.price.toString())
    setStock(p.stock.toString()); setCategoryId(p.category_id || ''); setEditingId(p.id); setIsOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload: any = {
      name, sku, price: parseFloat(price), stock: parseInt(stock, 10),
      barcode: barcode || null, category_id: categoryId || null,
    }

    if (editingId) {
      payload.updated_at = new Date().toISOString()
      const { error } = await supabase.from('products').update(payload).eq('id', editingId)
      if (error) { toast.error(error.message); return }
      toast.success('Produk berhasil diperbarui')
    } else {
      const { error } = await supabase.from('products').insert([payload])
      if (error) { toast.error(error.message); return }
      toast.success('Produk berhasil ditambahkan')
    }
    setIsOpen(false); fetchProducts()
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus produk "${name}"? Data tidak dapat dikembalikan.`)) return
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Produk berhasil dihapus'); fetchProducts() }
  }

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCategory === 'all' || p.category_id === filterCategory
    return matchSearch && matchCat
  })

  const getCategoryThumb = (catName: string) => {
    const name = (catName || '').toLowerCase()
    if (name.includes('makanan')) return 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
    if (name.includes('minuman')) return 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
    if (name.includes('snack') || name.includes('camilan')) return 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
    return 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20'
  }

  const getCategoryBadgeClass = (catName: string) => {
    const name = (catName || '').toLowerCase()
    if (name.includes('makanan')) return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
    if (name.includes('minuman')) return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    if (name.includes('snack') || name.includes('camilan')) return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
    return 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border-[var(--accent-primary)]/20'
  }

  const stockBadge = (stock: number) => {
    if (stock === 0) {
      return (
        <div className="flex flex-col items-center gap-1.5 min-w-[90px]">
          <Badge className="badge-danger animate-pulse">Habis</Badge>
          <div className="w-16 h-1.5 bg-red-950/30 rounded-full overflow-hidden border border-red-500/10">
            <div className="bg-red-500 h-full w-0" />
          </div>
        </div>
      )
    }
    if (stock <= 5) {
      return (
        <div className="flex flex-col items-center gap-1.5 min-w-[90px]">
          <Badge className="badge-danger animate-pulse">Kritis ({stock})</Badge>
          <div className="w-16 h-1.5 bg-red-950/30 rounded-full overflow-hidden border border-red-500/10">
            <div className="bg-red-500 h-full w-[25%]" />
          </div>
        </div>
      )
    }
    if (stock < 10) {
      return (
        <div className="flex flex-col items-center gap-1.5 min-w-[90px]">
          <Badge className="badge-warning">Rendah ({stock})</Badge>
          <div className="w-16 h-1.5 bg-amber-950/30 rounded-full overflow-hidden border border-amber-500/10">
            <div className="bg-amber-500 h-full w-[50%]" />
          </div>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-center gap-1.5 min-w-[90px]">
        <Badge className="badge-success">{stock} Aman</Badge>
        <div className="w-16 h-1.5 bg-emerald-950/30 rounded-full overflow-hidden border border-emerald-500/10">
          <div className="bg-emerald-500 h-full w-[100%]" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Manajemen Produk</h1>
          <p className="text-sm text-[var(--text-secondary)]">Kelola inventaris produk Anda.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) resetForm() }}>
          <DialogTrigger render={
            <Button className="gap-2 shadow-lg btn-primary text-white transition-all active:scale-95 border-0 rounded-xl px-4 h-11 text-sm font-bold">
              <Plus className="h-4 w-4" /> Tambah Produk
            </Button>
          } />
          <DialogContent className="sm:max-w-lg bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-white font-bold">{editingId ? 'Edit Produk' : 'Tambah Produk Baru'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm text-[var(--text-secondary)]">Nama Produk</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Nasi Goreng" className="bg-[var(--bg-base)] border-[var(--border)] rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-[var(--text-secondary)]">SKU</Label>
                  <Input value={sku} onChange={(e) => setSku(e.target.value)} required placeholder="SKU-001" className="bg-[var(--bg-base)] border-[var(--border)] rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-[var(--text-secondary)]">Barcode (opsional)</Label>
                  <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="8901234567890" className="bg-[var(--bg-base)] border-[var(--border)] rounded-xl" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-[var(--text-secondary)]">Kategori</Label>
                <Select value={categoryId} onValueChange={(val) => setCategoryId(val || '')}>
                  <SelectTrigger className="bg-[var(--bg-base)] border-[var(--border)] rounded-xl"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                  <SelectContent className="bg-[var(--bg-surface)] border-[var(--border)]">
                    {categories.map(c => <SelectItem key={c.id} value={c.id} className="hover:bg-[var(--bg-card-hover)]">{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-[var(--text-secondary)]">Harga (Rp)</Label>
                  <Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required placeholder="15000" className="bg-[var(--bg-base)] border-[var(--border)] rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-[var(--text-secondary)]">Stok</Label>
                  <Input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} required placeholder="100" className="bg-[var(--bg-base)] border-[var(--border)] rounded-xl" />
                </div>
              </div>
              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="outline" className="border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-slate-200 rounded-xl" onClick={() => setIsOpen(false)}>Batal</Button>
                <Button type="submit" className="btn-primary text-white font-bold px-5 rounded-xl">{editingId ? 'Simpan' : 'Tambah'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]" />
          <Input
            placeholder="Cari nama atau SKU..."
            className="pl-9 bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-primary)] focus-visible:ring-[var(--accent-primary)] focus-visible:border-[var(--accent-primary)] rounded-xl h-11"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterCategory} onValueChange={(val) => setFilterCategory(val || '')}>
          <SelectTrigger className="w-full sm:w-48 bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-primary)] rounded-xl h-11"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-[var(--bg-surface)] border-[var(--border)]">
            <SelectItem value="all" className="hover:bg-[var(--bg-card-hover)]">Semua Kategori</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id} className="hover:bg-[var(--bg-card-hover)]">{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border border-[var(--border)] shadow-md overflow-hidden bg-[var(--bg-card)]/50 backdrop-blur-sm rounded-2xl">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[var(--bg-card)] border-b border-[var(--border)]">
                <TableHead className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">SKU</TableHead>
                <TableHead className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Produk</TableHead>
                <TableHead className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Kategori</TableHead>
                <TableHead className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider text-right">Harga</TableHead>
                <TableHead className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider text-center">Stok</TableHead>
                <TableHead className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider text-center w-[120px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-[var(--text-secondary)] font-semibold">Memuat...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16">
                    <div className="inline-flex p-4 rounded-full bg-slate-800/30 border border-slate-700/30 shadow-inner mb-3">
                      <PackageSearch className="h-14 w-14 text-[var(--text-secondary)] opacity-40" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Produk Tidak Ditemukan</h3>
                    <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-[280px] mx-auto">Mulai daftarkan produk baru Anda untuk memulai pencatatan penjualan.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id} className="group hover:bg-[var(--bg-card-hover)]/30 transition-colors border-b border-[var(--border)] even:bg-[var(--bg-card)]/10">
                    <TableCell className="font-mono text-sm font-bold text-[var(--accent-primary)]">{p.sku}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center font-bold text-xs shadow-inner ${getCategoryThumb(p.categories?.name || '')}`}>
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-100">{p.name}</span>
                          {p.barcode && <span className="block text-[10px] text-[var(--text-secondary)] font-mono">{p.barcode}</span>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs font-semibold px-2.5 py-0.5 rounded-lg border ${getCategoryBadgeClass(p.categories?.name || '')}`}>
                        {p.categories?.name || '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-slate-100">Rp {p.price.toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-center">{stockBadge(p.stock)}</TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-[var(--info)] hover:text-white hover:bg-[var(--info)]/20 transition-all rounded-lg active:scale-90 border border-transparent hover:border-[var(--info)]/30"
                          onClick={() => handleOpenEdit(p)}
                          title="Edit Produk"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-[var(--danger)] hover:text-white hover:bg-[var(--danger)]/20 transition-all rounded-lg active:scale-90 border border-transparent hover:border-[var(--danger)]/30"
                          onClick={() => handleDelete(p.id, p.name)}
                          title="Hapus Produk"
                        >
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
    </div>
  )
}
