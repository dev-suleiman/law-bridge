import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { profiles, lawyers, bookings } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET() {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a lawyer
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1)

    if (!profile || profile.role !== 'lawyer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get lawyer record
    const [lawyerRecord] = await db
      .select()
      .from(lawyers)
      .where(eq(lawyers.userId, user.id))
      .limit(1)

    if (!lawyerRecord) {
      return NextResponse.json({ bookings: [] })
    }

    // Get all bookings for this lawyer
    const lawyerBookings = await db
      .select({
        id: bookings.id,
        citizenId: bookings.citizenId,
        citizenName: profiles.displayName,
        scheduledAt: bookings.scheduledAt,
        feeGhs: bookings.feeGhs,
        status: bookings.status,
        meetingLink: bookings.meetingLink,
        citizenRating: bookings.citizenRating,
        createdAt: bookings.createdAt,
      })
      .from(bookings)
      .leftJoin(profiles, eq(bookings.citizenId, profiles.id))
      .where(eq(bookings.lawyerId, lawyerRecord.id))
      .orderBy(desc(bookings.createdAt))

    return NextResponse.json({ bookings: lawyerBookings })
  } catch (error) {
    console.error('[GET /api/lawyer/bookings] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
