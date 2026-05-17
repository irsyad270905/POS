import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // If logged in
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role

    // Already logged in but trying to access login page → redirect to dashboard
    if (pathname === '/login') {
      const target = role === 'admin_inventory' ? '/admin' : '/kasir'
      return NextResponse.redirect(new URL(target, request.url))
    }

    // Root → redirect to dashboard
    if (pathname === '/') {
      const target = role === 'admin_inventory' ? '/admin' : '/kasir'
      return NextResponse.redirect(new URL(target, request.url))
    }

    // Role-based access control
    if (pathname.startsWith('/kasir') && role !== 'kasir') {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
    if (pathname.startsWith('/admin') && role !== 'admin_inventory') {
      return NextResponse.redirect(new URL('/kasir', request.url))
    }
  } else {
    // Not logged in → protect dashboard routes
    if (pathname.startsWith('/kasir') || pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    // Root → login
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return supabaseResponse
}
