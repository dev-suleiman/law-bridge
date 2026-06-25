import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_ROUTES = ['/dashboard', '/cases', '/bookings', '/settings']
const ADMIN_ROUTES = ['/admin']
const AUTH_ROUTES = ['/login', '/signup', '/reset-password']

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  let supabaseResponse = NextResponse.next({ request })

  // Skip Supabase if env vars missing
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.log(`[middleware] Supabase not configured, allowing ${path}`)
    return supabaseResponse
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get: (key: string) => request.cookies.get(key)?.value,
          set: (key: string, value: string, options: any) => {
            supabaseResponse.cookies.set(key, value, options)
          },
          remove: (key: string, options: any) => {
            supabaseResponse.cookies.set(key, '', options)
          },
        },
      }
    )

    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      console.log(`[middleware] Auth error on ${path}:`, error.message)
    }

    console.log(`[middleware] Path: ${path}, Authenticated: ${!!user}${user ? ` (${user.email})` : ''}`)

    // Redirect authenticated users away from auth pages
    if (user && AUTH_ROUTES.some(r => path.startsWith(r))) {
      console.log(`[middleware] Redirecting authenticated user from ${path} to /dashboard`)
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Protect dashboard routes
    if (!user && PROTECTED_ROUTES.some(r => path.startsWith(r))) {
      console.log(`[middleware] Redirecting unauthenticated user from ${path} to /login`)
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', path)
      return NextResponse.redirect(loginUrl)
    }

    // Protect admin routes
    if (!user && ADMIN_ROUTES.some(r => path.startsWith(r))) {
      console.log(`[middleware] Redirecting unauthenticated user from ${path} to /login`)
      return NextResponse.redirect(new URL('/login', request.url))
    }
  } catch (error) {
    console.error('[middleware] Supabase error:', error)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!api/auth|login|signup|_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)',
  ],
}
