'use client'

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
  CreditCard, Banknote, QrCode, ArrowRight, CheckCircle2, Printer
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

  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.id !== id))
  const clearCart = () => setCart([])

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const tax = Math.round(subtotal * 0.11)
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

  return (
    <div className="flex gap-6 h-[calc(100vh-7.5rem)]">
      {/* LEFT — Products */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Search + Category */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input ref={searchRef} placeholder="Cari produk atau SKU... (F2)" className="pl-9 h-11 rounded-xl" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <Button
            variant={activeCategory === 'all' ? 'default' : 'outline'}
            size="sm" className="rounded-full shrink-0"
            onClick={() => setActiveCategory('all')}
          >
            Semua
          </Button>
          {categories.map(c => (
            <Button
              key={c.id}
              variant={activeCategory === c.id ? 'default' : 'outline'}
              size="sm" className="rounded-full shrink-0"
              onClick={() => setActiveCategory(c.id)}
            >
              {c.name}
            </Button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">Memuat produk...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Package className="h-16 w-16 opacity-20 mb-3" />
              <p>Produk tidak ditemukan</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map(p => (
                <Card
                  key={p.id}
                  className="group cursor-pointer border border-zinc-200 dark:border-zinc-800 hover:border-violet-400 dark:hover:border-violet-600 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
                  onClick={() => addToCart(p)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <Badge variant="secondary" className="text-[10px]">{p.categories?.name || '—'}</Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">{p.sku}</span>
                    </div>
                    <h3 className="font-semibold text-sm leading-tight mb-2 group-hover:text-violet-700 dark:group-hover:text-violet-400 transition-colors line-clamp-2">{p.name}</h3>
                    <div className="flex items-end justify-between">
                      <span className="font-black text-lg text-zinc-900 dark:text-zinc-100">Rp {p.price.toLocaleString('id-ID')}</span>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${p.stock <= 5 ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {p.stock}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — Cart */}
      <div className="w-[380px] shrink-0 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {/* Cart Header */}
        <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-violet-600" />
            <span className="font-bold text-lg">Keranjang</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-violet-600 text-white">{cart.reduce((a, i) => a + i.quantity, 0)}</Badge>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" className="text-xs text-red-500 hover:text-red-700 h-7 px-2" onClick={clearCart}>
                Hapus Semua
              </Button>
            )}
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50">
              <ShoppingCart className="h-14 w-14 mb-3" />
              <p className="font-medium">Keranjang kosong</p>
              <p className="text-xs">Klik produk untuk menambahkan</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700/50 group">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">@Rp {item.price.toLocaleString('id-ID')}</p>
                </div>
                <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 rounded-lg border shadow-sm">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, -1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <div className="text-right min-w-[80px]">
                  <p className="font-bold text-sm">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeFromCart(item.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Totals + Checkout Button */}
        <div className="border-t p-4 bg-zinc-50 dark:bg-zinc-950 space-y-3">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>Rp {subtotal.toLocaleString('id-ID')}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">PPN 11%</span><span>Rp {tax.toLocaleString('id-ID')}</span></div>
            <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-1" />
            <div className="flex justify-between items-center">
              <span className="font-bold text-lg">Total</span>
              <span className="font-black text-2xl text-violet-700 dark:text-violet-400">Rp {total.toLocaleString('id-ID')}</span>
            </div>
          </div>
          <Button
            className="w-full h-12 rounded-xl text-base font-bold shadow-xl shadow-violet-500/20 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
            disabled={cart.length === 0}
            onClick={() => { setAmountPaid(total.toString()); setShowCheckout(true) }}
          >
            <ArrowRight className="mr-2 h-5 w-5" />
            Proses Pembayaran
          </Button>
        </div>
      </div>

      {/* ========== CHECKOUT DIALOG ========== */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Pembayaran</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="text-center p-4 rounded-xl bg-violet-50 dark:bg-violet-950/30">
              <p className="text-sm text-muted-foreground mb-1">Total yang harus dibayar</p>
              <p className="text-4xl font-black text-violet-700 dark:text-violet-400">Rp {total.toLocaleString('id-ID')}</p>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label className="font-semibold">Metode Pembayaran</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'cash', label: 'Tunai', icon: Banknote },
                  { value: 'qris', label: 'QRIS', icon: QrCode },
                  { value: 'transfer', label: 'Transfer', icon: CreditCard },
                ].map(m => (
                  <Button
                    key={m.value}
                    variant={paymentMethod === m.value ? 'default' : 'outline'}
                    className={`h-14 flex-col gap-1 ${paymentMethod === m.value ? 'shadow-lg' : ''}`}
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
              <div className="space-y-2">
                <Label className="font-semibold">Jumlah Dibayar</Label>
                <Input
                  type="number" min={0} className="h-12 text-xl font-bold text-center"
                  value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)}
                  autoFocus
                />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setAmountPaid(total.toString())}>Uang Pas</Button>
                  {quickAmounts.filter(a => a >= total).slice(0, 4).map(a => (
                    <Button key={a} variant="outline" size="sm" className="text-xs" onClick={() => setAmountPaid(a.toString())}>
                      Rp {a.toLocaleString('id-ID')}
                    </Button>
                  ))}
                </div>
                {parseFloat(amountPaid || '0') >= total && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-center">
                    <p className="text-xs text-muted-foreground">Kembalian</p>
                    <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">Rp {change.toLocaleString('id-ID')}</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCheckout(false)}>Batal</Button>
            <Button
              onClick={handleCheckout}
              disabled={checkoutLoading || (paymentMethod === 'cash' && change < 0)}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg"
            >
              {checkoutLoading ? 'Memproses...' : 'Konfirmasi Bayar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== RECEIPT DIALOG ========== */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="sm:max-w-sm">
          <div className="text-center space-y-4" id="receipt">
            <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto" />
            <div>
              <h2 className="text-xl font-bold">Transaksi Berhasil!</h2>
              <p className="text-muted-foreground text-sm">Pembayaran telah dikonfirmasi</p>
            </div>

            {receipt && (
              <div className="text-left space-y-3 border rounded-xl p-4 bg-zinc-50 dark:bg-zinc-950">
                <div className="text-center border-b pb-3">
                  <h3 className="font-black text-lg">AISh POS</h3>
                  <p className="text-xs text-muted-foreground font-mono">{receipt.invoice_number}</p>
                  <p className="text-xs text-muted-foreground">{new Date(receipt.created_at).toLocaleString('id-ID')}</p>
                </div>

                <div className="space-y-1">
                  {receipt.items.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="flex-1 truncate">{item.name} x{item.quantity}</span>
                      <span className="font-medium ml-2">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-2 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>Rp {receipt.subtotal.toLocaleString('id-ID')}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">PPN 11%</span><span>Rp {receipt.tax_amount.toLocaleString('id-ID')}</span></div>
                  <div className="flex justify-between font-bold text-base border-t pt-1"><span>Total</span><span>Rp {receipt.total_amount.toLocaleString('id-ID')}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Bayar ({paymentLabel(receipt.payment_method)})</span><span>Rp {receipt.amount_paid.toLocaleString('id-ID')}</span></div>
                  {receipt.payment_method === 'cash' && (
                    <div className="flex justify-between font-bold text-emerald-700"><span>Kembalian</span><span>Rp {receipt.change_amount.toLocaleString('id-ID')}</span></div>
                  )}
                </div>

                <p className="text-center text-xs text-muted-foreground border-t pt-2">Terima kasih telah berbelanja!</p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="gap-2" onClick={() => { if (typeof window !== 'undefined') window.print() }}>
              <Printer className="h-4 w-4" /> Cetak Struk
            </Button>
            <Button onClick={() => setShowReceipt(false)} className="bg-gradient-to-r from-violet-600 to-indigo-600">
              Transaksi Baru
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
