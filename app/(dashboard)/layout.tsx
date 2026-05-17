'use client'

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
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
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
    <div className="min-h-screen flex bg-zinc-100 dark:bg-zinc-950">
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-50 h-screen flex flex-col
        bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800
        transition-all duration-300 ease-in-out shadow-xl lg:shadow-none
        ${collapsed ? 'lg:w-[72px]' : 'lg:w-64'}
        ${mobileOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className={`flex items-center h-16 px-4 border-b border-zinc-200 dark:border-zinc-800 ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/25">
            <ShoppingCart className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <span className="font-black text-lg tracking-tight">AISh</span>
              <span className="text-xs text-muted-foreground block -mt-0.5">Point of Sale</span>
            </div>
          )}
          {/* Mobile close */}
          <Button variant="ghost" size="icon" className="lg:hidden ml-auto h-8 w-8" onClick={() => setMobileOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {menu.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                  ${active
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25'
                    : 'text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }
                  ${collapsed ? 'justify-center px-2' : ''}
                `}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className={`h-5 w-5 shrink-0 ${active ? 'text-white' : ''}`} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* User Info + Collapse */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-3 space-y-2">
          {!collapsed && (
            <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
              <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                {userName ? userName.charAt(0).toUpperCase() : '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{userName || 'Loading...'}</p>
                <p className="text-xs text-muted-foreground">
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
              className="h-9 w-9 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="h-9 w-9 text-muted-foreground hidden lg:inline-flex"
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
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold tracking-tight hidden sm:block">
              {menu.find(m => isActive(m.href))?.label || 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="font-mono tabular-nums">
              {currentTime.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
              {' • '}
              {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
