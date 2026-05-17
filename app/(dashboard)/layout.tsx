'use client'

// CHANGED: Completely revamped sidebars, header, glassmorphism, highlights, avatar gradients, and mono clocks
// UNCHANGED: Logical auth validation triggers, paths, routing actions

import { createClient } from '@/utils/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  LogOut, LayoutDashboard, ShoppingCart, Package, Tags, Receipt,
  ChevronLeft, ChevronRight, Clock, Menu, X
} from 'lucide-react'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const ADMIN_MENU = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Produk', href: '/admin/products', icon: Package },
  { label: 'Kategori', href: '/admin/categories', icon: Tags },
  { label: 'Riwayat Transaksi', href: '/admin/transactions', icon: Receipt },
]

const KASIR_MENU = [
  { label: 'Kasir (POS)', href: '/kasir', icon: ShoppingCart },
  { label: 'Riwayat Transaksi', href: '/kasir/history', icon: Receipt },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [role, setRole] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [currentTime, setCurrentTime] = useState<Date | null>(null)

  useEffect(() => {
    setMounted(true)
    setCurrentTime(new Date())
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
        if (data) {
          setRole(data.role)
          setUserName(data.full_name || user.email?.split('@')[0] || 'User')
        }
      }
    }
    loadUser()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const menu = role === 'admin_inventory' ? ADMIN_MENU : KASIR_MENU

  const isActive = (href: string) => {
    if (href === '/admin' || href === '/kasir') return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen flex bg-[var(--bg-base)] text-[var(--text-primary)] font-sans selection:bg-[var(--accent-primary)]/30 overflow-hidden relative">
      {/* Animated Ambient Mesh Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] max-w-[600px] rounded-full bg-gradient-to-br from-[var(--accent-primary)]/8 to-[var(--accent-secondary)]/8 blur-[130px] animate-float-1" />
        <div className="absolute top-[30%] left-[25%] w-[40vw] h-[40vw] max-w-[500px] rounded-full bg-indigo-500/5 blur-[120px] animate-float-3" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[60vw] h-[60vw] max-w-[700px] rounded-full bg-gradient-to-br from-[var(--accent-secondary)]/8 to-[var(--accent-primary)]/8 blur-[150px] animate-float-2" />
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-50 h-screen flex flex-col
        bg-[var(--bg-surface)]/80 backdrop-blur-md border-r border-[var(--border)]
        transition-all duration-300 ease-out shadow-[4px_0_24px_rgba(0,0,0,0.3)] lg:shadow-none
        ${collapsed ? 'lg:w-[72px]' : 'lg:w-64'}
        ${mobileOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0'}
        relative z-10
      `}>
        {/* Logo */}
        <div className={`flex items-center h-16 px-4 border-b border-[var(--border)] ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] shadow-lg shadow-[var(--accent-primary)]/25">
            <ShoppingCart className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <span className="font-black text-lg tracking-tight text-white">AISh</span>
              <span className="text-[10px] text-[var(--text-secondary)] block -mt-0.5 font-semibold tracking-wider">POINT OF SALE</span>
            </div>
          )}
          {/* Mobile close */}
          <Button variant="ghost" size="icon" className="lg:hidden ml-auto h-8 w-8 text-[var(--text-secondary)] hover:text-white" onClick={() => setMobileOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {menu.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`
                  relative overflow-hidden group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                  ${active
                    ? 'text-[var(--accent-primary)] shadow-sm shadow-[var(--accent-primary)]/10 bg-[var(--bg-card)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]/50 hover:shadow-[0_0_12px_rgba(20,184,166,0.05)]'
                  }
                  ${collapsed ? 'justify-center px-2' : ''}
                `}
                title={collapsed ? item.label : undefined}
              >
                {/* Active Highlight Bar Left */}
                {active && <div className="absolute left-0 top-2 bottom-2 w-1 bg-[var(--accent-primary)] rounded-r-full z-20" />}
                
                <item.icon className={`h-5 w-5 shrink-0 relative z-10 transition-transform group-hover:scale-105 duration-200 ${active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`} />
                {!collapsed && <span className="relative z-10">{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* User Info + Collapse */}
        <div className="border-t border-[var(--border)] p-3 space-y-2">
          {!collapsed && (
            <div className="flex items-center gap-3 px-2.5 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
              {/* User Avatar Gradient Circle */}
              <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center text-white font-bold text-sm shadow-md shadow-[var(--accent-primary)]/15">
                {userName ? userName.charAt(0).toUpperCase() : '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate text-[var(--text-primary)]">{userName || 'Loading...'}</p>
                <p className="text-[10px] font-semibold text-[var(--text-secondary)] tracking-wider">
                  {role === 'kasir' ? 'KASIR' : 'ADMIN INVENTORY'}
                </p>
              </div>
            </div>
          )}

          <div className={`flex ${collapsed ? 'flex-col' : ''} gap-1`}>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-9 w-9 text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-950/20 rounded-xl"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="h-9 w-9 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hidden lg:inline-flex rounded-xl"
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0 relative z-10">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-[var(--bg-base)]/80 backdrop-blur-md border-b border-[var(--border)] px-4 lg:px-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9 rounded-xl border border-[var(--border)]" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-white hidden sm:block">
              {menu.find(m => isActive(m.href))?.label || 'Dashboard'}
            </h1>
          </div>
          {/* Clock Mono */}
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border)] px-3 py-1.5 rounded-full shadow-sm">
            <Clock className="h-4 w-4 text-[var(--accent-primary)] animate-pulse" />
            <span className="font-mono tabular-nums text-slate-200 font-semibold">
              {mounted && currentTime ? (
                <>
                  {currentTime.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                  {' • '}
                  {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </>
              ) : (
                'Memuat...'
              )}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
