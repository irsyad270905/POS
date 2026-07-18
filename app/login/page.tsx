'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, ShoppingBag, Loader2, Sparkles } from 'lucide-react'
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
    <div className="flex min-h-screen overflow-hidden relative" style={{ background: '#111111' }}>
      {/* Animated Ambient Orange Glow Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] max-w-[600px] rounded-full animate-float-1"
          style={{ background: 'radial-gradient(circle, rgba(255,107,53,0.1) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute -bottom-[20%] -right-[10%] w-[60vw] h-[60vw] max-w-[700px] rounded-full animate-float-2"
          style={{ background: 'radial-gradient(circle, rgba(232,93,39,0.08) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] max-w-[500px] rounded-full animate-float-3"
          style={{ background: 'radial-gradient(circle, rgba(255,140,66,0.05) 0%, transparent 70%)', filter: 'blur(100px)' }} />
      </div>

      {/* Left Side — Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center z-10"
        style={{ background: 'rgba(26,26,26,0.7)', borderRight: '1px solid rgba(255,107,53,0.1)' }}>
        {/* Left background effects */}
        <div className="absolute inset-0">
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(255,107,53,0.05) 0%, transparent 60%, rgba(232,93,39,0.04) 100%)' }} />
          <div className="absolute top-1/4 -left-20 w-80 h-80 rounded-full"
            style={{ background: 'rgba(255,107,53,0.08)', filter: 'blur(80px)' }} />
          <div className="absolute bottom-1/4 -right-20 w-80 h-80 rounded-full"
            style={{ background: 'rgba(232,93,39,0.06)', filter: 'blur(80px)' }} />
          {/* Subtle grid */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(rgba(255,107,53,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,107,53,.3) 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }} />
        </div>

        <div className="relative z-10 text-center px-12">
          {/* Logo icon */}
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl mb-8"
            style={{
              background: 'rgba(26,26,26,0.9)',
              border: '1px solid rgba(255,107,53,0.4)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 8px 40px rgba(255,107,53,0.2), inset 0 1px 0 rgba(255,107,53,0.15)'
            }}>
            <ShoppingBag className="h-12 w-12" style={{ color: '#FF6B35' }} />
          </div>

          <h1 className="text-6xl font-black tracking-tight mb-3" style={{ color: '#f5f5f7', letterSpacing: '-0.04em' }}>
            AISh
          </h1>
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-px w-12" style={{ background: 'linear-gradient(to right, transparent, rgba(255,107,53,0.6))' }} />
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#FF6B35' }}>Point of Sale</span>
            <div className="h-px w-12" style={{ background: 'linear-gradient(to left, transparent, rgba(255,107,53,0.6))' }} />
          </div>
          <p className="text-sm max-w-sm mx-auto leading-relaxed" style={{ color: '#9a9ba0' }}>
            Sistem kasir modern dengan manajemen inventori terintegrasi, transaksi atomik, dan laporan real-time.
          </p>

          {/* Feature badges */}
          <div className="flex flex-wrap justify-center gap-3 mt-10">
            {['Transaksi Aman', 'Stok Realtime', 'Laporan Otomatis'].map((feature) => (
              <span key={feature} className="px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5"
                style={{
                  background: 'rgba(255,107,53,0.1)',
                  border: '1px solid rgba(255,107,53,0.25)',
                  color: '#FF8C42',
                  backdropFilter: 'blur(8px)'
                }}>
                <Sparkles className="h-3 w-3" />
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side — Login Form */}
      <div className="flex flex-1 items-center justify-center p-6 z-10"
        style={{ background: 'rgba(17,17,17,0.7)', backdropFilter: 'blur(20px)' }}>
        <div className="w-full max-w-md space-y-8">
          {/* Mobile branding */}
          <div className="lg:hidden text-center mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{ background: '#1a1a1a', border: '1px solid rgba(255,107,53,0.3)' }}>
              <ShoppingBag className="h-8 w-8" style={{ color: '#FF6B35' }} />
            </div>
            <h1 className="text-3xl font-black tracking-tight" style={{ color: '#f5f5f7' }}>AISh POS</h1>
          </div>

          {/* Header */}
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight" style={{ color: '#f5f5f7', letterSpacing: '-0.03em' }}>
              Selamat Datang
            </h2>
            <p className="mt-2 text-sm" style={{ color: '#9a9ba0' }}>Masukkan kredensial Anda untuk melanjutkan</p>
            <div className="mt-4 h-1 w-16 rounded-full" style={{ background: 'linear-gradient(to right, #FF6B35, #E85D27)' }} />
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold" style={{ color: '#f5f5f7' }}>Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nama@perusahaan.com"
                className="h-12 rounded-xl text-base transition-all duration-200"
                style={{
                  background: 'rgba(26,26,26,0.9)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#f5f5f7',
                }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoFocus
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold" style={{ color: '#f5f5f7' }}>Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="h-12 rounded-xl text-base pr-12 transition-all duration-200"
                  style={{
                    background: 'rgba(26,26,26,0.9)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#f5f5f7',
                  }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: '#9a9ba0' }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-12 rounded-xl text-base font-bold border-0 transition-all duration-300 active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #FF6B35 0%, #E85D27 100%)',
                color: '#ffffff',
                boxShadow: '0 4px 20px rgba(255,107,53,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
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

          <p className="text-center text-xs mt-8" style={{ color: '#4a4b50' }}>
            AISh POS &copy; {new Date().getFullYear()} — All rights reserved
          </p>
        </div>
      </div>
    </div>
  )
}
