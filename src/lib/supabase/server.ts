import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export function createSupabaseServerClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null
  }
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (key: string) => cookieStore.get(key)?.value,
        set: (key: string, value: string, options: any) => {
          try {
            cookieStore.set(key, value, options)
          } catch {
            // Ignore cookie errors in Server Components (read-only context)
          }
        },
        remove: (key: string, options: any) => {
          try {
            cookieStore.set(key, '', options)
          } catch {
            // Ignore cookie errors in Server Components (read-only context)
          }
        },
      },
    }
  )
}

/** Service-role client — server-side only, bypasses RLS */
export function createSupabaseAdminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/** Get the authenticated user from a server context */
export async function getServerUser() {
  const supabase = createSupabaseServerClient()
  if (!supabase) {
    console.log('[getServerUser] No supabase client')
    return null
  }

  const cookieStore = cookies()
  const allCookies = cookieStore.getAll()
  console.log('[getServerUser] Available cookies:', allCookies.map(c => c.name))

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error) {
    console.error('[getServerUser] Auth error:', error.message)
  }

  console.log('[getServerUser] User:', user?.email ?? 'null', 'Error:', error?.message ?? 'none')

  if (error || !user) return null
  return user
}
