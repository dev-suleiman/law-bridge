import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerUser } from '@/lib/supabase/server'
import { checkRateLimit, getHashedIp, type UserTier } from '@/lib/rate-limit'
import { translateText, detectLanguage } from '@/lib/translation'
import { queryMLService } from '@/lib/ml-client'
import { db } from '@/lib/db'
import { queries, profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const QuerySchema = z.object({
  input_text: z.string().min(10, 'Please describe your situation in more detail').max(2000),
  language: z.enum(['en', 'tw', 'ga']).optional(),
  mode: z.enum(['rights', 'letter', 'both']).default('rights'),
  case_id: z.string().uuid().optional(),
})

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    // ── Parse & validate input ──────────────────────────────────────────────
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parseResult = QuerySchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0].message },
        { status: 422 }
      )
    }

    const { input_text, language, mode } = parseResult.data

    // Sanitise input — strip HTML/script tags
    const sanitised = input_text.replace(/<[^>]*>/g, '').trim()

    // ── Auth & rate limiting ────────────────────────────────────────────────
    const user = await getServerUser()
    let userTier: UserTier = 'anonymous'
    let userProfile = null

    if (user) {
      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1)

      if (profile) {
        userProfile = profile
        userTier = (profile.role === 'admin' ? 'admin'
          : profile.role === 'lawyer' ? 'lawyer'
          : profile.subscriptionTier === 'pro' ? 'pro'
          : 'free') as UserTier
      }
    }

    const rateResult = await checkRateLimit(user?.id ?? null, userTier)
    if (!rateResult.success) {
      return NextResponse.json(
        {
          error: 'Daily query limit reached',
          limit: rateResult.limit,
          reset: rateResult.reset.toISOString(),
          upgrade_url: '/settings/upgrade',
        },
        { status: 429 }
      )
    }

    // ── Language detection & translation ────────────────────────────────────
    const detectedLang = language ?? (await detectLanguage(sanitised))
    const inputLang = detectedLang as 'en' | 'tw' | 'ga'

    // Translate non-English input to English for ML processing
    const englishQuery = inputLang !== 'en'
      ? await translateText(sanitised, inputLang, 'en')
      : sanitised

    // ── ML Inference ────────────────────────────────────────────────────────
    const mlResponse = await queryMLService({
      query: englishQuery,
      mode,
      user_id: user?.id,
    })

    // ── Translate response back to user's language ──────────────────────────
    const responseLang = userProfile?.preferredLanguage ?? inputLang
    let rightsResponse = mlResponse.rights_response
    let letterResponse = mlResponse.letter_response

    if (responseLang !== 'en') {
      if (rightsResponse) {
        rightsResponse = await translateText(rightsResponse, 'en', responseLang)
      }
      if (letterResponse) {
        letterResponse = await translateText(letterResponse, 'en', responseLang)
      }
    }

    const latencyMs = Date.now() - startTime

    // ── Save to database ────────────────────────────────────────────────────
    const ipHash = getHashedIp()
    const [savedQuery] = await db.insert(queries).values({
      userId: user?.id ?? null,
      inputText: sanitised,
      inputLanguage: inputLang,
      translatedInput: inputLang !== 'en' ? englishQuery : null,
      retrievedChunks: mlResponse.retrieved_chunks,
      rightsResponse: rightsResponse ?? null,
      letterResponse: letterResponse ?? null,
      responseLanguage: responseLang,
      citedArticles: mlResponse.cited_articles,
      latencyMs,
      ipHash,
    }).returning({ id: queries.id })

    // ── Return response ─────────────────────────────────────────────────────
    return NextResponse.json({
      query_id: savedQuery.id,
      rights_response: rightsResponse,
      letter_response: letterResponse,
      cited_articles: mlResponse.cited_articles,
      retrieved_chunks: mlResponse.retrieved_chunks,
      language: responseLang,
      latency_ms: latencyMs,
      rate_limit: {
        remaining: rateResult.remaining - 1,
        limit: rateResult.limit,
        reset: rateResult.reset.toISOString(),
      },
    })
  } catch (err) {
    console.error('[/api/query] Error:', err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}

// Rate query satisfaction
export async function PATCH(req: NextRequest) {
  try {
    const { query_id, satisfied, flag_reason } = await req.json()
    if (!query_id) return NextResponse.json({ error: 'query_id required' }, { status: 400 })

    const user = await getServerUser()

    await db
      .update(queries)
      .set({
        satisfied: satisfied ?? null,
        flagged: flag_reason ? true : undefined,
        flagReason: flag_reason ?? undefined,
      })
      .where(eq(queries.id, query_id))

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to update query' }, { status: 500 })
  }
}
