'use client'

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

  const stockBadge = (stock: number) => {
    if (stock === 0) return <Badge variant="destructive" className="text-xs">Habis</Badge>
    if (stock <= 5) return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-xs">Rendah ({stock})</Badge>
    return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">{stock}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen Produk</h1>
          <p className="text-muted-foreground">Kelola inventaris produk Anda.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) resetForm() }}>
          <DialogTrigger render={
            <Button className="gap-2 shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4" /> Tambah Produk
            </Button>
          } />
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Produk' : 'Tambah Produk Baru'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>Nama Produk</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Nasi Goreng" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SKU</Label>
                  <Input value={sku} onChange={(e) => setSku(e.target.value)} required placeholder="SKU-001" />
                </div>
                <div className="space-y-2">
                  <Label>Barcode (opsional)</Label>
                  <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="8901234567890" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Harga (Rp)</Label>
                  <Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required placeholder="15000" />
                </div>
                <div className="space-y-2">
                  <Label>Stok</Label>
                  <Input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} required placeholder="100" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Batal</Button>
                <Button type="submit">{editingId ? 'Simpan' : 'Tambah'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cari nama atau SKU..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50/50 dark:bg-zinc-800/30">
                <TableHead>SKU</TableHead>
                <TableHead>Produk</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead className="text-right">Harga</TableHead>
                <TableHead className="text-center">Stok</TableHead>
                <TableHead className="text-center w-[120px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16">
                    <PackageSearch className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
                    <p className="text-muted-foreground">Belum ada produk</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/20">
                    <TableCell className="font-mono text-sm font-bold">{p.sku}</TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{p.name}</span>
                        {p.barcode && <span className="block text-xs text-muted-foreground">{p.barcode}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{p.categories?.name || '—'}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">Rp {p.price.toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-center">{stockBadge(p.stock)}</TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => handleOpenEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => handleDelete(p.id, p.name)}>
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
