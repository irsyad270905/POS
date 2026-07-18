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
      toast.error('Login gagal', { description: 'Email atau password salah. Silakan coba lagi.' })
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
        <div className="absolute -top-[10%] -left-[10%] w-[80vw] sm:w-[50vw] h-[80vw] sm:h-[50vw] max-w-[600px] rounded-full animate-float-1"
          style={{ background: 'radial-gradient(circle, rgba(255,107,53,0.12) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute -bottom-[20%] -right-[10%] w-[90vw] sm:w-[60vw] h-[90vw] sm:h-[60vw] max-w-[700px] rounded-full animate-float-2"
          style={{ background: 'radial-gradient(circle, rgba(232,93,39,0.1) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] sm:w-[40vw] h-[70vw] sm:h-[40vw] max-w-[500px] rounded-full animate-float-3"
          style={{ background: 'radial-gradient(circle, rgba(255,140,66,0.06) 0%, transparent 70%)', filter: 'blur(100px)' }} />
      </div>

      {/* Left Side — Branding (Hidden on mobile) */}
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

      {/* Right Side — Login Form Wrapper */}
      <div className="flex flex-1 items-center justify-center p-4 sm:p-8 z-10">
        {/* Glassmorphic Card Container */}
        <div className="w-full max-w-md bg-[#16171b]/60 sm:bg-[#1a1a1a]/40 border border-white/[0.08] backdrop-blur-xl rounded-3xl p-6 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] space-y-6 sm:space-y-8 relative overflow-hidden">
          {/* Top border ambient highlight */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#FF6B35]/30 to-transparent" />

          {/* Mobile branding */}
          <div className="lg:hidden text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3 border"
              style={{ background: 'rgba(255,107,53,0.06)', borderColor: 'rgba(255,107,53,0.25)' }}>
              <ShoppingBag className="h-8 w-8" style={{ color: '#FF6B35' }} />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white mb-0.5">AISh POS</h1>
            <div className="text-[10px] font-bold tracking-widest uppercase text-[#FF6B35] mb-4">Point of Sale</div>
          </div>

          {/* Header */}
          <div className="text-center sm:text-left">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Selamat Datang
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-[#9a9ba0]">Masukkan kredensial Anda untuk melanjutkan</p>
            <div className="hidden sm:block mt-4 h-[2px] w-12 rounded-full bg-gradient-to-r from-[#FF6B35] to-[#E85D27]" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
            {/* Email */}
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="email" className="text-xs sm:text-sm font-semibold text-[#f5f5f7]">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nama@perusahaan.com"
                className="h-11 sm:h-12 rounded-xl text-sm sm:text-base transition-all duration-200"
                style={{
                  background: 'rgba(26,26,26,0.8)',
                  border: '1px solid rgba(255,255,255,0.07)',
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
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="password" className="text-xs sm:text-sm font-semibold text-[#f5f5f7]">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="h-11 sm:h-12 rounded-xl text-sm sm:text-base pr-12 transition-all duration-200"
                  style={{
                    background: 'rgba(26,26,26,0.8)',
                    border: '1px solid rgba(255,255,255,0.07)',
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
                  {showPassword ? <EyeOff className="h-4 sm:h-5 w-4 sm:w-5" /> : <Eye className="h-4 sm:h-5 w-4 sm:w-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-11 sm:h-12 rounded-xl text-sm sm:text-base font-bold border-0 transition-all duration-300 active:scale-[0.98] mt-2 text-white"
              style={{
                background: 'linear-gradient(135deg, #FF6B35 0%, #E85D27 100%)',
                boxShadow: '0 4px 20px rgba(255,107,53,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 sm:h-5 w-4 sm:w-5 animate-spin" />
                  Memproses...
                </span>
              ) : (
                'Masuk ke Sistem'
              )}
            </Button>
          </form>

          <p className="text-center text-[10px] sm:text-xs mt-6 text-[#4a4b50]">
            AISh POS &copy; {new Date().getFullYear()} — All rights reserved
          </p>
        </div>
      </div>
    </div>
  )
}
