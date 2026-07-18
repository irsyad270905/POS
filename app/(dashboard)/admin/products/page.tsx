'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, PackageSearch, Search, ImagePlus, X, Upload } from 'lucide-react'
import Image from 'next/image'

type Category = { id: string; name: string }
type Product = {
  id: string; name: string; sku: string; barcode: string | null
  price: number; stock: number; category_id: string | null
  categories: { name: string } | null
  image_url: string | null
}

type ProductPayload = {
  name: string
  sku: string
  price: number
  stock: number
  barcode: string | null
  category_id: string | null
  image_url?: string | null
  updated_at?: string
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

  // Form fields
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [categoryId, setCategoryId] = useState('')

  // Image upload
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').order('name')
    setCategories(data || [])
  }, [supabase])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(name)')
      .order('created_at', { ascending: false })
    if (error) toast.error('Gagal mengambil data produk')
    else setProducts((data as unknown as Product[]) || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    let active = true
    setTimeout(() => {
      if (active) {
        fetchProducts()
        fetchCategories()
      }
    }, 0)
    return () => { active = false }
  }, [fetchProducts, fetchCategories])

  const resetForm = () => {
    setName(''); setSku(''); setBarcode(''); setPrice(''); setStock('');
    setCategoryId(''); setEditingId(null)
    setImageFile(null); setImagePreview(null); setCurrentImageUrl(null)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5MB')
      return
    }
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar')
      return
    }
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setCurrentImageUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const uploadImage = async (file: File, productId: string): Promise<string | null> => {
    setUploadingImage(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `products/${productId}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) {
        toast.error('Gagal upload gambar: ' + uploadError.message)
        return null
      }

      const { data } = supabase.storage.from('product-images').getPublicUrl(path)
      return data.publicUrl
    } finally {
      setUploadingImage(false)
    }
  }

  const handleNameChange = (newName: string) => {
    setName(newName)
    if (!editingId) {
      if (!newName.trim()) { setSku(''); return }
      const firstWord = newName.trim().split(/\s+/)[0]
      const cleanWord = firstWord.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
      let prefix = ''
      if (cleanWord) {
        const consonants = cleanWord.replace(/[AIUEO]/g, '')
        prefix = consonants.length >= 3 ? consonants.slice(0, 3) : cleanWord.slice(0, 3)
        while (prefix.length < 3) prefix += 'X'
      } else {
        prefix = 'SKU'
      }
      const prefixPattern = new RegExp(`^${prefix}-\\d+$`)
      const matchingSKUs = products.map(p => p.sku).filter(s => prefixPattern.test(s))
      let nextNum = 1
      if (matchingSKUs.length > 0) {
        const numbers = matchingSKUs.map(s => parseInt(s.split('-').pop() || '0', 10))
        nextNum = Math.max(...numbers) + 1
      }
      setSku(`${prefix}-${String(nextNum).padStart(2, '0')}`)
    }
  }

  const handleOpenEdit = (p: Product) => {
    setName(p.name); setSku(p.sku); setBarcode(p.barcode || ''); setPrice(p.price.toString())
    setStock(p.stock.toString()); setCategoryId(p.category_id || ''); setEditingId(p.id)
    setCurrentImageUrl(p.image_url || null)
    setImageFile(null); setImagePreview(null)
    setIsOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    // Determine product id for image upload
    const productId = editingId || crypto.randomUUID()

    let finalImageUrl: string | null = currentImageUrl

    // If a new image file is selected, upload it
    if (imageFile) {
      const uploadedUrl = await uploadImage(imageFile, productId)
      if (!uploadedUrl) {
        toast.warning('Produk disimpan tanpa gambar karena upload gagal. Pastikan Anda sudah membuat bucket "product-images" di Supabase Storage.')
      } else {
        finalImageUrl = uploadedUrl
      }
    }

    const payload: ProductPayload = {
      name, sku, price: parseFloat(price), stock: parseInt(stock, 10),
      barcode: barcode || null, category_id: categoryId || null,
      image_url: finalImageUrl,
    }

    if (editingId) {
      payload.updated_at = new Date().toISOString()
      const { error } = await supabase.from('products').update(payload).eq('id', editingId)
      if (error) { toast.error(error.message); return }
      toast.success('Produk berhasil diperbarui')
    } else {
      const { error } = await supabase.from('products').insert([{ id: productId, ...payload }])
      if (error) { toast.error(error.message); return }
      toast.success('Produk berhasil ditambahkan')
    }
    setIsOpen(false); fetchProducts()
  }

  const handleDelete = async (id: string, productName: string, imgUrl: string | null) => {
    if (!confirm(`Hapus produk "${productName}"? Data tidak dapat dikembalikan.`)) return

    // Delete image from storage if exists
    if (imgUrl) {
      const path = imgUrl.split('/product-images/')[1]
      if (path) {
        await supabase.storage.from('product-images').remove([path])
      }
    }

    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Produk berhasil dihapus'); fetchProducts() }
  }

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCategory === 'all' || p.category_id === filterCategory
    return matchSearch && matchCat
  })

  const getCategoryBadgeStyle = (catName: string) => {
    const n = (catName || '').toLowerCase()
    if (n.includes('makanan')) return { background: 'rgba(255,107,53,0.1)', color: '#FF8C42', border: '1px solid rgba(255,107,53,0.2)' }
    if (n.includes('minuman')) return { background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }
    if (n.includes('snack') || n.includes('camilan')) return { background: 'rgba(168,85,247,0.1)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.2)' }
    return { background: 'rgba(255,107,53,0.1)', color: '#FF6B35', border: '1px solid rgba(255,107,53,0.2)' }
  }

  const stockBadge = (stockVal: number) => {
    if (stockVal === 0) return (
      <div className="flex flex-col items-center gap-1.5 min-w-[90px]">
        <Badge className="badge-danger animate-pulse">Habis</Badge>
        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.1)' }}>
          <div className="bg-red-500 h-full w-0" />
        </div>
      </div>
    )
    if (stockVal <= 5) return (
      <div className="flex flex-col items-center gap-1.5 min-w-[90px]">
        <Badge className="badge-danger animate-pulse">Kritis ({stockVal})</Badge>
        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.1)' }}>
          <div className="bg-red-500 h-full w-[25%]" />
        </div>
      </div>
    )
    if (stockVal < 10) return (
      <div className="flex flex-col items-center gap-1.5 min-w-[90px]">
        <Badge className="badge-warning">Rendah ({stockVal})</Badge>
        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.1)' }}>
          <div className="bg-amber-500 h-full w-[50%]" />
        </div>
      </div>
    )
    return (
      <div className="flex flex-col items-center gap-1.5 min-w-[90px]">
        <Badge className="badge-success">{stockVal} Aman</Badge>
        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.1)' }}>
          <div className="bg-emerald-500 h-full w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Manajemen Produk</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Kelola inventaris produk Anda.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) resetForm() }}>
          <DialogTrigger render={
            <Button className="gap-2 shadow-lg btn-primary transition-all active:scale-95 border-0 rounded-xl px-4 h-11 text-sm font-bold text-white">
              <Plus className="h-4 w-4" /> Tambah Produk
            </Button>
          } />
          <DialogContent className="sm:max-w-lg rounded-2xl border" style={{ background: 'var(--bg-surface)', borderColor: 'rgba(255,107,53,0.2)', color: 'var(--text-primary)' }}>
            <DialogHeader>
              <DialogTitle className="text-white font-bold">{editingId ? 'Edit Produk' : 'Tambah Produk Baru'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">

              {/* ── IMAGE UPLOAD SECTION ── */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Foto Produk</Label>
                <div
                  className="relative group rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer"
                  style={{
                    border: `2px dashed ${imagePreview || currentImageUrl ? 'rgba(255,107,53,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    background: 'rgba(255,107,53,0.03)',
                    minHeight: '140px',
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {(imagePreview || currentImageUrl) ? (
                    <>
                      <Image
                        src={imagePreview || currentImageUrl || ''}
                        alt="Preview produk"
                        width={400}
                        height={140}
                        className="w-full h-36 object-cover"
                        unoptimized
                      />
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: 'rgba(0,0,0,0.55)' }}>
                        <div className="flex flex-col items-center gap-1">
                          <Upload className="h-6 w-6 text-white" />
                          <span className="text-white text-xs font-semibold">Ganti Foto</span>
                        </div>
                      </div>
                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeImage() }}
                        className="absolute top-2 right-2 h-7 w-7 rounded-full flex items-center justify-center transition-colors z-10"
                        style={{ background: 'rgba(239,68,68,0.85)', color: '#fff' }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-36 gap-2">
                      <div className="p-3 rounded-full" style={{ background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.2)' }}>
                        <ImagePlus className="h-6 w-6" style={{ color: '#FF6B35' }} />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold" style={{ color: '#FF6B35' }}>Klik untuk upload foto</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>PNG, JPG, WEBP maks. 5MB</p>
                      </div>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm" style={{ color: 'var(--text-secondary)' }}>Nama Produk</Label>
                <Input value={name} onChange={(e) => handleNameChange(e.target.value)} required placeholder="Nasi Goreng"
                  className="rounded-xl" style={{ background: 'var(--bg-base)', borderColor: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)' }} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm" style={{ color: 'var(--text-secondary)' }}>SKU</Label>
                  <Input value={sku} onChange={(e) => setSku(e.target.value)} required placeholder="SKU-001"
                    className="rounded-xl" style={{ background: 'var(--bg-base)', borderColor: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)' }} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm" style={{ color: 'var(--text-secondary)' }}>Barcode (opsional)</Label>
                  <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="8901234567890"
                    className="rounded-xl" style={{ background: 'var(--bg-base)', borderColor: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm" style={{ color: 'var(--text-secondary)' }}>Kategori</Label>
                <Select value={categoryId} onValueChange={(val) => setCategoryId(val || '')}>
                  <SelectTrigger className="rounded-xl" style={{ background: 'var(--bg-base)', borderColor: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)' }}>
                    <SelectValue placeholder="Pilih kategori">
                      {categories.find(c => c.id === categoryId)?.name || ''}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent style={{ background: 'var(--bg-surface)', borderColor: 'rgba(255,107,53,0.15)' }}>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm" style={{ color: 'var(--text-secondary)' }}>Harga (Rp)</Label>
                  <Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required placeholder="15000"
                    className="rounded-xl" style={{ background: 'var(--bg-base)', borderColor: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)' }} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm" style={{ color: 'var(--text-secondary)' }}>Stok</Label>
                  <Input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} required placeholder="100"
                    className="rounded-xl" style={{ background: 'var(--bg-base)', borderColor: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="outline" className="rounded-xl text-slate-200 hover:text-white"
                  style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'var(--bg-card)' }}
                  onClick={() => setIsOpen(false)}>Batal</Button>
                <Button type="submit" className="btn-primary text-white font-bold px-5 rounded-xl" disabled={uploadingImage}>
                  {uploadingImage ? 'Mengupload...' : (editingId ? 'Simpan' : 'Tambah')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          <Input
            placeholder="Cari nama atau SKU..."
            className="pl-9 h-11 rounded-xl"
            style={{ background: 'var(--bg-surface)', borderColor: 'rgba(255,255,255,0.07)', color: 'var(--text-primary)' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterCategory} onValueChange={(val) => setFilterCategory(val || 'all')}>
          <SelectTrigger className="w-full sm:w-48 h-11 rounded-xl"
            style={{ background: 'var(--bg-surface)', borderColor: 'rgba(255,255,255,0.07)', color: 'var(--text-primary)' }}>
            <SelectValue>
              {filterCategory === 'all' ? 'Semua Kategori' : (categories.find(c => c.id === filterCategory)?.name || '')}
            </SelectValue>
          </SelectTrigger>
          <SelectContent style={{ background: 'var(--bg-surface)', borderColor: 'rgba(255,107,53,0.15)' }}>
            <SelectItem value="all">Semua Kategori</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border overflow-hidden backdrop-blur-sm rounded-2xl"
        style={{ background: 'var(--bg-card)', borderColor: 'rgba(255,107,53,0.12)' }}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b"
                style={{ background: 'rgba(255,107,53,0.04)', borderColor: 'rgba(255,107,53,0.1)' }}>
                <TableHead className="text-xs font-bold uppercase tracking-wider w-16" style={{ color: 'var(--text-secondary)' }}>Foto</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>SKU</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Produk</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Kategori</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-right" style={{ color: 'var(--text-secondary)' }}>Harga</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-center" style={{ color: 'var(--text-secondary)' }}>Stok</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-center w-[120px]" style={{ color: 'var(--text-secondary)' }}>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 font-semibold" style={{ color: 'var(--text-secondary)' }}>Memuat...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16">
                    <div className="inline-flex p-4 rounded-full mb-3" style={{ background: 'rgba(255,107,53,0.07)', border: '1px solid rgba(255,107,53,0.15)' }}>
                      <PackageSearch className="h-14 w-14 opacity-30" style={{ color: '#FF6B35' }} />
                    </div>
                    <h3 className="text-lg font-bold text-white">Produk Tidak Ditemukan</h3>
                    <p className="text-sm mt-1 max-w-[280px] mx-auto" style={{ color: 'var(--text-secondary)' }}>Mulai daftarkan produk baru Anda untuk memulai pencatatan penjualan.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id} className="group transition-colors border-b"
                    style={{ borderColor: 'rgba(255,107,53,0.06)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,107,53,0.04)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    {/* Image Thumbnail */}
                    <TableCell>
                      <div className="h-11 w-11 rounded-xl overflow-hidden border flex items-center justify-center shrink-0"
                        style={{ borderColor: 'rgba(255,107,53,0.15)', background: 'rgba(255,107,53,0.05)' }}>
                        {p.image_url ? (
                          <Image
                            src={p.image_url}
                            alt={p.name}
                            width={44}
                            height={44}
                            className="h-full w-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <span className="text-base font-bold" style={{ color: '#FF6B35' }}>
                            {p.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm font-bold" style={{ color: '#FF6B35' }}>{p.sku}</TableCell>
                    <TableCell>
                      <div>
                        <span className="font-semibold text-slate-100">{p.name}</span>
                        {p.barcode && <span className="block text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>{p.barcode}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="text-xs font-semibold px-2.5 py-0.5 rounded-lg"
                        style={getCategoryBadgeStyle(p.categories?.name || '')}>
                        {p.categories?.name || '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-slate-100">Rp {p.price.toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-center">{stockBadge(p.stock)}</TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-1.5">
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 transition-all rounded-lg active:scale-90"
                          style={{ color: 'var(--info)', border: '1px solid transparent' }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.15)'
                            ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(59,130,246,0.25)'
                            ;(e.currentTarget as HTMLElement).style.color = '#fff'
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = 'transparent'
                            ;(e.currentTarget as HTMLElement).style.borderColor = 'transparent'
                            ;(e.currentTarget as HTMLElement).style.color = 'var(--info)'
                          }}
                          onClick={() => handleOpenEdit(p)} title="Edit Produk"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 transition-all rounded-lg active:scale-90"
                          style={{ color: 'var(--danger)', border: '1px solid transparent' }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.15)'
                            ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.25)'
                            ;(e.currentTarget as HTMLElement).style.color = '#fff'
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = 'transparent'
                            ;(e.currentTarget as HTMLElement).style.borderColor = 'transparent'
                            ;(e.currentTarget as HTMLElement).style.color = 'var(--danger)'
                          }}
                          onClick={() => handleDelete(p.id, p.name, p.image_url)} title="Hapus Produk"
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
