import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerUser } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { profiles, lawyers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const UpdateProfileSchema = z.object({
  fullName: z.string().min(2),
  bio: z.string().max(500),
  consultationFeeGhs: z.number().min(50),
  specialisations: z.array(z.string()).min(1),
  languages: z.array(z.string()).min(1),
  regions: z.array(z.string()).min(1),
  photoUrl: z.string().url().optional().or(z.literal('')),
})

type UpdateProfileData = z.infer<typeof UpdateProfileSchema>

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

    // Get lawyer profile
    const [lawyerProfile] = await db
      .select()
      .from(lawyers)
      .where(eq(lawyers.userId, user.id))
      .limit(1)

    if (!lawyerProfile) {
      // New lawyer - return exists: false but include display name from profiles table
      return NextResponse.json({ 
        exists: false,
        displayName: profile.displayName,
      })
    }

    return NextResponse.json({
      exists: true,
      ...lawyerProfile,
    })
  } catch (error) {
    console.error('[GET /api/lawyer/profile] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
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

    // Parse and validate request body
    const body = await req.json()
    const parsed = UpdateProfileSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: parsed.error.errors },
        { status: 422 }
      )
    }

    const {
      fullName,
      bio,
      consultationFeeGhs,
      specialisations,
      languages,
      regions,
      photoUrl,
    } = parsed.data

    // Get existing lawyer profile
    const [lawyerProfile] = await db
      .select()
      .from(lawyers)
      .where(eq(lawyers.userId, user.id))
      .limit(1)

    if (!lawyerProfile) {
      // Create new lawyer profile if it doesn't exist
      const [created] = await db
        .insert(lawyers)
        .values({
          userId: user.id,
          fullName,
          barNumber: '', // Will be updated later
          bio,
          consultationFeeGhs,
          specialisations,
          languages,
          regions,
          photoUrl: photoUrl || null,
          isActive: true,
          isVerified: false,
        })
        .returning()

      return NextResponse.json(created, { status: 201 })
    }

    // Update existing lawyer profile
    const [updated] = await db
      .update(lawyers)
      .set({
        fullName,
        bio,
        consultationFeeGhs,
        specialisations,
        languages,
        regions,
        photoUrl: photoUrl || null,
        updatedAt: new Date(),
      })
      .where(eq(lawyers.userId, user.id))
      .returning()

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[PUT /api/lawyer/profile] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
