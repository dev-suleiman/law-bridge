import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { access_token, refresh_token, expires_in, token_type } = await req.json()

    if (!access_token) {
      console.error('[auth/sync] Missing access_token')
      return NextResponse.json({ error: 'Missing access_token' }, { status: 400 })
    }

    console.log('[auth/sync] Syncing session with tokens')
    const response = NextResponse.json({ ok: true })

    // Get project ID from Supabase URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const projectId = supabaseUrl.split('//')[1].split('.')[0]

    // Manually set the Supabase session cookie in the correct format
    // Supabase stores the session as a JSON object in a cookie named sb-{projectId}-auth-token
    const sessionData = {
      access_token,
      refresh_token: refresh_token || '',
      expires_in: expires_in || 3600,
      expires_at: Math.floor(Date.now() / 1000) + (expires_in || 3600),
      token_type: token_type || 'bearer',
      user: null,
    }

    const cookieName = `sb-${projectId}-auth-token`
    response.cookies.set(cookieName, JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expires_in || 3600,
      path: '/',
    })

    console.log(`[auth/sync] Setting cookie: ${cookieName}`)
    console.log('[auth/sync] Session synced successfully')
    return response
  } catch (error) {
    console.error('[auth/sync] Error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
