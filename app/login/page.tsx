'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, ShoppingBag, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      toast.error('Login gagal', { description: error.message })
      setLoading(false)
      return
    }

    // Get user role to redirect correctly
    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

      toast.success('Login berhasil!', { description: 'Mengalihkan ke dashboard...' })

      if (profile?.role === 'admin_inventory') {
        router.push('/admin')
      } else {
        router.push('/kasir')
      }
    }

    setLoading(false)
  }

  return (
    <div className="flex min-h-screen">
      {/* Left Side — Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-zinc-950 items-center justify-center">
        {/* Animated gradient background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/30 via-indigo-600/20 to-cyan-500/30 animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl" />
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }} />
        </div>
        <div className="relative z-10 text-center px-12">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 mb-8 shadow-2xl">
            <ShoppingBag className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-6xl font-black text-white tracking-tight mb-4">
            AISh
          </h1>
          <p className="text-xl text-white/60 font-medium mb-2">
            Point of Sale System
          </p>
          <p className="text-sm text-white/40 max-w-sm mx-auto leading-relaxed">
            Sistem kasir modern dengan manajemen inventori terintegrasi, transaksi atomik, dan laporan real-time.
          </p>

          {/* Feature badges */}
          <div className="flex flex-wrap justify-center gap-3 mt-10">
            {['Transaksi Aman', 'Stok Realtime', 'Laporan Otomatis'].map((feature) => (
              <span key={feature} className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-white/70 text-xs font-medium">
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side — Login Form */}
      <div className="flex flex-1 items-center justify-center bg-white dark:bg-zinc-950 p-6">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile branding */}
          <div className="lg:hidden text-center mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900 dark:bg-white mb-4">
              <ShoppingBag className="h-8 w-8 text-white dark:text-zinc-900" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">AISh POS</h1>
          </div>

          <div>
            <h2 className="text-3xl font-bold tracking-tight">Selamat Datang</h2>
            <p className="text-muted-foreground mt-2">Masukkan kredensial Anda untuk melanjutkan</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nama@perusahaan.com"
                className="h-12 rounded-xl text-base"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="h-12 rounded-xl text-base pr-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Memproses...
                </span>
              ) : (
                'Masuk ke Sistem'
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-8">
            AISh POS &copy; {new Date().getFullYear()} — All rights reserved
          </p>
        </div>
      </div>
    </div>
  )
}
