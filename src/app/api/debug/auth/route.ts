import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(req: NextRequest) {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll: () => req.cookies.getAll(),
                setAll: () => { },
            },
        }
    )

    const { data: { user }, error } = await supabase.auth.getUser()

    const cookies = req.cookies.getAll()

    return NextResponse.json({
        authenticated: !!user,
        user: user ? { id: user.id, email: user.email } : null,
        error: error?.message,
        cookies: cookies.map(c => ({
            name: c.name,
            value: c.value.substring(0, 30) + (c.value.length > 30 ? '...' : ''),
        })),
    })
}
