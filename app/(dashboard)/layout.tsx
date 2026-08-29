'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  LogOut, LayoutDashboard, ShoppingCart, Package, Tags, Receipt,
  ChevronLeft, ChevronRight, Clock, Menu, X, Bot
} from 'lucide-react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useCurrentProfile } from '@/lib/queries/profile'
import { useQueryClient } from '@tanstack/react-query'

const ADMIN_MENU = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Produk', href: '/admin/products', icon: Package },
  { label: 'Kategori', href: '/admin/categories', icon: Tags },
  { label: 'Riwayat Transaksi', href: '/admin/transactions', icon: Receipt },
  { label: 'AI Restock', href: '/admin/restock', icon: Bot },
]

const KASIR_MENU = [
  { label: 'Kasir (POS)', href: '/kasir', icon: ShoppingCart },
  { label: 'Riwayat Transaksi', href: '/kasir/history', icon: Receipt },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { data: profile, isLoading: profileLoading, isFetching: profileFetching } = useCurrentProfile()
  const role = profile?.role ?? null
  const userName = profile?.full_name ?? null
  const isProfilePending = profileLoading || (profileFetching && !profile)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    let active = true
    setTimeout(() => {
      if (active) {
        setMounted(true)
        setCurrentTime(new Date())
      }
    }, 0)
    const timer = setInterval(() => {
      if (active) setCurrentTime(new Date())
    }, 1000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  // Defence-in-depth: guard against role mismatch (wait for profile to load)
  useEffect(() => {
    if (isProfilePending || !role) return
    const isAdminRoute = pathname.startsWith('/admin')
    const isKasirRoute = pathname.startsWith('/kasir')
    if (isAdminRoute && role !== 'admin_inventory') router.replace('/kasir')
    if (isKasirRoute && role !== 'kasir') router.replace('/admin')
  }, [role, pathname, router, isProfilePending])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    queryClient.clear()
    router.push('/login')
    router.refresh()
  }

  const menu = isProfilePending ? [] : (role === 'admin_inventory' ? ADMIN_MENU : KASIR_MENU)

  const isActive = (href: string) => {
    if (href === '/admin' || href === '/kasir') return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen flex text-[var(--text-primary)] font-sans" style={{ background: 'var(--bg-base)' }}>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/70 lg:hidden backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-50 h-screen flex flex-col
        border-r transition-all duration-300 ease-in-out shadow-2xl lg:shadow-none
        ${collapsed ? 'lg:w-[72px]' : 'lg:w-64'}
        ${mobileOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `} style={{
        background: 'var(--bg-surface)',
        borderColor: 'rgba(255, 107, 53, 0.1)',
      }}>
        {/* Subtle orange glow at top */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(255,107,53,0.5), transparent)' }} />

        {/* Logo */}
        <div className={`flex items-center h-16 px-4 border-b ${collapsed ? 'justify-center' : 'gap-3'}`}
          style={{ borderColor: 'rgba(255, 107, 53, 0.1)' }}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #FF6B35 0%, #E85D27 100%)',
              boxShadow: '0 4px 15px rgba(255, 107, 53, 0.35)'
            }}>
            <ShoppingCart className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <span className="font-black text-lg tracking-tight text-white">AISh</span>
              <span className="text-xs block -mt-0.5 font-semibold" style={{ color: '#FF6B35' }}>Point of Sale</span>
            </div>
          )}
          {/* Mobile close */}
          <Button variant="ghost" size="icon" className="lg:hidden ml-auto h-8 w-8 hover:text-white" style={{ color: 'var(--text-secondary)' }} onClick={() => setMobileOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {isProfilePending ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-10 rounded-xl" style={{ background: 'var(--bg-card)' }} />
              <div className="h-10 rounded-xl" style={{ background: 'var(--bg-card)' }} />
              <div className="h-10 rounded-xl" style={{ background: 'var(--bg-card)' }} />
            </div>
          ) : menu.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                  ${collapsed ? 'justify-center px-2' : ''}
                `}
                style={active ? {
                  background: 'linear-gradient(135deg, #FF6B35 0%, #E85D27 100%)',
                  color: '#ffffff',
                  fontWeight: 700,
                  boxShadow: '0 4px 15px rgba(255, 107, 53, 0.3)',
                } : {
                  color: 'var(--text-secondary)',
                }}
                title={collapsed ? item.label : undefined}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'
                    ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,107,53,0.08)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'
                    ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                  }
                }}
              >
                <item.icon className="h-5 w-5 shrink-0" style={{ color: active ? '#ffffff' : 'var(--text-secondary)' }} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* User Info + Collapse */}
        <div className="border-t p-3 space-y-2" style={{ borderColor: 'rgba(255,107,53,0.1)' }}>
          {!collapsed && (
            <div className="flex items-center gap-3 px-2 py-2 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'rgba(255,107,53,0.12)' }}>
              <div className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #E85D27 100%)', boxShadow: '0 2px 8px rgba(255,107,53,0.3)' }}>
                {userName ? userName.charAt(0).toUpperCase() : '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate text-white">{userName || 'Loading...'}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {role === 'kasir' ? 'Kasir' : 'Admin Inventory'}
                </p>
              </div>
            </div>
          )}
          <div className={`flex ${collapsed ? 'flex-col' : ''} gap-1`}>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-9 w-9 hover:bg-red-950/20 hover:text-red-400 transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="h-9 w-9 hidden lg:inline-flex transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between backdrop-blur-md border-b px-4 lg:px-6"
          style={{ background: 'rgba(17,17,17,0.85)', borderColor: 'rgba(255,107,53,0.1)' }}>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9 hover:text-white" style={{ color: 'var(--text-secondary)' }} onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white block">
              {menu.find(m => isActive(m.href))?.label || 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Clock className="h-4 w-4 animate-pulse shrink-0" style={{ color: '#FF6B35' }} />
            <span className="font-mono tabular-nums text-slate-200">
              {mounted && currentTime ? (
                <>
                  <span className="sm:hidden">
                    {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="hidden sm:inline">
                    {currentTime.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                    {' • '}
                    {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </>
              ) : (
                'Memuat...'
              )}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6">
          {isProfilePending ? (
            <div className="flex items-center justify-center h-[60vh]">
              <div className="flex flex-col items-center gap-3" style={{ color: 'var(--text-secondary)' }}>
                <div className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#FF6B35', borderTopColor: 'transparent' }} />
                <p className="text-sm">Memuat...</p>
              </div>
            </div>
          ) : children}
        </main>
      </div>
    </div>
  )
}
