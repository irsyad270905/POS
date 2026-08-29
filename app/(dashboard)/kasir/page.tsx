'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  ShoppingCart, Plus, Minus, Trash2, Search, Package,
  CreditCard, Banknote, QrCode, ArrowRight, CheckCircle2, Printer, LayoutGrid,
} from 'lucide-react'
import { useKasirProducts } from '@/lib/queries/products'
import { useCategories } from '@/lib/queries/categories'
import { useCheckout } from '@/lib/queries/transactions'
import { getCategoryVisual } from '@/lib/categoryVisual'
import type { Product } from '@/lib/queries/products'

type CartItem = Product & { quantity: number }

type ReceiptData = {
  invoice_number: string; subtotal: number; tax_amount: number; total_amount: number
  payment_method: string; amount_paid: number; change_amount: number; created_at: string
  items: CartItem[]
}

export default function KasirPage() {
  const { data: products = [], isLoading: productsLoading } = useKasirProducts()
  const { data: categories = [], isLoading: categoriesLoading } = useCategories()
  const checkout = useCheckout()
  const loading = productsLoading || categoriesLoading

  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [showCheckout, setShowCheckout] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [amountPaid, setAmountPaid] = useState('')
  const [showReceipt, setShowReceipt] = useState(false)
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const [showMobileCart, setShowMobileCart] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const isSearching = search.trim().length > 0

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
    const matchCat = !activeCategory || activeCategory === 'all' || p.category_id === activeCategory
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
      if (newQty <= 0) return []
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
  const total = subtotal
  const change = parseFloat(amountPaid || '0') - total

  const handleCheckout = async () => {
    if (paymentMethod === 'cash' && change < 0) {
      toast.error('Pembayaran kurang!'); return
    }
    try {
      const items = cart.map(i => ({ product_id: i.id, quantity: i.quantity }))
      const paid = paymentMethod === 'cash' ? parseFloat(amountPaid) : total
      const data = await checkout.mutateAsync({ items, payment_method: paymentMethod, amount_paid: paid })
      setReceipt({
        invoice_number: data.invoice_number,
        subtotal: data.subtotal,
        tax_amount: data.tax_amount,
        total_amount: data.total_amount,
        payment_method: data.payment_method,
        amount_paid: data.amount_paid,
        change_amount: data.change_amount,
        created_at: data.created_at,
        items: [...cart],
      })
      toast.success('Transaksi berhasil!')
      setShowCheckout(false)
      setShowMobileCart(false)
      setShowReceipt(true)
      setCart([])
      setAmountPaid('')
      setPaymentMethod('cash')
      setActiveCategory(null)
    } catch (err: unknown) {
      toast.error('Gagal: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  const paymentLabel = (m: string) => {
    switch (m) { case 'cash': return 'Tunai'; case 'qris': return 'QRIS'; case 'transfer': return 'Transfer'; default: return m }
  }
  const quickAmounts = [50000, 100000, 150000, 200000, 500000]
  const getStockBadge = (stock: number) => {
    if (stock < 5) return 'badge-danger'
    if (stock < 10) return 'badge-warning'
    return 'badge-success'
  }

  const showProductGrid = activeCategory !== null || isSearching

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 h-[calc(100vh-5rem)] lg:h-[calc(100vh-7.5rem)] relative">
      {/* LEFT — Products */}
      <div className={`relative flex-1 flex flex-col gap-3 lg:gap-4 min-w-0 overflow-hidden ${showMobileCart ? 'hidden lg:flex' : 'flex'}`}>
        {/* Search */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
            <Input
              ref={searchRef}
              placeholder="Cari produk atau SKU... (F2)"
              className="pl-10 pr-12 h-11 rounded-xl border-0 focus-visible:ring-1 text-sm"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--border)' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 select-none items-center rounded-md border-0 px-1.5 font-mono text-[10px] font-medium"
              style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
              F2
            </kbd>
          </div>
          {showProductGrid && (
            <Button variant="ghost" className="shrink-0 h-11 rounded-xl border-0 px-4 gap-2 text-sm font-semibold"
              style={{ background: 'var(--bg-surface)', color: 'var(--accent-primary)', boxShadow: 'inset 0 0 0 1px var(--border)' }}
              onClick={() => { setActiveCategory(null); setSearch('') }}>
              <LayoutGrid className="h-4 w-4" /> Kategori
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          {loading ? (
            <div className="flex items-center justify-center h-full font-medium" style={{ color: 'var(--text-secondary)' }}>Memuat...</div>
          ) : !showProductGrid ? (
            /* Category Grid — default view */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 p-1">
              {/* Semua card */}
              <Card
                className="group cursor-pointer border-0 overflow-hidden rounded-2xl transition-all duration-200 hover:-translate-y-1 active:scale-[0.98]"
                style={{ background: 'var(--bg-card)', boxShadow: '0 4px 20px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,184,106,0.10)' }}
                onClick={() => setActiveCategory('all')}
              >
                <CardContent className="p-0 flex flex-col items-center justify-center h-28 gap-2">
                  <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,184,106,0.12)', border: '1px solid rgba(255,184,106,0.18)' }}>
                    <LayoutGrid className="h-7 w-7" style={{ color: '#ffb86a' }} />
                  </div>
                  <span className="text-sm font-bold text-white">Semua</span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{products.length} produk</span>
                </CardContent>
              </Card>

              {categories.map(c => {
                const v = getCategoryVisual(c.name)
                const Icon = v.icon
                const count = products.filter(p => p.category_id === c.id).length
                return (
                  <Card
                    key={c.id}
                    className="group cursor-pointer border-0 overflow-hidden rounded-2xl transition-all duration-200 hover:-translate-y-1 active:scale-[0.98]"
                    style={{ background: 'var(--bg-card)', boxShadow: `0 4px 20px rgba(0,0,0,0.25), inset 0 0 0 1px ${v.cardBorder}` }}
                    onClick={() => setActiveCategory(c.id)}
                  >
                    <CardContent className="p-0 flex flex-col items-center justify-center h-28 gap-2 relative overflow-hidden">
                      <div className="absolute inset-0 opacity-40" style={{ background: `radial-gradient(300px 150px at 50% 0%, ${v.iconBg}, transparent 70%)` }} />
                      <Icon className="absolute -right-3 -bottom-3 h-20 w-20 opacity-[0.05]" style={{ color: v.iconColor }} />
                      <div className="relative h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: v.iconBg, border: `1px solid ${v.iconBorder}` }}>
                        <Icon className="h-7 w-7" style={{ color: v.iconColor }} />
                      </div>
                      <span className="relative text-sm font-bold text-white">{c.name}</span>
                      <span className="relative text-[10px]" style={{ color: 'var(--text-muted)' }}>{count} produk</span>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-secondary)' }}>
              <Package className="h-14 w-14 opacity-20 mb-3" />
              <p className="font-semibold">Produk tidak ditemukan</p>
            </div>
          ) : (
            /* Product Grid */
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5 p-1">
              {filteredProducts.map(p => {
                const visual = getCategoryVisual(p.categories?.name)
                const CatIcon = visual.icon
                return (
                  <Card
                    key={p.id}
                    className="group cursor-pointer border-0 overflow-hidden rounded-2xl transition-all duration-200 hover:-translate-y-1 active:scale-[0.98]"
                    style={{ background: 'var(--bg-card)', boxShadow: `0 4px 20px rgba(0,0,0,0.25), inset 0 0 0 1px ${visual.cardBorder}` }}
                    onClick={() => addToCart(p)}
                  >
                    <CardContent className="p-0 flex flex-col h-full">
                      <div className="relative h-32 overflow-hidden" style={{ background: visual.headerBg }}>
                        <div className="absolute inset-0 opacity-50" style={{ background: `radial-gradient(520px 200px at 50% 0%, ${visual.iconBg}, transparent 70%)` }} />
                        <CatIcon className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-28 w-28 opacity-[0.06] rotate-3" style={{ color: visual.iconColor }} />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-inner" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${visual.iconBorder}`, backdropFilter: 'blur(8px)', boxShadow: `0 8px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)` }}>
                            <CatIcon className="h-8 w-8" style={{ color: visual.iconColor }} />
                          </div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-10" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.22), transparent)' }} />
                        <div className="absolute top-2.5 left-2.5">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide px-2 py-1 rounded-full backdrop-blur-md" style={{ background: visual.badgeBg, color: visual.badgeColor, border: `1px solid ${visual.badgeBorder}` }}>
                            <CatIcon className="h-3 w-3" /> {p.categories?.name || 'Lainnya'}
                          </span>
                        </div>
                        <div className="absolute top-2.5 right-2.5">
                          <span className={`${getStockBadge(p.stock)} text-[10px] px-2 py-0.5 backdrop-blur-md`}>
                            {p.stock}
                          </span>
                        </div>
                      </div>
                      <div className="p-3 flex flex-col gap-1.5 flex-1" style={{ background: 'var(--bg-card)' }}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-bold text-sm leading-tight text-white line-clamp-2 group-hover:text-amber-100 transition-colors">{p.name}</h3>
                          {p.unit && p.unit !== 'pcs' && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase shrink-0" style={{ background: 'rgba(255,107,53,0.14)', color: '#ff8c42', border: '1px solid rgba(255,107,53,0.2)' }}>
                              {p.unit}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-auto pt-1">
                          <span className="font-black text-[15px]" style={{ color: visual.iconColor }}>Rp {p.price.toLocaleString('id-ID')}</span>
                          <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{p.sku}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* Mobile cart button */}
        <div className="lg:hidden absolute bottom-0 left-0 right-0 p-3 backdrop-blur-md border-t z-10" style={{ background: 'rgba(20,14,10,0.92)', borderColor: 'var(--border)' }}>
          <Button className="w-full h-11 rounded-xl btn-primary text-sm font-bold" onClick={() => setShowMobileCart(true)}>
            Lihat Keranjang ({cart.reduce((a, i) => a + i.quantity, 0)}) • Rp {total.toLocaleString('id-ID')}
          </Button>
        </div>
      </div>

      {/* RIGHT — Cart */}
      <div className={`w-full lg:w-[380px] shrink-0 flex-col rounded-2xl overflow-hidden ${showMobileCart ? 'flex' : 'hidden lg:flex'} h-full lg:h-auto z-20`} style={{ background: 'var(--bg-surface)', boxShadow: '0 10px 40px rgba(0,0,0,0.35), inset 0 0 0 1px var(--border)' }}>
        <div className="lg:hidden p-3 border-b flex items-center" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
          <Button variant="ghost" className="h-8 gap-2 text-white hover:bg-white/5 border-0" onClick={() => setShowMobileCart(false)}>
            <ArrowRight className="h-4 w-4 rotate-180" /> Kembali
          </Button>
        </div>
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)', background: 'rgba(255,107,53,0.04)' }}>
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" style={{ color: '#ff6b35' }} />
            <span className="font-bold text-white">Keranjang</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="text-white font-black rounded-full px-2.5 py-0.5 border-0" style={{ background: '#ff6b35' }}>{cart.reduce((a, i) => a + i.quantity, 0)}</Badge>
            {cart.length > 0 && <Button variant="ghost" size="sm" className="text-xs border-0 hover:bg-red-500/10" style={{ color: '#fca5a5' }} onClick={clearCart}>Hapus</Button>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-40 py-10" style={{ color: 'var(--text-secondary)' }}>
              <ShoppingCart className="h-12 w-12 mb-3" />
              <p className="font-semibold text-sm">Keranjang kosong</p>
              <p className="text-xs mt-1">Tap produk untuk menambahkan</p>
            </div>
          ) : (
            cart.map(item => {
              const v = getCategoryVisual(item.categories?.name)
              const Icon = v.icon
              const itemUnit = item.unit || 'pcs'
              return (
                <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-xl group" style={{ background: 'var(--bg-card)', boxShadow: `inset 0 0 0 1px ${v.cardBorder}` }}>
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: v.iconBg, border: `1px solid ${v.iconBorder}` }}>
                    <Icon className="h-4 w-4" style={{ color: v.iconColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-sm truncate text-white">{item.name}</p>
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase shrink-0" style={{ background: 'rgba(255,107,53,0.1)', color: '#ff8c42' }}>
                        {itemUnit}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>@Rp {item.price.toLocaleString('id-ID')}</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-full px-1 py-0.5" style={{ background: 'var(--bg-surface)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full border-0 hover:bg-white/5" onClick={() => updateQuantity(item.id, -1)}><Minus className="h-3 w-3 text-white" /></Button>
                    <input type="number" min="1" max={item.stock} value={item.quantity === 0 ? '' : item.quantity} onChange={(e) => handleQuantityInput(item.id, e.target.value)} onBlur={() => { if (item.quantity === 0) handleQuantityInput(item.id, '1') }} className="w-9 bg-transparent text-center text-sm font-bold text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full border-0 hover:bg-white/5" onClick={() => updateQuantity(item.id, 1)}><Plus className="h-3 w-3 text-white" /></Button>
                  </div>
                  <div className="text-right min-w-[74px] hidden sm:block">
                    <p className="font-black text-xs text-white">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full opacity-60 group-hover:opacity-100 hover:bg-red-500/10 border-0" onClick={() => removeFromCart(item.id)}><Trash2 className="h-3.5 w-3.5" style={{ color: '#fca5a5' }} /></Button>
                </div>
              )
            })
          )}
        </div>

        <div className="border-t p-4 space-y-3" style={{ borderColor: 'var(--border)', background: 'rgba(255,107,53,0.03)' }}>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>Subtotal</span><span className="font-semibold text-white">Rp {subtotal.toLocaleString('id-ID')}</span></div>
            <div className="h-px" style={{ background: 'var(--border)' }} />
            <div className="flex justify-between items-center"><span className="font-bold text-white">Total</span><span className="font-black text-xl" style={{ color: '#ff6b35' }}>Rp {total.toLocaleString('id-ID')}</span></div>
          </div>
          <Button className="w-full h-11 rounded-xl btn-primary font-bold gap-2" disabled={cart.length === 0} onClick={() => { setAmountPaid(total.toString()); setShowCheckout(true) }}>
            <ArrowRight className="h-4 w-4" /> Bayar Sekarang
          </Button>
        </div>
      </div>

      {/* Checkout */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="sm:max-w-md rounded-2xl border-0 shadow-2xl" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
          <DialogHeader><DialogTitle className="text-lg font-bold text-white">Pembayaran</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="text-center p-4 rounded-xl" style={{ background: 'var(--bg-card)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total bayar</p>
              <p className="text-3xl font-black" style={{ color: '#ff6b35' }}>Rp {total.toLocaleString('id-ID')}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Metode</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'cash', label: 'Tunai', icon: Banknote },
                  { value: 'qris', label: 'QRIS', icon: QrCode },
                  { value: 'transfer', label: 'Transfer', icon: CreditCard },
                ].map(m => (
                  <Button key={m.value} variant={paymentMethod === m.value ? 'default' : 'outline'} className="h-14 flex-col gap-1 rounded-xl border-0" style={paymentMethod === m.value ? { background: 'linear-gradient(135deg, #ff6b35 0%, #e85d27 100%)', color: '#fff7ed', boxShadow: '0 4px 14px rgba(255,107,53,0.32)' } : { background: 'var(--bg-card)', color: 'var(--text-secondary)', boxShadow: 'inset 0 0 0 1px var(--border)' }} onClick={() => { setPaymentMethod(m.value); if (m.value !== 'cash') setAmountPaid(total.toString()) }}>
                    <m.icon className="h-5 w-5" /><span className="text-xs font-bold">{m.label}</span>
                  </Button>
                ))}
              </div>
            </div>
            {paymentMethod === 'cash' && (
              <div className="space-y-2">
                <Label className="text-sm" style={{ color: 'var(--text-secondary)' }}>Dibayar</Label>
                <Input type="number" min={0} className="h-11 text-center font-bold rounded-xl border-0" style={{ background: 'var(--bg-card)', color: 'white', boxShadow: 'inset 0 0 0 1px var(--border)' }} value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} autoFocus />
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" size="sm" className="rounded-full border-0 text-xs" style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', boxShadow: 'inset 0 0 0 1px var(--border)' }} onClick={() => setAmountPaid(total.toString())}>Pas</Button>
                  {quickAmounts.filter(a => a >= total).slice(0, 4).map(a => (
                    <Button key={a} variant="ghost" size="sm" className="rounded-full border-0 text-xs" style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', boxShadow: 'inset 0 0 0 1px var(--border)' }} onClick={() => setAmountPaid(a.toString())}>Rp {a.toLocaleString('id-ID')}</Button>
                  ))}
                </div>
                {parseFloat(amountPaid || '0') >= total && (
                  <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(16,185,129,0.08)', boxShadow: 'inset 0 0 0 1px rgba(16,185,129,0.14)' }}>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Kembalian</p>
                    <p className="text-xl font-black" style={{ color: '#6ee7b7' }}>Rp {change.toLocaleString('id-ID')}</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" className="rounded-xl border-0 hover:bg-white/5 text-white" onClick={() => setShowCheckout(false)}>Batal</Button>
            <Button onClick={handleCheckout} disabled={checkout.isPending || (paymentMethod === 'cash' && change < 0)} className="btn-primary flex-1 h-10 rounded-xl"> {checkout.isPending ? 'Memproses...' : 'Konfirmasi'} </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="sm:max-w-sm rounded-2xl border-0 shadow-2xl" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
          <div className="text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 mx-auto" style={{ color: '#6ee7b7' }} />
            <div><h2 className="text-lg font-bold text-white">Berhasil!</h2><p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Transaksi tercatat</p></div>
            {receipt && (
              <div className="text-left space-y-3 rounded-xl p-4" style={{ background: 'var(--bg-card)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
                <div className="text-center border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                  <h3 className="font-black text-white">AISh POS</h3>
                  <p className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{receipt.invoice_number}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(receipt.created_at).toLocaleString('id-ID')}</p>
                </div>
                <div className="space-y-1.5">
                  {receipt.items.map(item => {
                    const v = getCategoryVisual(item.categories?.name)
                    const Icon = v.icon
                    const itemUnit = item.unit || 'pcs'
                    return (
                      <div key={item.id} className="flex items-center gap-2 text-sm">
                        <div className="h-6 w-6 rounded-md flex items-center justify-center shrink-0" style={{ background: v.iconBg, border: `1px solid ${v.iconBorder}` }}>
                          <Icon className="h-3 w-3" style={{ color: v.iconColor }} />
                        </div>
                        <span className="flex-1 truncate text-white/90">{item.name} <span className="text-xs opacity-75">({item.quantity} {itemUnit})</span></span>
                        <span className="font-bold text-white ml-1">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="border-t pt-2 space-y-1 text-sm" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex justify-between font-bold text-white"><span>Total</span><span style={{ color: '#ff6b35' }}>Rp {receipt.total_amount.toLocaleString('id-ID')}</span></div>
                  <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}><span>Bayar ({paymentLabel(receipt.payment_method)})</span><span className="text-white">Rp {receipt.amount_paid.toLocaleString('id-ID')}</span></div>
                  {receipt.payment_method === 'cash' && <div className="flex justify-between font-bold" style={{ color: '#6ee7b7' }}><span>Kembalian</span><span>Rp {receipt.change_amount.toLocaleString('id-ID')}</span></div>}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" className="gap-2 rounded-xl border-0 hover:bg-white/5 text-white" onClick={() => window.print()}><Printer className="h-4 w-4" /> Cetak</Button>
            <Button onClick={() => setShowReceipt(false)} className="btn-primary flex-1 h-10 rounded-xl">Transaksi Baru</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
