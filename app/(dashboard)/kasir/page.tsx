'use client'

export const dynamic = 'force-dynamic'

// CHANGED: Updated all color tokens from gold to orange, product cards now show product images, category filter redesigned
// UNCHANGED: Supabase checkout calculations, quick amounts lists, print window triggers, searchRef keys

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import Image from 'next/image'
import {
  ShoppingCart, Plus, Minus, Trash2, Search, Package,
  CreditCard, Banknote, QrCode, ArrowRight, CheckCircle2, Printer,
  Utensils, GlassWater, Cookie, Sparkles
} from 'lucide-react'

type Category = { id: string; name: string }
type Product = {
  id: string; name: string; sku: string; price: number; stock: number
  category_id: string | null; categories: { name: string } | null
  image_url: string | null
}
type CartItem = Product & { quantity: number }

type ReceiptData = {
  invoice_number: string; subtotal: number; tax_amount: number; total_amount: number
  payment_method: string; amount_paid: number; change_amount: number; created_at: string
  items: CartItem[]
}

export default function KasirPage() {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')

  // Checkout
  const [showCheckout, setShowCheckout] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [amountPaid, setAmountPaid] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  // Receipt
  const [showReceipt, setShowReceipt] = useState(false)
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)

  // Mobile layout state
  const [showMobileCart, setShowMobileCart] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').order('name')
    setCategories(data || [])
  }, [supabase])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select('*, categories(name)')
      .gt('stock', 0)
      .order('name')
    setProducts((data as unknown as Product[]) || [])
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
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus() }
    }
    window.addEventListener('keydown', handler)
    return () => {
      active = false
      window.removeEventListener('keydown', handler)
    }
  }, [fetchProducts, fetchCategories])

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
    const matchCat = activeCategory === 'all' || p.category_id === activeCategory
    return matchSearch && matchCat
  })

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id)
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast.error(`Stok ${product.name} hanya ${product.stock}`)
          return prev
        }
        return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { ...product, quantity: 1 }]
    })
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.flatMap(item => {
      if (item.id !== id) return [item]
      const newQty = item.quantity + delta
      if (newQty <= 0) return [] // remove
      if (newQty > item.stock) { toast.error(`Stok maks ${item.stock}`); return [item] }
      return [{ ...item, quantity: newQty }]
    }))
  }

  const handleQuantityInput = (id: string, val: string) => {
    if (val === '') {
      setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: 0 } : item))
      return
    }
    const parsed = parseInt(val)
    if (isNaN(parsed) || parsed < 0) return

    setCart(prev => prev.map(item => {
      if (item.id !== id) return item
      if (parsed > item.stock) {
        toast.error(`Stok maks ${item.stock}`)
        return { ...item, quantity: item.stock }
      }
      return { ...item, quantity: parsed }
    }))
  }

  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.id !== id))
  const clearCart = () => setCart([])

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const tax = 0
  const total = subtotal + tax
  const change = parseFloat(amountPaid || '0') - total

  const handleCheckout = async () => {
    if (paymentMethod === 'cash' && change < 0) {
      toast.error('Pembayaran kurang!'); return
    }

    setCheckoutLoading(true)
    try {
      const items = cart.map(i => ({ product_id: i.id, quantity: i.quantity }))
      const paid = paymentMethod === 'cash' ? parseFloat(amountPaid) : total

      const { data, error } = await supabase.rpc('process_checkout', {
        p_items: items,
        p_payment_method: paymentMethod,
        p_amount_paid: paid,
      })

      if (error) throw error

      setReceipt({
        invoice_number: data.invoice_number,
        subtotal: Number(data.subtotal),
        tax_amount: Number(data.tax_amount),
        total_amount: Number(data.total_amount),
        payment_method: data.payment_method,
        amount_paid: Number(data.amount_paid),
        change_amount: Number(data.change_amount),
        created_at: data.created_at,
        items: [...cart],
      })

      toast.success('Transaksi berhasil! 🎉')
      setShowCheckout(false)
      setShowMobileCart(false)
      setShowReceipt(true)
      setCart([])
      setAmountPaid('')
      setPaymentMethod('cash')
      fetchProducts()
    } catch (err: unknown) {
      toast.error('Gagal: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setCheckoutLoading(false)
    }
  }

  const paymentLabel = (m: string) => {
    switch (m) { case 'cash': return 'Tunai'; case 'qris': return 'QRIS'; case 'transfer': return 'Transfer'; default: return m }
  }

  const quickAmounts = [50000, 100000, 150000, 200000, 500000]

  const getCategoryStyles = (catName: string) => {
    const name = (catName || '').toLowerCase()
    if (name.includes('makanan')) {
      return {
        gradient: 'from-orange-500/8 to-red-600/5 hover:from-orange-500/15 hover:to-red-600/10',
        glow: 'hover:shadow-[0_8px_30px_rgba(255,107,53,0.15)] hover:border-orange-500/30',
        badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        icon: Utensils
      }
    }
    if (name.includes('minuman')) {
      return {
        gradient: 'from-blue-600/8 to-cyan-700/5 hover:from-blue-600/15 hover:to-cyan-700/10',
        glow: 'hover:shadow-[0_8px_30px_rgba(59,130,246,0.1)] hover:border-blue-600/30',
        badge: 'bg-blue-600/10 text-blue-400 border-blue-600/20',
        icon: GlassWater
      }
    }
    if (name.includes('snack') || name.includes('camilan')) {
      return {
        gradient: 'from-purple-500/8 to-violet-600/5 hover:from-purple-500/15 hover:to-violet-600/10',
        glow: 'hover:shadow-[0_8px_30px_rgba(168,85,247,0.1)] hover:border-purple-500/30',
        badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        icon: Cookie
      }
    }
    return {
      gradient: 'from-[var(--accent-primary)]/5 to-[var(--accent-secondary)]/5 hover:from-[var(--accent-primary)]/12 hover:to-[var(--accent-secondary)]/12',
      glow: 'hover:shadow-[0_8px_30px_rgba(255,107,53,0.15)] hover:border-[var(--accent-primary)]/30',
      badge: 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border-[var(--accent-primary)]/20',
      icon: Sparkles
    }
  }

  const getStockBadge = (stock: number) => {
    if (stock < 5) return 'badge-danger'
    if (stock < 10) return 'badge-warning'
    return 'badge-success'
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-[calc(100vh-5rem)] lg:h-[calc(100vh-7.5rem)] relative">
      {/* LEFT — Products */}
      <div className={`relative flex-1 flex flex-col gap-3 lg:gap-4 min-w-0 overflow-hidden ${showMobileCart ? 'hidden lg:flex' : 'flex'}`}>
        {/* Search + Category */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
            <Input
              ref={searchRef}
              placeholder="Cari produk atau SKU... (F2)"
              className="pl-9 pr-12 h-11 rounded-xl text-sm transition-all duration-200"
              style={{ background: 'var(--bg-surface)', borderColor: 'rgba(255,255,255,0.07)', color: 'var(--text-primary)' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium shadow-sm"
              style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'var(--bg-card)', color: 'var(--text-secondary)' }}>
              F2
            </kbd>
          </div>
          <Select value={activeCategory} onValueChange={(val) => setActiveCategory(val || 'all')}>
            <SelectTrigger className="w-full sm:w-48 h-11 rounded-xl transition-all duration-200"
              style={{ background: 'var(--bg-surface)', borderColor: 'rgba(255,255,255,0.07)', color: 'var(--text-primary)' }}>
              <SelectValue placeholder="Semua Kategori">
                {activeCategory === 'all' ? 'Semua Kategori' : (categories.find(c => c.id === activeCategory)?.name || '')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent style={{ background: 'var(--bg-surface)', borderColor: 'rgba(255,107,53,0.15)' }}>
              <SelectItem value="all">Semua Kategori</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          {loading ? (
            <div className="flex items-center justify-center h-full font-semibold" style={{ color: 'var(--text-secondary)' }}>Memuat produk...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-secondary)' }}>
              <Package className="h-16 w-16 opacity-20 mb-3" />
              <p className="font-semibold">Produk tidak ditemukan</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5 p-1">
              {filteredProducts.map(p => {
                const styles = getCategoryStyles(p.categories?.name || '')
                const CatIcon = styles.icon
                return (
                  <Card
                    key={p.id}
                    className={`group cursor-pointer border border-[var(--border)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br ${styles.gradient} ${styles.glow} rounded-2xl active:scale-[0.97]`}
                    style={{ background: 'var(--bg-card)' }}
                    onClick={() => addToCart(p)}
                  >
                    <CardContent className="p-0 flex flex-col h-full">
                      {/* Product Image Area */}
                      <div className="relative h-28 rounded-t-2xl overflow-hidden"
                        style={{ background: 'rgba(255,107,53,0.06)' }}>
                        {p.image_url ? (
                          <Image
                            src={p.image_url}
                            alt={p.name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            unoptimized
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <CatIcon className="h-10 w-10 opacity-20" style={{ color: '#FF6B35' }} />
                          </div>
                        )}
                        {/* Category badge overlay */}
                        <div className="absolute top-2 left-2">
                          <Badge className={`text-[9px] border tracking-wide font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 ${styles.badge}`}>
                            <CatIcon className="h-2.5 w-2.5" />
                            {p.categories?.name || '—'}
                          </Badge>
                        </div>
                      </div>

                      {/* Product Info */}
                      <div className="p-3 flex flex-col gap-2 flex-1">
                        <div className="flex items-start justify-between gap-1">
                          <h3 className="font-bold text-sm leading-snug text-slate-100 group-hover:text-[var(--accent-primary)] transition-colors duration-200 line-clamp-2 flex-1">{p.name}</h3>
                          <span className="text-[9px] font-mono shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>{p.sku}</span>
                        </div>
                        <div className="flex items-center justify-between mt-auto">
                          <span className="font-black text-base" style={{ color: '#FF6B35' }}>Rp {p.price.toLocaleString('id-ID')}</span>
                          <span className={`${getStockBadge(p.stock)} text-[10px] px-1.5 py-0`}>
                            {p.stock}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* Mobile: floating cart button */}
        <div className="lg:hidden absolute bottom-0 left-0 right-0 p-3 backdrop-blur-md border-t z-10 shadow-lg"
          style={{ background: 'rgba(17,17,17,0.9)', borderColor: 'rgba(255,107,53,0.15)' }}>
          <Button
            className="w-full h-12 rounded-xl btn-primary text-base transition-all duration-300 active:scale-95 text-white"
            onClick={() => setShowMobileCart(true)}
          >
            Lihat Keranjang ({cart.reduce((a, i) => a + i.quantity, 0)}) • Rp {total.toLocaleString('id-ID')}
          </Button>
        </div>
      </div>

      {/* RIGHT — Cart */}
      <div className={`w-full lg:w-[380px] shrink-0 flex-col backdrop-blur-md lg:rounded-2xl shadow-2xl shadow-black/40 lg:border overflow-hidden ${showMobileCart ? 'flex' : 'hidden lg:flex'} h-full lg:h-auto z-20`}
        style={{ background: 'rgba(26,26,26,0.85)', borderColor: 'rgba(255,107,53,0.15)' }}>
        {/* Mobile Back Button */}
        <div className="lg:hidden p-3 border-b flex items-center" style={{ background: 'var(--bg-surface)', borderColor: 'rgba(255,107,53,0.1)' }}>
          <Button variant="ghost" className="h-8 gap-2 font-medium text-slate-200 hover:text-white" onClick={() => setShowMobileCart(false)}>
            <ArrowRight className="h-4 w-4 rotate-180" /> Kembali ke Daftar Produk
          </Button>
        </div>

        {/* Cart Header */}
        <div className="p-4 border-b flex items-center justify-between"
          style={{ borderColor: 'rgba(255,107,53,0.1)', background: 'rgba(255,107,53,0.04)' }}>
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" style={{ color: '#FF6B35' }} />
            <span className="font-bold text-lg text-white">Keranjang</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="text-white shadow-sm font-black rounded-lg px-2.5" style={{ background: '#FF6B35' }}>
              {cart.reduce((a, i) => a + i.quantity, 0)}
            </Badge>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" className="text-xs text-red-400 hover:text-red-300 h-7 px-2 hover:bg-red-950/20 rounded-lg transition-colors" onClick={clearCart}>
                Hapus Semua
              </Button>
            )}
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-40" style={{ color: 'var(--text-secondary)' }}>
              <ShoppingCart className="h-14 w-14 mb-3" />
              <p className="font-semibold text-sm">Keranjang kosong</p>
              <p className="text-xs mt-1">Klik produk untuk menambahkan</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-xl border group transition-all duration-200 animate-in fade-in slide-in-from-right-3"
                style={{ background: 'var(--bg-card)', borderColor: 'rgba(255,107,53,0.12)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,107,53,0.3)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,107,53,0.12)' }}
              >
                {/* Cart item image thumbnail */}
                {item.image_url && (
                  <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0 border" style={{ borderColor: 'rgba(255,107,53,0.15)' }}>
                    <Image src={item.image_url} alt={item.name} width={40} height={40} className="h-full w-full object-cover" unoptimized />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate text-slate-100">{item.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>@Rp {item.price.toLocaleString('id-ID')}</p>
                </div>
                {/* Quantity controls */}
                <div className="flex items-center gap-1 rounded-lg border px-1 py-0.5"
                  style={{ background: 'var(--bg-base)', borderColor: 'rgba(255,107,53,0.1)' }}>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-white rounded-md transition-transform active:scale-90" onClick={() => updateQuantity(item.id, -1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <input
                    type="number"
                    min="1"
                    max={item.stock}
                    value={item.quantity === 0 ? '' : item.quantity}
                    onChange={(e) => handleQuantityInput(item.id, e.target.value)}
                    onBlur={() => { if (item.quantity === 0) { handleQuantityInput(item.id, '1') } }}
                    className="w-10 bg-transparent text-center text-sm font-bold text-slate-200 focus:outline-none focus:ring-1 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    style={{ '--tw-ring-color': 'rgba(255,107,53,0.3)' } as React.CSSProperties}
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-white rounded-md transition-transform active:scale-90" onClick={() => updateQuantity(item.id, 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <div className="text-right min-w-[80px]">
                  <p className="font-black text-sm text-white">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity rounded-md hover:bg-red-950/20" onClick={() => removeFromCart(item.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Totals + Checkout */}
        <div className="border-t p-4 backdrop-blur-sm space-y-4" style={{ borderColor: 'rgba(255,107,53,0.12)', background: 'rgba(255,107,53,0.03)' }}>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
              <span className="font-semibold text-slate-200">Rp {subtotal.toLocaleString('id-ID')}</span>
            </div>
            <div className="h-px my-2" style={{ background: 'rgba(255,107,53,0.1)' }} />
            <div className="flex justify-between items-center">
              <span className="font-bold text-lg text-white">Total</span>
              <span className="font-black text-2xl" style={{ color: '#FF6B35' }}>
                Rp {total.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
          <Button
            className="w-full h-12 rounded-xl btn-primary text-base font-bold shadow-lg transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 text-white"
            disabled={cart.length === 0}
            onClick={() => { setAmountPaid(total.toString()); setShowCheckout(true) }}
          >
            <ArrowRight className="h-5 w-5" />
            Proses Pembayaran
          </Button>
        </div>
      </div>

      {/* ========== CHECKOUT DIALOG ========== */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="sm:max-w-md rounded-2xl border" style={{ background: 'var(--bg-surface)', borderColor: 'rgba(255,107,53,0.2)', color: 'var(--text-primary)' }}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">Pembayaran</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="text-center p-4 rounded-xl border" style={{ background: 'var(--bg-base)', borderColor: 'rgba(255,107,53,0.15)' }}>
              <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Total yang harus dibayar</p>
              <p className="text-4xl font-black" style={{ color: '#FF6B35' }}>Rp {total.toLocaleString('id-ID')}</p>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label className="font-semibold text-sm" style={{ color: 'var(--text-secondary)' }}>Metode Pembayaran</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'cash', label: 'Tunai', icon: Banknote },
                  { value: 'qris', label: 'QRIS', icon: QrCode },
                  { value: 'transfer', label: 'Transfer', icon: CreditCard },
                ].map(m => (
                  <Button
                    key={m.value}
                    variant={paymentMethod === m.value ? 'default' : 'outline'}
                    className="h-14 flex-col gap-1 rounded-xl border transition-all duration-200"
                    style={paymentMethod === m.value ? {
                      background: 'linear-gradient(135deg, #FF6B35 0%, #E85D27 100%)',
                      color: '#ffffff',
                      fontWeight: 700,
                      border: 'none',
                      boxShadow: '0 4px 15px rgba(255,107,53,0.35)',
                    } : {
                      background: 'var(--bg-card)',
                      borderColor: 'rgba(255,255,255,0.1)',
                      color: '#cbd5e1',
                    }}
                    onClick={() => { setPaymentMethod(m.value); if (m.value !== 'cash') setAmountPaid(total.toString()) }}
                  >
                    <m.icon className="h-5 w-5" />
                    <span className="text-xs">{m.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Amount Paid (only for cash) */}
            {paymentMethod === 'cash' && (
              <div className="space-y-2 animate-in fade-in duration-200">
                <Label className="font-semibold text-sm" style={{ color: 'var(--text-secondary)' }}>Jumlah Dibayar</Label>
                <Input
                  type="number" min={0} className="h-12 text-xl font-bold text-center rounded-xl text-white border"
                  style={{ background: 'var(--bg-base)', borderColor: 'rgba(255,107,53,0.2)' }}
                  value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)}
                  autoFocus
                />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="text-xs rounded-lg text-slate-300 hover:text-white"
                    style={{ background: 'var(--bg-card)', borderColor: 'rgba(255,255,255,0.1)' }}
                    onClick={() => setAmountPaid(total.toString())}>Uang Pas</Button>
                  {quickAmounts.filter(a => a >= total).slice(0, 4).map(a => (
                    <Button key={a} variant="outline" size="sm" className="text-xs rounded-lg text-slate-300 hover:text-white"
                      style={{ background: 'var(--bg-card)', borderColor: 'rgba(255,255,255,0.1)' }}
                      onClick={() => setAmountPaid(a.toString())}>
                      Rp {a.toLocaleString('id-ID')}
                    </Button>
                  ))}
                </div>
                {parseFloat(amountPaid || '0') >= total && (
                  <div className="p-3 rounded-lg text-center" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Kembalian</p>
                    <p className="text-2xl font-black" style={{ color: 'var(--success)' }}>Rp {change.toLocaleString('id-ID')}</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl text-slate-200 hover:text-white"
              style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'var(--bg-card)' }}
              onClick={() => setShowCheckout(false)}>Batal</Button>
            <Button
              onClick={handleCheckout}
              disabled={checkoutLoading || (paymentMethod === 'cash' && change < 0)}
              className="btn-primary flex-1 h-10 rounded-xl text-white font-bold"
            >
              {checkoutLoading ? 'Memproses...' : 'Konfirmasi Bayar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== RECEIPT DIALOG ========== */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="sm:max-w-sm rounded-2xl border" style={{ background: 'var(--bg-surface)', borderColor: 'rgba(255,107,53,0.2)', color: 'var(--text-primary)' }}>
          <div className="text-center space-y-4" id="receipt">
            <CheckCircle2 className="h-14 w-14 mx-auto animate-bounce" style={{ color: 'var(--success)' }} />
            <div>
              <h2 className="text-xl font-bold text-white">Transaksi Berhasil!</h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Pembayaran telah dikonfirmasi</p>
            </div>

            {receipt && (
              <div className="text-left space-y-3 rounded-xl p-4 border" style={{ background: 'var(--bg-base)', borderColor: 'rgba(255,107,53,0.12)' }}>
                <div className="text-center border-b pb-3" style={{ borderColor: 'rgba(255,107,53,0.1)' }}>
                  <h3 className="font-black text-lg text-white">AISh POS</h3>
                  <p className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{receipt.invoice_number}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{new Date(receipt.created_at).toLocaleString('id-ID')}</p>
                </div>

                <div className="space-y-1">
                  {receipt.items.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="flex-1 truncate text-slate-200">{item.name} x{item.quantity}</span>
                      <span className="font-semibold text-slate-100 ml-2">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-2 space-y-1 text-sm" style={{ borderColor: 'rgba(255,107,53,0.1)' }}>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                    <span className="text-slate-200">Rp {receipt.subtotal.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base border-t pt-1 text-white" style={{ borderColor: 'rgba(255,107,53,0.1)' }}>
                    <span>Total</span><span>Rp {receipt.total_amount.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Bayar ({paymentLabel(receipt.payment_method)})</span>
                    <span className="text-slate-200">Rp {receipt.amount_paid.toLocaleString('id-ID')}</span>
                  </div>
                  {receipt.payment_method === 'cash' && (
                    <div className="flex justify-between font-bold" style={{ color: 'var(--success)' }}>
                      <span>Kembalian</span><span>Rp {receipt.change_amount.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                </div>

                <p className="text-center text-xs border-t pt-2" style={{ color: 'var(--text-secondary)', borderColor: 'rgba(255,107,53,0.1)' }}>
                  Terima kasih telah berbelanja!
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="gap-2 rounded-xl text-slate-200 hover:text-white"
              style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'var(--bg-card)' }}
              onClick={() => { if (typeof window !== 'undefined') window.print() }}>
              <Printer className="h-4 w-4" /> Cetak Struk
            </Button>
            <Button onClick={() => setShowReceipt(false)} className="btn-primary text-white font-bold h-10 rounded-xl flex-1">
              Transaksi Baru
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
