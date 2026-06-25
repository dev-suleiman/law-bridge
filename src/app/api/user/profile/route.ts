import { getServerUser } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const user = await getServerUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const [profile] = await db
            .select()
            .from(profiles)
            .where(eq(profiles.id, user.id))
            .limit(1)

        if (!profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
        }

        return NextResponse.json({
            id: profile.id,
            email: user.email,
            role: profile.role,
            displayName: profile.displayName,
        })
    } catch (error) {
        console.error('[api/user/profile] Error:', error)
        return NextResponse.json({ error: String(error) }, { status: 500 })
    }
}
