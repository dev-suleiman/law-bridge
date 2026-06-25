import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerUser } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { profiles, lawyers, bookings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const UpdateBookingSchema = z.object({
  action: z.enum(['accept', 'decline']),
})

type UpdateBookingData = z.infer<typeof UpdateBookingSchema>

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
      return NextResponse.json({ error: 'Lawyer profile not found' }, { status: 404 })
    }

    // Get booking and verify it belongs to this lawyer
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, params.id))
      .limit(1)

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.lawyerId !== lawyerRecord.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse and validate request body
    const body = await req.json()
    const parsed = UpdateBookingSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 422 }
      )
    }

    const { action } = parsed.data

    // Update booking status
    let newStatus = 'cancelled'
    let meetingLink = booking.meetingLink

    if (action === 'accept') {
      newStatus = 'confirmed'
      // Generate a placeholder meeting link if not already present
      if (!meetingLink) {
        meetingLink = `https://meet.google.com/${booking.id}`
      }
    }

    const [updated] = await db
      .update(bookings)
      .set({
        status: newStatus as 'pending' | 'confirmed' | 'completed' | 'cancelled',
        meetingLink: newStatus === 'confirmed' ? meetingLink : booking.meetingLink,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, params.id))
      .returning()

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[PATCH /api/lawyer/bookings/[id]] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
