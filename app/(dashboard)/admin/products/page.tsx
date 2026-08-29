'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, PackageSearch, Search, RotateCcw, Layers, CheckCircle2, AlertCircle, Sparkles, PlusCircle } from 'lucide-react'
import { useProducts, useProductCategories, useCreateProduct, useCreateBulkProducts, useUpdateProduct, useDeleteProduct, type Product, type ProductPayload } from '@/lib/queries/products'
import { getCategoryVisual } from '@/lib/categoryVisual'

type BulkProductRow = {
  id: string
  name: string
  sku: string
  categoryId: string
  unit: string
  customUnit: string
  price: string
  stock: string
}

export default function AdminProductsPage() {
  const { data: products = [], isLoading: productsLoading } = useProducts()
  const { data: categories = [], isLoading: categoriesLoading } = useProductCategories()
  const createProduct = useCreateProduct()
  const createBulkProducts = useCreateBulkProducts()
  const updateProduct = useUpdateProduct()
  const deleteProduct = useDeleteProduct()

  const loading = productsLoading || categoriesLoading

  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addMode, setAddMode] = useState<'single' | 'bulk'>('single')
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')

  // Single form fields
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [unit, setUnit] = useState('pcs')
  const [customUnit, setCustomUnit] = useState('')
  const [categoryId, setCategoryId] = useState('')

  // Bulk form state
  const [bulkRows, setBulkRows] = useState<BulkProductRow[]>([])

  const UNIT_PRESETS = [
    { value: 'pcs', label: 'Pcs (Buah / Biji)' },
    { value: 'kg', label: 'Kg (Kilogram)' },
    { value: 'gram', label: 'Gram (gr)' },
    { value: 'liter', label: 'Liter (L)' },
    { value: 'ml', label: 'Mililiter (ml)' },
    { value: 'dus', label: 'Dus (Karton / Box)' },
    { value: 'pack', label: 'Pack (Bungkus)' },
    { value: 'botol', label: 'Botol' },
    { value: 'kaleng', label: 'Kaleng' },
    { value: 'porsi', label: 'Porsi' },
    { value: 'ikat', label: 'Ikat' },
    { value: 'lusin', label: 'Lusin' },
    { value: 'lembar', label: 'Lembar' },
    { value: 'unit', label: 'Unit' },
    { value: 'custom', label: 'Lainnya (Ketik sendiri)' },
  ]

  const createEmptyBulkRow = (): BulkProductRow => ({
    id: crypto.randomUUID(),
    name: '',
    sku: '',
    categoryId: '',
    unit: 'pcs',
    customUnit: '',
    price: '',
    stock: '0',
  })

  const resetForm = () => {
    setName(''); setSku(''); setPrice(''); setStock('');
    setUnit('pcs'); setCustomUnit('');
    setCategoryId(''); setEditingId(null)
    setAddMode('single')
    setBulkRows([])
  }

  const handleOpenAddDialog = () => {
    resetForm()
    setBulkRows([
      createEmptyBulkRow(),
      createEmptyBulkRow(),
      createEmptyBulkRow(),
    ])
    setIsOpen(true)
  }

  const generateSkuFromName = (productName: string, existingList: { sku: string }[] = products) => {
    if (!productName.trim()) return ''
    const firstWord = productName.trim().split(/\s+/)[0]
    const cleanWord = firstWord.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    let prefix = ''
    if (cleanWord) {
      const consonants = cleanWord.replace(/[AIUEO]/g, '')
      prefix = consonants.length >= 3 ? consonants.slice(0, 3) : cleanWord.slice(0, 3)
      while (prefix.length < 3) prefix += 'X'
    } else {
      prefix = 'SKU'
    }
    const prefixPattern = new RegExp(`^${prefix}-\\d+$`, 'i')
    const matchingSKUs = existingList.map(p => p.sku).filter(s => s && prefixPattern.test(s))
    let nextNum = 1
    if (matchingSKUs.length > 0) {
      const numbers = matchingSKUs.map(s => parseInt(s.split('-').pop() || '0', 10)).filter(n => !isNaN(n))
      if (numbers.length > 0) {
        nextNum = Math.max(...numbers) + 1
      }
    }
    return `${prefix}-${String(nextNum).padStart(2, '0')}`
  }

  const handleNameChange = (newName: string) => {
    setName(newName)
    if (!editingId) {
      setSku(generateSkuFromName(newName))
    }
  }

  const handleOpenEdit = (p: Product) => {
    setName(p.name); setSku(p.sku); setPrice(p.price.toString())
    setStock(p.stock.toString()); setCategoryId(p.category_id || '')
    const productUnit = p.unit || 'pcs'
    const isPreset = UNIT_PRESETS.some(u => u.value === productUnit)
    if (isPreset) {
      setUnit(productUnit)
      setCustomUnit('')
    } else {
      setUnit('custom')
      setCustomUnit(productUnit)
    }
    setEditingId(p.id)
    setAddMode('single')
    setIsOpen(true)
  }

  // Bulk row handlers
  const handleAddBulkRows = (count: number = 1) => {
    const newRows: BulkProductRow[] = []
    for (let i = 0; i < count; i++) {
      newRows.push(createEmptyBulkRow())
    }
    setBulkRows(prev => [...prev, ...newRows])
  }

  const handleRemoveBulkRow = (id: string) => {
    setBulkRows(prev => {
      const updated = prev.filter(r => r.id !== id)
      return updated.length > 0 ? updated : [createEmptyBulkRow()]
    })
  }

  const handleBulkRowChange = (id: string, field: keyof BulkProductRow, value: string) => {
    setBulkRows(prev => prev.map(row => {
      if (row.id !== id) return row
      const updated = { ...row, [field]: value }

      // Auto generate SKU jika nama diisi dan SKU masih kosong atau auto
      if (field === 'name' && value.trim()) {
        const allCurrentSkus = [
          ...products.map(p => ({ sku: p.sku })),
          ...prev.filter(r => r.id !== id && r.sku.trim()).map(r => ({ sku: r.sku.trim() }))
        ]
        if (!row.sku.trim() || row.sku.startsWith('SKU-') || row.sku.split('-')[0].length === 3) {
          updated.sku = generateSkuFromName(value, allCurrentSkus)
        }
      }

      return updated
    }))
  }

  const handleAutoGenerateAllSkus = () => {
    const assignedSkus = [...products.map(p => ({ sku: p.sku }))]
    setBulkRows(prev => prev.map(row => {
      if (!row.name.trim()) return row
      const newSku = generateSkuFromName(row.name, assignedSkus)
      assignedSkus.push({ sku: newSku })
      return { ...row, sku: newSku }
    }))
    toast.success('SKU unik otomatis diperbarui untuk seluruh baris')
  }

  // Row validation logic
  const getRowValidation = (row: BulkProductRow, allRows: BulkProductRow[]) => {
    const errors: string[] = []
    const isTotallyEmpty = !row.name.trim() && !row.sku.trim() && !row.price.trim()

    if (!row.name.trim()) errors.push('Nama produk wajib diisi')
    if (!row.sku.trim()) errors.push('SKU wajib diisi')
    
    const parsedPrice = parseFloat(row.price)
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      errors.push('Harga harus > 0')
    }

    const parsedStock = parseInt(row.stock, 10)
    if (isNaN(parsedStock) || parsedStock < 0) {
      errors.push('Stok tidak boleh negatif')
    }

    // Cek duplikat SKU di dalam tabel bulk
    if (row.sku.trim()) {
      const duplicateSkuInBulk = allRows.filter(r => r.sku.trim().toUpperCase() === row.sku.trim().toUpperCase())
      if (duplicateSkuInBulk.length > 1) {
        errors.push('SKU duplikat di tabel ini')
      }

      // Cek duplikat SKU terhadap produk yang sudah ada di database
      const duplicateInDb = products.some(p => p.sku.toUpperCase() === row.sku.trim().toUpperCase())
      if (duplicateInDb) {
        errors.push('SKU sudah dipakai di database')
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      isTotallyEmpty,
    }
  }

  const activeBulkRows = bulkRows.filter(r => r.name.trim() || r.sku.trim() || r.price.trim())
  const validBulkRows = activeBulkRows.filter(r => getRowValidation(r, bulkRows).isValid)
  const hasBulkErrors = activeBulkRows.length > 0 && validBulkRows.length < activeBulkRows.length

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const productId = editingId || crypto.randomUUID()
    const effectiveUnit = (unit === 'custom' ? (customUnit.trim() || 'pcs') : unit).toLowerCase()

    const payload: ProductPayload = {
      name, sku, price: parseFloat(price), stock: parseInt(stock, 10),
      category_id: categoryId || null,
      unit: effectiveUnit,
      image_url: null,
      barcode: null,
    }

    try {
      if (editingId) {
        await updateProduct.mutateAsync({ id: editingId, payload })
        toast.success('Produk berhasil diperbarui')
      } else {
        await createProduct.mutateAsync({ productId, payload })
        toast.success('Produk berhasil ditambahkan')
      }
      setIsOpen(false)
      resetForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  const handleSaveBulk = async () => {
    if (activeBulkRows.length === 0) {
      toast.error('Silakan isi setidaknya satu produk pada tabel massal')
      return
    }

    if (hasBulkErrors) {
      toast.error(`Ada ${activeBulkRows.length - validBulkRows.length} baris yang belum valid. Silakan periksa tanda merah pada tabel.`)
      return
    }

    const items = activeBulkRows.map(r => {
      const effectiveUnit = (r.unit === 'custom' ? (r.customUnit.trim() || 'pcs') : r.unit).toLowerCase()
      return {
        id: crypto.randomUUID(),
        payload: {
          name: r.name.trim(),
          sku: r.sku.trim().toUpperCase(),
          price: parseFloat(r.price),
          stock: parseInt(r.stock || '0', 10),
          category_id: r.categoryId || null,
          unit: effectiveUnit,
          image_url: null,
          barcode: null,
        } as ProductPayload,
      }
    })

    try {
      await createBulkProducts.mutateAsync(items)
      toast.success(`${items.length} produk berhasil ditambahkan sekaligus!`)
      setIsOpen(false)
      resetForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  const handleDelete = async (id: string, productName: string) => {
    if (!confirm(`Hapus produk "${productName}"? Histori transaksi tetap tersimpan.`)) return
    try {
      await deleteProduct.mutateAsync({ id })
      toast.success('Produk berhasil dihapus')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCategory === 'all' || p.category_id === filterCategory
    return matchSearch && matchCat
  })

  const stockBadge = (stockVal: number) => {
    if (stockVal === 0) return (
      <div className="flex flex-col items-center gap-1.5 min-w-[90px]">
        <Badge className="badge-danger animate-pulse">Habis</Badge>
        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.14)' }}>
          <div className="bg-red-500 h-full w-0" />
        </div>
      </div>
    )
    if (stockVal <= 5) return (
      <div className="flex flex-col items-center gap-1.5 min-w-[90px]">
        <Badge className="badge-danger animate-pulse">Kritis ({stockVal})</Badge>
        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.14)' }}>
          <div className="bg-red-500 h-full w-[25%]" />
        </div>
      </div>
    )
    if (stockVal < 10) return (
      <div className="flex flex-col items-center gap-1.5 min-w-[90px]">
        <Badge className="badge-warning">Rendah ({stockVal})</Badge>
        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.14)' }}>
          <div className="bg-amber-500 h-full w-[50%]" />
        </div>
      </div>
    )
    return (
      <div className="flex flex-col items-center gap-1.5 min-w-[90px]">
        <Badge className="badge-success">{stockVal} Aman</Badge>
        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.14)' }}>
          <div className="bg-emerald-500 h-full w-full" />
        </div>
      </div>
    )
  }

  const isSaving = createProduct.isPending || updateProduct.isPending || createBulkProducts.isPending

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Manajemen Produk</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Kelola inventaris — visual produk otomatis by jenis (kategori).</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) resetForm() }}>
          <DialogTrigger render={
            <Button onClick={handleOpenAddDialog} className="w-full sm:w-auto gap-2 shadow-lg btn-primary transition-all active:scale-95 border-0 rounded-xl px-5 h-11 text-sm font-bold text-white justify-center">
              <Plus className="h-4 w-4" /> Tambah Produk
            </Button>
          } />
          <DialogContent
            className={`${addMode === 'bulk' && !editingId ? 'max-w-[calc(100%-0.75rem)] sm:max-w-[96vw] md:max-w-5xl lg:max-w-6xl' : 'max-w-[calc(100%-1rem)] sm:max-w-lg'} border-0 shadow-2xl transition-all duration-300`}
            style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
          >
            <DialogHeader className="pr-7 sm:pr-8">
              <div className="flex flex-col gap-3 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="pr-2">
                  <DialogTitle className="text-white font-bold text-base sm:text-lg leading-tight">
                    {editingId ? 'Edit Produk' : 'Tambah Produk'}
                  </DialogTitle>
                  <p className="text-[11px] sm:text-xs mt-1 leading-snug" style={{ color: 'var(--text-secondary)' }}>
                    {editingId
                      ? 'Perbarui rincian produk yang dipilih.'
                      : addMode === 'bulk'
                      ? 'Tambahkan 10–20+ produk sekaligus. Di HP tampil kartu, di desktop tabel.'
                      : 'Isi detail satu produk baru ke dalam katalog inventaris.'}
                  </p>
                </div>

                {/* Tab switcher mode Satu vs Massal (hanya saat create) */}
                {!editingId && (
                  <div className="flex items-center p-1 rounded-xl w-full sm:w-auto shrink-0 self-start" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => setAddMode('single')}
                      className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-1.5 rounded-lg text-xs font-bold transition-all ${
                        addMode === 'single'
                          ? 'btn-primary text-white shadow-md'
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Plus className="h-3.5 w-3.5" /> Satu Produk
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddMode('bulk')}
                      className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-1.5 rounded-lg text-xs font-bold transition-all ${
                        addMode === 'bulk'
                          ? 'btn-primary text-white shadow-md'
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Layers className="h-3.5 w-3.5" /> Tambah Massal
                    </button>
                  </div>
                )}
              </div>
            </DialogHeader>

            {/* SINGLE MODE - optimized for mobile */}
            {addMode === 'single' ? (
              <form onSubmit={handleSave} className="space-y-4 pt-3">
                <div className="space-y-2">
                  <Label className="text-sm" style={{ color: 'var(--text-secondary)' }}>Nama Produk</Label>
                  <Input value={name} onChange={(e) => handleNameChange(e.target.value)} required placeholder="Contoh: Minyak Goreng 1L"
                    className="rounded-xl h-11 border-0 focus-visible:ring-1" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--border)' }} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm" style={{ color: 'var(--text-secondary)' }}>SKU (Kode Produk)</Label>
                    <button
                      type="button"
                      onClick={() => setSku(generateSkuFromName(name || 'PRODUK'))}
                      className="text-xs flex items-center gap-1 font-semibold hover:underline"
                      style={{ color: '#ff8c42' }}
                      title="Generate SKU Otomatis"
                    >
                      <RotateCcw className="h-3 w-3" /> Buat SKU Unik
                    </button>
                  </div>
                  <Input value={sku} onChange={(e) => setSku(e.target.value)} required placeholder="SKU-001"
                    className="rounded-xl h-11 border-0" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--border)' }} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm" style={{ color: 'var(--text-secondary)' }}>Jenis / Kategori</Label>
                    <Select value={categoryId} onValueChange={(val) => setCategoryId(val || '')}>
                      <SelectTrigger className="rounded-xl h-11 border-0" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
                        <span className="flex-1 text-left truncate flex items-center gap-2">
                          {categoryId ? (
                            (() => {
                              const cat = categories.find(c => c.id === categoryId)
                              if (!cat) return <span style={{ color: 'var(--text-muted)' }}>Pilih kategori</span>
                              const v = getCategoryVisual(cat.name)
                              const Icon = v.icon
                              return (
                                <>
                                  <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: v.iconColor }} />
                                  <span className="truncate">{cat.name}</span>
                                </>
                              )
                            })()
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Pilih kategori</span>
                          )}
                        </span>
                      </SelectTrigger>
                      <SelectContent style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}>
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
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm" style={{ color: 'var(--text-secondary)' }}>Satuan / Ukuran</Label>
                    <Select value={unit} onValueChange={(val) => setUnit(val || 'pcs')}>
                      <SelectTrigger className="rounded-xl h-11 border-0" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
                        <span className="flex-1 text-left truncate">
                          {UNIT_PRESETS.find(u => u.value === unit)?.label || (unit === 'custom' ? `Kustom (${customUnit || '...'})` : unit)}
                        </span>
                      </SelectTrigger>
                      <SelectContent style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}>
                        {UNIT_PRESETS.map(u => (
                          <SelectItem key={u.value} value={u.value}>
                            {u.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {unit === 'custom' && (
                  <div className="space-y-2">
                    <Label className="text-sm" style={{ color: 'var(--text-secondary)' }}>Tulis Nama Satuan Kustom</Label>
                    <Input
                      value={customUnit}
                      onChange={(e) => setCustomUnit(e.target.value)}
                      required
                      placeholder="Contoh: rim, slop, kaleng, box"
                      className="rounded-xl h-11 border-0"
                      style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--border)' }}
                    />
                  </div>
                )}

                {categoryId && (() => {
                  const v = getCategoryVisual(categories.find(c => c.id === categoryId)?.name)
                  const Icon = v.icon
                  return (
                    <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: v.iconBg, border: `1px solid ${v.iconBorder}` }}>
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.18)', border: `1px solid ${v.iconBorder}` }}>
                        <Icon className="h-4 w-4" style={{ color: v.iconColor }} />
                      </div>
                      <div className="text-xs">
                        <p className="font-bold text-white leading-none">{v.label}</p>
                        <p className="leading-none mt-1" style={{ color: 'var(--text-secondary)' }}>Visual otomatis — warm</p>
                      </div>
                    </div>
                  )
                })()}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm" style={{ color: 'var(--text-secondary)' }}>Harga (Rp)</Label>
                    <Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required placeholder="15000"
                      className="rounded-xl h-11 border-0" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--border)' }} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm" style={{ color: 'var(--text-secondary)' }}>Jumlah Stok (Kuantitas Barang)</Label>
                    <Input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} required placeholder="100"
                      className="rounded-xl h-11 border-0" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--border)' }} />
                  </div>
                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t mt-2" style={{ borderColor: 'var(--border)' }}>
                  <Button type="button" variant="ghost" className="rounded-xl text-slate-200 hover:text-white hover:bg-white/5 border-0 w-full sm:w-auto h-11 sm:h-10 text-sm font-semibold"
                    onClick={() => setIsOpen(false)}>Batal</Button>
                  <Button type="submit" className="btn-primary text-white font-bold px-6 rounded-xl h-11 sm:h-10 w-full sm:w-auto text-sm" disabled={isSaving}>
                    {isSaving ? 'Menyimpan...' : (editingId ? 'Simpan' : 'Tambah')}
                  </Button>
                </div>
              </form>
            ) : (
              /* BULK MODE - responsive: cards on mobile, table on desktop */
              <div className="space-y-3 sm:space-y-4 pt-3">
                {/* Action Bar Atas - grid on mobile to avoid cutoff like screenshot */}
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleAddBulkRows(1)}
                      className="col-span-1 gap-1.5 rounded-xl border-0 h-10 sm:h-9 px-3 text-xs font-bold justify-center"
                      style={{ background: 'rgba(255,107,53,0.14)', color: '#ff8c42', border: '1px solid rgba(255,107,53,0.25)' }}
                    >
                      <Plus className="h-3.5 w-3.5" /> Tambah 1 Baris
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleAddBulkRows(5)}
                      className="col-span-1 gap-1.5 rounded-xl border-0 h-10 sm:h-9 px-3 text-xs font-bold justify-center"
                      style={{ background: 'rgba(255,107,53,0.10)', color: '#ffb86a', border: '1px solid rgba(255,107,53,0.20)' }}
                    >
                      <PlusCircle className="h-3.5 w-3.5" /> Tambah 5 Baris
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAutoGenerateAllSkus}
                      className="col-span-2 sm:col-span-1 sm:w-auto gap-1.5 rounded-xl border-0 h-10 sm:h-9 px-3 text-xs font-semibold text-slate-200 justify-center"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)' }}
                    >
                      <Sparkles className="h-3.5 w-3.5" style={{ color: '#ffb86a' }} /> Buat Semua SKU
                    </Button>
                  </div>

                  {/* Ringkasan Validasi */}
                  <div className="flex items-center justify-center sm:justify-start">
                    {activeBulkRows.length > 0 ? (
                      hasBulkErrors ? (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold w-full sm:w-auto justify-center" style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}>
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {activeBulkRows.length - validBulkRows.length} baris perlu diperbaiki
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold w-full sm:w-auto justify-center" style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.2)' }}>
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> {validBulkRows.length} baris siap disimpan
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-center sm:text-left w-full" style={{ color: 'var(--text-muted)' }}>
                        Isi produk pada kartu di bawah — geser ke bawah untuk tambah baris
                      </span>
                    )}
                  </div>
                </div>

                {/* DESKTOP Tabel — hidden on mobile */}
                <div
                  className="hidden md:block overflow-x-auto overflow-y-auto max-h-[45vh] lg:max-h-[52vh] rounded-2xl border"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                >
                  <Table className="min-w-[850px] relative border-collapse text-xs">
                    <TableHeader className="sticky top-0 z-10 shadow-sm" style={{ background: 'rgba(30,20,15,0.98)', backdropFilter: 'blur(8px)' }}>
                      <TableRow className="border-b hover:bg-transparent" style={{ borderColor: 'var(--border)' }}>
                        <TableHead className="w-10 text-center font-bold text-slate-300">#</TableHead>
                        <TableHead className="w-12 text-center font-bold text-slate-300">Status</TableHead>
                        <TableHead className="w-48 font-bold text-slate-300">Nama Produk *</TableHead>
                        <TableHead className="w-32 font-bold text-slate-300">SKU *</TableHead>
                        <TableHead className="w-36 font-bold text-slate-300">Kategori</TableHead>
                        <TableHead className="w-28 font-bold text-slate-300">Satuan</TableHead>
                        <TableHead className="w-32 font-bold text-slate-300">Harga (Rp) *</TableHead>
                        <TableHead className="w-24 font-bold text-slate-300">Stok (Jml)</TableHead>
                        <TableHead className="w-12 text-center font-bold text-slate-300">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bulkRows.map((row, index) => {
                        const validation = getRowValidation(row, bulkRows)
                        const isFilled = !validation.isTotallyEmpty
                        const rowError = isFilled && !validation.isValid

                        return (
                          <TableRow
                            key={row.id}
                            className={`border-b transition-colors ${
                              rowError ? 'bg-red-500/[0.04]' : 'hover:bg-white/[0.02]'
                            }`}
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <TableCell className="text-center font-mono font-bold" style={{ color: 'var(--text-muted)' }}>
                              {index + 1}
                            </TableCell>
                            <TableCell className="text-center p-2">
                              {!isFilled ? (
                                <span className="inline-block h-2 w-2 rounded-full bg-slate-600" title="Baris kosong" />
                              ) : validation.isValid ? (
                                <CheckCircle2 className="h-4 w-4 mx-auto text-emerald-400" />
                              ) : (
                                <div className="group relative inline-block">
                                  <AlertCircle className="h-4 w-4 mx-auto text-red-400 cursor-pointer animate-pulse" />
                                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:block z-30 pointer-events-none min-w-[160px] p-2 rounded-lg text-[10px] font-semibold text-white" style={{ background: '#1c1917', border: '1px solid #ef4444', boxShadow: '0 4px 14px rgba(0,0,0,0.5)' }}>
                                    {validation.errors.map((err, i) => (
                                      <div key={i} className="leading-tight text-red-300">• {err}</div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="p-2">
                              <Input
                                value={row.name}
                                onChange={(e) => handleBulkRowChange(row.id, 'name', e.target.value)}
                                placeholder="Nama barang"
                                className="h-9 text-xs rounded-lg border-0"
                                style={{
                                  background: 'var(--bg-surface)',
                                  color: 'var(--text-primary)',
                                  boxShadow: rowError && !row.name.trim() ? 'inset 0 0 0 1px #ef4444' : 'inset 0 0 0 1px var(--border)',
                                }}
                              />
                            </TableCell>
                            <TableCell className="p-2">
                              <Input
                                value={row.sku}
                                onChange={(e) => handleBulkRowChange(row.id, 'sku', e.target.value.toUpperCase())}
                                placeholder="SKU-001"
                                className="h-9 text-xs rounded-lg border-0 font-mono font-bold"
                                style={{
                                  background: 'var(--bg-surface)',
                                  color: '#ff8c42',
                                  boxShadow: rowError && (!row.sku.trim() || validation.errors.some(e => e.includes('SKU'))) ? 'inset 0 0 0 1px #ef4444' : 'inset 0 0 0 1px var(--border)',
                                }}
                              />
                            </TableCell>
                            <TableCell className="p-2">
                              <Select value={row.categoryId} onValueChange={(val) => handleBulkRowChange(row.id, 'categoryId', val || '')}>
                                <SelectTrigger className="h-9 text-xs rounded-lg border-0" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
                                  <span className="truncate">
                                    {row.categoryId ? categories.find(c => c.id === row.categoryId)?.name || 'Pilih' : 'Pilih'}
                                  </span>
                                </SelectTrigger>
                                <SelectContent style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}>
                                  {categories.map(c => (
                                    <SelectItem key={c.id} value={c.id}>
                                      {c.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="p-2">
                              <Select value={row.unit} onValueChange={(val) => handleBulkRowChange(row.id, 'unit', val || 'pcs')}>
                                <SelectTrigger className="h-9 text-xs rounded-lg border-0 uppercase font-bold" style={{ background: 'var(--bg-surface)', color: '#ff8c42', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
                                  <span className="truncate">{row.unit}</span>
                                </SelectTrigger>
                                <SelectContent style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}>
                                  {UNIT_PRESETS.map(u => (
                                    <SelectItem key={u.value} value={u.value}>
                                      {u.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="p-2">
                              <Input
                                type="number"
                                min="0"
                                value={row.price}
                                onChange={(e) => handleBulkRowChange(row.id, 'price', e.target.value)}
                                placeholder="15000"
                                className="h-9 text-xs rounded-lg border-0 text-right font-bold"
                                style={{
                                  background: 'var(--bg-surface)',
                                  color: 'white',
                                  boxShadow: rowError && (isNaN(parseFloat(row.price)) || parseFloat(row.price) <= 0) ? 'inset 0 0 0 1px #ef4444' : 'inset 0 0 0 1px var(--border)',
                                }}
                              />
                            </TableCell>
                            <TableCell className="p-2">
                              <Input
                                type="number"
                                min="0"
                                value={row.stock}
                                onChange={(e) => handleBulkRowChange(row.id, 'stock', e.target.value)}
                                placeholder="0"
                                className="h-9 text-xs rounded-lg border-0 text-center font-bold"
                                style={{
                                  background: 'var(--bg-surface)',
                                  color: 'white',
                                  boxShadow: 'inset 0 0 0 1px var(--border)',
                                }}
                              />
                            </TableCell>
                            <TableCell className="p-2 text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveBulkRow(row.id)}
                                className="h-8 w-8 rounded-lg hover:bg-red-500/10 border-0"
                                style={{ color: '#fca5a5' }}
                                title="Hapus baris ini"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* MOBILE Cards — visible only on Android / small screens */}
                <div className="md:hidden space-y-3">
                  {bulkRows.map((row, index) => {
                    const validation = getRowValidation(row, bulkRows)
                    const isFilled = !validation.isTotallyEmpty
                    const rowError = isFilled && !validation.isValid
                    return (
                      <div
                        key={row.id}
                        className={`rounded-2xl border p-3 space-y-3 transition-colors ${rowError ? 'border-red-500/30 bg-red-500/[0.06]' : 'bg-[var(--bg-card)]'}`}
                        style={{ borderColor: rowError ? 'rgba(239,68,68,0.3)' : 'var(--border)' }}
                      >
                        {/* Card Header: number + status + delete */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-black shrink-0" style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                              {index + 1}
                            </span>
                            {!isFilled ? (
                              <span className="text-[11px] px-2 py-1 rounded-full font-semibold" style={{ background: 'rgba(100,116,139,0.15)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Kosong</span>
                            ) : validation.isValid ? (
                              <span className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full font-bold" style={{ background: 'rgba(16,185,129,0.14)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.2)' }}><CheckCircle2 className="h-3 w-3" /> Valid</span>
                            ) : (
                              <span className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full font-bold" style={{ background: 'rgba(239,68,68,0.14)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}><AlertCircle className="h-3 w-3" /> Perbaiki</span>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveBulkRow(row.id)}
                            className="h-8 w-8 rounded-full hover:bg-red-500/10 border-0 shrink-0"
                            style={{ color: '#fca5a5' }}
                            title="Hapus baris"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Nama Produk */}
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-bold tracking-wide" style={{ color: 'var(--text-secondary)' }}>Nama Produk <span className="text-red-400">*</span></Label>
                          <Input
                            value={row.name}
                            onChange={(e) => handleBulkRowChange(row.id, 'name', e.target.value)}
                            placeholder="Contoh: Beras 5KG"
                            className="h-11 text-sm rounded-xl border-0 font-medium"
                            style={{
                              background: 'var(--bg-surface)',
                              color: 'var(--text-primary)',
                              boxShadow: rowError && !row.name.trim() ? 'inset 0 0 0 1.5px #ef4444' : 'inset 0 0 0 1px var(--border)',
                            }}
                          />
                        </div>

                        {/* SKU */}
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-bold tracking-wide" style={{ color: 'var(--text-secondary)' }}>SKU <span className="text-red-400">*</span></Label>
                          <Input
                            value={row.sku}
                            onChange={(e) => handleBulkRowChange(row.id, 'sku', e.target.value.toUpperCase())}
                            placeholder="Otomatis dari nama / ketik manual"
                            className="h-11 text-sm rounded-xl border-0 font-mono font-bold tracking-wide"
                            style={{
                              background: 'var(--bg-surface)',
                              color: '#ff8c42',
                              boxShadow: rowError && (!row.sku.trim() || validation.errors.some(e => e.includes('SKU'))) ? 'inset 0 0 0 1.5px #ef4444' : 'inset 0 0 0 1px var(--border)',
                            }}
                          />
                        </div>

                        {/* Kategori + Satuan */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>Kategori</Label>
                            <Select value={row.categoryId} onValueChange={(val) => handleBulkRowChange(row.id, 'categoryId', val || '')}>
                              <SelectTrigger className="h-11 text-sm rounded-xl border-0" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
                                <span className="truncate">
                                  {row.categoryId ? categories.find(c => c.id === row.categoryId)?.name || 'Pilih' : 'Pilih kategori'}
                                </span>
                              </SelectTrigger>
                              <SelectContent style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}>
                                {categories.map(c => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>Satuan</Label>
                            <Select value={row.unit} onValueChange={(val) => handleBulkRowChange(row.id, 'unit', val || 'pcs')}>
                              <SelectTrigger className="h-11 text-sm rounded-xl border-0 uppercase font-bold" style={{ background: 'var(--bg-surface)', color: '#ff8c42', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
                                <span className="truncate">{UNIT_PRESETS.find(u=>u.value===row.unit)?.label?.split(' ')[0] || row.unit}</span>
                              </SelectTrigger>
                              <SelectContent style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}>
                                {UNIT_PRESETS.map(u => (
                                  <SelectItem key={u.value} value={u.value}>
                                    {u.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Harga + Stok */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>Harga (Rp) <span className="text-red-400">*</span></Label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              value={row.price}
                              onChange={(e) => handleBulkRowChange(row.id, 'price', e.target.value)}
                              placeholder="15000"
                              className="h-11 text-sm rounded-xl border-0 text-left font-bold"
                              style={{
                                background: 'var(--bg-surface)',
                                color: 'white',
                                boxShadow: rowError && (isNaN(parseFloat(row.price)) || parseFloat(row.price) <= 0) ? 'inset 0 0 0 1.5px #ef4444' : 'inset 0 0 0 1px var(--border)',
                              }}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>Stok</Label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              value={row.stock}
                              onChange={(e) => handleBulkRowChange(row.id, 'stock', e.target.value)}
                              placeholder="0"
                              className="h-11 text-sm rounded-xl border-0 text-center font-bold"
                              style={{
                                background: 'var(--bg-surface)',
                                color: 'white',
                                boxShadow: 'inset 0 0 0 1px var(--border)',
                              }}
                            />
                          </div>
                        </div>

                        {/* Error messages inline for mobile */}
                        {rowError && (
                          <div className="rounded-xl px-3 py-2.5 space-y-1" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}>
                            {validation.errors.map((err, i) => (
                              <div key={i} className="text-[11px] font-semibold leading-tight flex items-start gap-1.5" style={{ color: '#fca5a5' }}>
                                <span className="mt-0.5 h-1 w-1 rounded-full bg-red-400 shrink-0" /> {err}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Footer Modal Massal - stacked on mobile */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="text-xs text-center sm:text-left" style={{ color: 'var(--text-secondary)' }}>
                    Total: <strong className="text-white">{bulkRows.length} baris</strong> <span className="hidden sm:inline">({validBulkRows.length} siap disimpan)</span><span className="sm:hidden">• {validBulkRows.length} valid</span>
                  </div>
                  <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <Button
                      type="button"
                      variant="ghost"
                      className="rounded-xl text-slate-200 hover:text-white hover:bg-white/5 border-0 text-sm font-semibold h-11 sm:h-10 w-full sm:w-auto"
                      onClick={() => setIsOpen(false)}
                    >
                      Batal
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSaveBulk}
                      disabled={isSaving || activeBulkRows.length === 0 || hasBulkErrors}
                      className="btn-primary text-white font-bold px-5 rounded-xl h-11 sm:h-10 text-sm gap-2 w-full sm:w-auto justify-center"
                    >
                      {isSaving ? 'Menyimpan...' : `Simpan ${validBulkRows.length} Produk`}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter Bar — warm, no white border */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          <Input
            placeholder="Cari nama atau SKU..."
            className="pl-10 h-11 rounded-xl border-0 focus-visible:ring-1"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--border)' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterCategory} onValueChange={(val) => setFilterCategory(val || 'all')}>
          <SelectTrigger className="w-full sm:w-52 h-11 rounded-xl border-0"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
            <span className="flex-1 text-left truncate">{filterCategory === 'all' ? 'Semua Jenis' : categories.find(c => c.id === filterCategory)?.name || 'Semua Jenis'}</span>
          </SelectTrigger>
          <SelectContent style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}>
            <SelectItem value="all">Semua Jenis</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List Produk — desktop table, mobile cards for Android */}
      <Card className="hidden sm:block border-0 overflow-hidden rounded-2xl shadow-lg" style={{ background: 'var(--bg-card)', boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b hover:bg-transparent" style={{ background: 'rgba(255,107,53,0.04)', borderColor: 'var(--border)' }}>
                <TableHead className="text-xs font-bold uppercase tracking-wider w-14" style={{ color: 'var(--text-secondary)' }}>Jenis</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>SKU</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Produk</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-right" style={{ color: 'var(--text-secondary)' }}>Harga</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-center" style={{ color: 'var(--text-secondary)' }}>Stok</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-center w-[110px]" style={{ color: 'var(--text-secondary)' }}>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 font-medium" style={{ color: 'var(--text-secondary)' }}>Memuat...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16">
                    <div className="inline-flex p-4 rounded-full mb-3" style={{ background: 'rgba(255,107,53,0.08)', border: '1px solid var(--border)' }}>
                      <PackageSearch className="h-12 w-12 opacity-40" style={{ color: '#ff6b35' }} />
                    </div>
                    <h3 className="text-lg font-bold text-white">Produk Tidak Ditemukan</h3>
                    <p className="text-sm mt-1 max-w-[300px] mx-auto" style={{ color: 'var(--text-secondary)' }}>Coba ubah filter atau tambah produk baru.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => {
                  const visual = getCategoryVisual(p.categories?.name)
                  const Icon = visual.icon
                  const pUnit = p.unit || 'pcs'
                  return (
                    <TableRow key={p.id} className="group border-b hover:bg-white/[0.02] transition-colors"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <TableCell>
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: visual.iconBg, border: `1px solid ${visual.iconBorder}` }}>
                          <Icon className="h-5 w-5" style={{ color: visual.iconColor }} />
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm font-bold" style={{ color: '#ff8c42' }}>{p.sku}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{p.name}</span>
                          {p.unit && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ background: 'rgba(255,107,53,0.1)', color: '#ff8c42', border: '1px solid rgba(255,107,53,0.2)' }}>
                              {pUnit}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-white">
                        Rp {p.price.toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell className="text-center">{stockBadge(p.stock)}</TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg border-0 hover:bg-white/5" style={{ color: '#ffb86a' }} onClick={() => handleOpenEdit(p)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg border-0 hover:bg-red-500/10" style={{ color: '#fca5a5' }} onClick={() => handleDelete(p.id, p.name)} title="Hapus" disabled={deleteProduct.isPending}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Mobile Cards — Android optimized, no horizontal scroll */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          <div className="text-center py-10 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Memuat...</div>
        ) : filtered.length === 0 ? (
          <Card className="border-0 rounded-2xl p-8 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="inline-flex p-4 rounded-full mb-3" style={{ background: 'rgba(255,107,53,0.08)', border: '1px solid var(--border)' }}>
              <PackageSearch className="h-10 w-10 opacity-40" style={{ color: '#ff6b35' }} />
            </div>
            <h3 className="text-base font-bold text-white">Produk Tidak Ditemukan</h3>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Coba ubah filter atau tambah produk baru.</p>
          </Card>
        ) : (
          filtered.map((p) => {
            const visual = getCategoryVisual(p.categories?.name)
            const Icon = visual.icon
            const pUnit = p.unit || 'pcs'
            return (
              <div key={p.id} className="rounded-2xl border p-4 space-y-3 shadow-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
                <div className="flex gap-3 items-start">
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: visual.iconBg, border: `1px solid ${visual.iconBorder}` }}>
                    <Icon className="h-6 w-6" style={{ color: visual.iconColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white text-[15px] leading-tight truncate pr-2">{p.name}</div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="font-mono text-xs font-bold" style={{ color: '#ff8c42' }}>{p.sku}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0" style={{ background: 'rgba(255,107,53,0.1)', color: '#ff8c42', border: '1px solid rgba(255,107,53,0.2)' }}>
                        {pUnit}
                      </span>
                    </div>
                    <div className="text-sm font-black text-white mt-1.5">Rp {p.price.toLocaleString('id-ID')}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="scale-90 origin-left">
                    {stockBadge(p.stock)}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl border-0 hover:bg-white/5" style={{ color: '#ffb86a', background: 'rgba(255,184,106,0.08)', border: '1px solid rgba(255,184,106,0.15)' }} onClick={() => handleOpenEdit(p)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl border-0 hover:bg-red-500/10" style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }} onClick={() => handleDelete(p.id, p.name)} title="Hapus" disabled={deleteProduct.isPending}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
