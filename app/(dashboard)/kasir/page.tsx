'use client'

// CHANGED: Redesigned the product cards to use custom category styles, added active key shortcut styles, dynamic stock badges, and satisfying cart controls
// UNCHANGED: Supabase checkout calculations, quick amounts lists, print window triggers, searchRef keys

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  ShoppingCart, Plus, Minus, Trash2, Search, Package,
  CreditCard, Banknote, QrCode, ArrowRight, CheckCircle2, Printer,
  Utensils, GlassWater, Cookie, Sparkles
} from 'lucide-react'

type Category = { id: string; name: string }
type Product = {
  id: string; name: string; sku: string; price: number; stock: number
  category_id: string | null; categories: { name: string } | null
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

  useEffect(() => {
    fetchProducts()
    fetchCategories()
    // Keyboard shortcut: F2 focus search
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name')
    setCategories(data || [])
  }

  const fetchProducts = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select('*, categories(name)')
      .gt('stock', 0)
      .order('name')
    setProducts((data as any) || [])
    setLoading(false)
  }

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
    } catch (err: any) {
      toast.error('Gagal: ' + err.message)
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
        gradient: 'from-orange-500/5 to-amber-500/5 hover:from-orange-500/10 hover:to-amber-500/10',
        glow: 'hover:shadow-[0_8px_30px_rgba(245,158,11,0.1)] hover:border-amber-500/30',
        badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        icon: Utensils
      }
    }
    if (name.includes('minuman')) {
      return {
        gradient: 'from-cyan-500/5 to-blue-500/5 hover:from-cyan-500/10 hover:to-blue-500/10',
        glow: 'hover:shadow-[0_8px_30px_rgba(59,130,246,0.1)] hover:border-blue-500/30',
        badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        icon: GlassWater
      }
    }
    if (name.includes('snack') || name.includes('camilan')) {
      return {
        gradient: 'from-purple-500/5 to-pink-500/5 hover:from-purple-500/10 hover:to-pink-500/10',
        glow: 'hover:shadow-[0_8px_30px_rgba(168,85,247,0.1)] hover:border-purple-500/30',
        badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        icon: Cookie
      }
    }
    return {
      gradient: 'from-[var(--accent-primary)]/5 to-[var(--accent-secondary)]/5 hover:from-[var(--accent-primary)]/10 hover:to-[var(--accent-secondary)]/10',
      glow: 'hover:shadow-[0_8px_30px_var(--accent-glow)] hover:border-[var(--accent-primary)]/30',
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
      <div className={`flex-1 flex-col gap-3 lg:gap-4 min-w-0 overflow-hidden ${showMobileCart ? 'hidden lg:flex' : 'flex'}`}>
        {/* Search + Category */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]" />
            <Input
              ref={searchRef}
              placeholder="Cari produk atau SKU... (F2)"
              className="pl-9 pr-12 h-11 rounded-xl bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-primary)] focus-visible:ring-[var(--accent-primary)] focus-visible:border-[var(--accent-primary)] transition-all duration-200 text-sm shadow-inner focus:shadow-[0_0_15px_rgba(20,184,166,0.12)]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-[var(--border)] bg-[var(--bg-card)] px-1.5 font-mono text-[10px] font-medium text-[var(--text-secondary)] shadow-sm">
              F2
            </kbd>
          </div>
          <Select value={activeCategory} onValueChange={(val) => setActiveCategory(val || 'all')}>
            <SelectTrigger className="w-full sm:w-48 h-11 rounded-xl bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-primary)] focus:ring-[var(--accent-primary)] transition-all duration-200">
              <SelectValue placeholder="Semua Kategori" />
            </SelectTrigger>
            <SelectContent className="bg-[var(--bg-surface)] border-[var(--border)]">
              <SelectItem value="all" className="hover:bg-[var(--bg-card-hover)]">Semua Kategori</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.id} className="hover:bg-[var(--bg-card-hover)]">{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          {loading ? (
            <div className="flex items-center justify-center h-full text-[var(--text-secondary)] font-semibold">Memuat produk...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)]">
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
                    className={`group cursor-pointer border border-[var(--border)] bg-[var(--bg-card)]/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br ${styles.gradient} ${styles.glow} rounded-2xl active:scale-[0.97]`}
                    onClick={() => addToCart(p)}
                  >
                    <CardContent className="p-4 flex flex-col justify-between h-full space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-3.5">
                          <Badge className={`text-[10px] border tracking-wide font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 ${styles.badge}`}>
                            <CatIcon className="h-3 w-3" />
                            {p.categories?.name || '—'}
                          </Badge>
                          <span className="text-[10px] text-[var(--text-secondary)] font-mono tracking-wider">{p.sku}</span>
                        </div>
                        <h3 className="font-bold text-sm leading-snug text-slate-100 group-hover:text-[var(--accent-primary)] transition-colors duration-200 line-clamp-2 h-10">{p.name}</h3>
                      </div>
                      <div className="flex items-center justify-between mt-auto pt-1">
                        <span className="font-black text-lg text-white">Rp {p.price.toLocaleString('id-ID')}</span>
                        <span className={getStockBadge(p.stock)}>
                          Stok {p.stock}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        <div className="lg:hidden absolute bottom-0 left-0 right-0 p-3 bg-[var(--bg-base)]/90 backdrop-blur-md border-t border-[var(--border)] z-10 shadow-lg">
          <Button 
            className="w-full h-12 rounded-xl btn-primary text-base transition-all duration-300 active:scale-95"
            onClick={() => setShowMobileCart(true)}
          >
            Lihat Keranjang ({cart.reduce((a, i) => a + i.quantity, 0)}) • Rp {total.toLocaleString('id-ID')}
          </Button>
        </div>
      </div>

      {/* RIGHT — Cart */}
      <div className={`w-full lg:w-[380px] shrink-0 flex-col bg-[var(--bg-surface)]/70 backdrop-blur-md lg:rounded-2xl shadow-2xl shadow-black/40 lg:border lg:border-[var(--border)] overflow-hidden ${showMobileCart ? 'flex' : 'hidden lg:flex'} h-full lg:h-auto z-20`}>
        {/* Mobile Back Button */}
        <div className="lg:hidden p-3 border-b border-[var(--border)] flex items-center bg-[var(--bg-surface)]">
          <Button variant="ghost" className="h-8 gap-2 font-medium text-slate-200 hover:text-white" onClick={() => setShowMobileCart(false)}>
            <ArrowRight className="h-4 w-4 rotate-180" /> Kembali ke Daftar Produk
          </Button>
        </div>
        
        {/* Cart Header */}
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-card)]/40">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-[var(--accent-primary)]" />
            <span className="font-bold text-lg text-white">Keranjang</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-[var(--accent-primary)] text-white shadow-sm font-black rounded-lg px-2.5">{cart.reduce((a, i) => a + i.quantity, 0)}</Badge>
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
            <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)] opacity-50">
              <ShoppingCart className="h-14 w-14 mb-3" />
              <p className="font-semibold text-sm">Keranjang kosong</p>
              <p className="text-xs mt-1">Klik produk untuk menambahkan</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--bg-card)]/50 border border-[var(--border)] hover:border-[var(--accent-primary)]/20 transition-all duration-200 animate-in fade-in slide-in-from-right-3 group">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate text-slate-100">{item.name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">@Rp {item.price.toLocaleString('id-ID')}</p>
                </div>
                {/* satisfying quantity controls */}
                <div className="flex items-center gap-1 bg-[var(--bg-base)] rounded-lg border border-[var(--border)] shadow-sm px-1 py-0.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-white rounded-md transition-transform active:scale-90" onClick={() => updateQuantity(item.id, -1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <input
                    type="number"
                    min="1"
                    max={item.stock}
                    value={item.quantity === 0 ? '' : item.quantity}
                    onChange={(e) => handleQuantityInput(item.id, e.target.value)}
                    onBlur={() => {
                      if (item.quantity === 0) {
                        handleQuantityInput(item.id, '1')
                      }
                    }}
                    className="w-10 bg-transparent text-center text-sm font-bold text-slate-200 focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]/30 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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

        {/* Totals + Checkout Button */}
        <div className="border-t border-[var(--border)] p-4 bg-[var(--bg-card)]/40 backdrop-blur-sm space-y-4">
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Subtotal</span><span className="font-semibold text-slate-200">Rp {subtotal.toLocaleString('id-ID')}</span></div>
            <div className="h-px bg-[var(--border)] my-2" />
            <div className="flex justify-between items-center">
              <span className="font-bold text-lg text-white">Total</span>
              <span className="font-black text-2xl text-[var(--accent-primary)] shadow-sm">
                Rp {total.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
          <Button
            className="w-full h-12 rounded-xl btn-primary text-base font-bold shadow-lg transition-all duration-300 active:scale-95 flex items-center justify-center gap-2"
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
        <DialogContent className="sm:max-w-md bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">Pembayaran</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="text-center p-4 rounded-xl bg-[var(--bg-base)] border border-[var(--border)]">
              <p className="text-sm text-[var(--text-secondary)] mb-1">Total yang harus dibayar</p>
              <p className="text-4xl font-black text-[var(--accent-primary)]">Rp {total.toLocaleString('id-ID')}</p>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label className="font-semibold text-[var(--text-secondary)] text-sm">Metode Pembayaran</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'cash', label: 'Tunai', icon: Banknote },
                  { value: 'qris', label: 'QRIS', icon: QrCode },
                  { value: 'transfer', label: 'Transfer', icon: CreditCard },
                ].map(m => (
                  <Button
                    key={m.value}
                    variant={paymentMethod === m.value ? 'default' : 'outline'}
                    className={`h-14 flex-col gap-1 rounded-xl border border-[var(--border)] transition-all duration-200 ${paymentMethod === m.value ? 'bg-[var(--accent-primary)] text-white font-bold border-0 shadow-lg' : 'bg-[var(--bg-card)] text-slate-300 hover:text-white'}`}
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
                <Label className="font-semibold text-[var(--text-secondary)] text-sm">Jumlah Dibayar</Label>
                <Input
                  type="number" min={0} className="h-12 text-xl font-bold text-center bg-[var(--bg-base)] border border-[var(--border)] focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] text-white rounded-xl"
                  value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)}
                  autoFocus
                />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="text-xs bg-[var(--bg-card)] border-[var(--border)] text-slate-300 hover:text-white rounded-lg" onClick={() => setAmountPaid(total.toString())}>Uang Pas</Button>
                  {quickAmounts.filter(a => a >= total).slice(0, 4).map(a => (
                    <Button key={a} variant="outline" size="sm" className="text-xs bg-[var(--bg-card)] border-[var(--border)] text-slate-300 hover:text-white rounded-lg" onClick={() => setAmountPaid(a.toString())}>
                      Rp {a.toLocaleString('id-ID')}
                    </Button>
                  ))}
                </div>
                {parseFloat(amountPaid || '0') >= total && (
                  <div className="p-3 rounded-lg bg-[var(--success)]/10 border border-[var(--success)]/20 text-center">
                    <p className="text-xs text-[var(--text-secondary)]">Kembalian</p>
                    <p className="text-2xl font-black text-[var(--success)]">Rp {change.toLocaleString('id-ID')}</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-slate-200 rounded-xl" onClick={() => setShowCheckout(false)}>Batal</Button>
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
        <DialogContent className="sm:max-w-sm bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-2xl">
          <div className="text-center space-y-4" id="receipt">
            <CheckCircle2 className="h-14 w-14 text-[var(--success)] mx-auto animate-bounce" />
            <div>
              <h2 className="text-xl font-bold text-white">Transaksi Berhasil!</h2>
              <p className="text-[var(--text-secondary)] text-sm">Pembayaran telah dikonfirmasi</p>
            </div>

            {receipt && (
              <div className="text-left space-y-3 border border-[var(--border)] rounded-xl p-4 bg-[var(--bg-base)]">
                <div className="text-center border-b border-[var(--border)] pb-3">
                  <h3 className="font-black text-lg text-white">AISh POS</h3>
                  <p className="text-xs text-[var(--text-secondary)] font-mono">{receipt.invoice_number}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{new Date(receipt.created_at).toLocaleString('id-ID')}</p>
                </div>

                <div className="space-y-1">
                  {receipt.items.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="flex-1 truncate text-slate-200">{item.name} x{item.quantity}</span>
                      <span className="font-semibold text-slate-100 ml-2">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[var(--border)] pt-2 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Subtotal</span><span className="text-slate-200">Rp {receipt.subtotal.toLocaleString('id-ID')}</span></div>

                  <div className="flex justify-between font-bold text-base border-t border-[var(--border)] pt-1 text-white"><span>Total</span><span>Rp {receipt.total_amount.toLocaleString('id-ID')}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Bayar ({paymentLabel(receipt.payment_method)})</span><span className="text-slate-200">Rp {receipt.amount_paid.toLocaleString('id-ID')}</span></div>
                  {receipt.payment_method === 'cash' && (
                    <div className="flex justify-between font-bold text-[var(--success)]"><span>Kembalian</span><span>Rp {receipt.change_amount.toLocaleString('id-ID')}</span></div>
                  )}
                </div>

                <p className="text-center text-xs text-[var(--text-secondary)] border-t border-[var(--border)] pt-2">Terima kasih telah berbelanja!</p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="gap-2 border-[var(--border)] bg-[var(--bg-card)] text-slate-200 rounded-xl hover:bg-[var(--bg-card-hover)]" onClick={() => { if (typeof window !== 'undefined') window.print() }}>
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
