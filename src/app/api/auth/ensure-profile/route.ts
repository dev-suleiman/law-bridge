import { getServerUser } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function POST() {
    try {
        const user = await getServerUser()

        if (!user) {
            console.log('[api/auth/ensure-profile] No user found (unauthorized)')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        console.log('[api/auth/ensure-profile] User:', user.email, 'ID:', user.id)

        // Check if profile already exists
        const [existingProfile] = await db
            .select()
            .from(profiles)
            .where(eq(profiles.id, user.id))
            .limit(1)

        if (existingProfile) {
            console.log('[api/auth/ensure-profile] Profile already exists:', user.id)
            return NextResponse.json({ profile: existingProfile, created: false })
        }

        // Create profile for new user
        const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'User'
        const role = user.user_metadata?.role || 'user'

        console.log('[api/auth/ensure-profile] Creating profile - displayName:', displayName, 'role:', role)

        const [newProfile] = await db
            .insert(profiles)
            .values({
                id: user.id,
                email: user.email!,
                displayName,
                role,
                subscriptionTier: 'free',
                createdAt: new Date(),
                updatedAt: new Date(),
            })
            .returning()

        console.log('[api/auth/ensure-profile] Profile created successfully:', user.id)
        return NextResponse.json({ profile: newProfile, created: true })
    } catch (error) {
        console.error('[api/auth/ensure-profile] Error:', error)
        return NextResponse.json({ error: String(error) }, { status: 500 })
    }
}
