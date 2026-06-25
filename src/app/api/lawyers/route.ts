import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { lawyers, profiles } from '@/lib/db/schema'
import { and, eq, ilike, sql, gte, lte, arrayContains } from 'drizzle-orm'

const SearchSchema = z.object({
  specialisation: z.string().optional(),
  region: z.string().optional(),
  language: z.string().optional(),
  min_fee: z.coerce.number().optional(),
  max_fee: z.coerce.number().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(12),
})

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const parsed = SearchSchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 422 })
  }

  const { specialisation, region, language, min_fee, max_fee, page, limit } = parsed.data
  const offset = (page - 1) * limit

  try {
    const conditions = [
      eq(lawyers.isVerified, true),
      eq(lawyers.isActive, true),
    ]

    if (specialisation) {
      conditions.push(arrayContains(lawyers.specialisations, [specialisation]))
    }
    if (region) {
      conditions.push(arrayContains(lawyers.regions, [region]))
    }
    if (language) {
      conditions.push(arrayContains(lawyers.languages, [language]))
    }
    if (min_fee !== undefined) {
      conditions.push(gte(lawyers.consultationFeeGhs, min_fee))
    }
    if (max_fee !== undefined) {
      conditions.push(lte(lawyers.consultationFeeGhs, max_fee))
    }

    const results = await db
      .select({
        id: lawyers.id,
        fullName: lawyers.fullName,
        photoUrl: lawyers.photoUrl,
        specialisations: lawyers.specialisations,
        languages: lawyers.languages,
        regions: lawyers.regions,
        bio: lawyers.bio,
        consultationFeeGhs: lawyers.consultationFeeGhs,
        ratingAvg: lawyers.ratingAvg,
        ratingCount: lawyers.ratingCount,
      })
      .from(lawyers)
      .where(and(...conditions))
      .orderBy(sql`${lawyers.ratingAvg} DESC, ${lawyers.ratingCount} DESC`)
      .limit(limit)
      .offset(offset)

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(lawyers)
      .where(and(...conditions))

    return NextResponse.json({
      lawyers: results,
      pagination: {
        page,
        limit,
        total: Number(count),
        pages: Math.ceil(Number(count) / limit),
      },
    })
  } catch (err) {
    console.error('[/api/lawyers]', err)
    return NextResponse.json({ error: 'Failed to fetch lawyers' }, { status: 500 })
  }
}
