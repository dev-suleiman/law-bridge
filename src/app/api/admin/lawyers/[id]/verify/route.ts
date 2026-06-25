import { getServerUser } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { profiles, lawyers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const VerifySchema = z.object({
  action: z.enum(['approve', 'reject']),
  rejectionReason: z.string().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Auth check
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Admin check
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1)

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse request
    const body = await req.json()
    const parsed = VerifySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: parsed.error.errors },
        { status: 422 }
      )
    }

    const { action, rejectionReason } = parsed.data

    // Get lawyer
    const [lawyer] = await db
      .select()
      .from(lawyers)
      .where(eq(lawyers.id, params.id))
      .limit(1)

    if (!lawyer) {
      return NextResponse.json({ error: 'Lawyer not found' }, { status: 404 })
    }

    // Update lawyer
    if (action === 'approve') {
      const [updated] = await db
        .update(lawyers)
        .set({
          isVerified: true,
          rejectionReason: null,
        })
        .where(eq(lawyers.id, params.id))
        .returning()

      return NextResponse.json({ success: true, lawyer: updated })
    } else {
      const [updated] = await db
        .update(lawyers)
        .set({
          isVerified: false,
          rejectionReason: rejectionReason || 'Profile rejected by admin',
        })
        .where(eq(lawyers.id, params.id))
        .returning()

      return NextResponse.json({ success: true, lawyer: updated })
    }
  } catch (error) {
    console.error('[PATCH /api/admin/lawyers/[id]/verify] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
