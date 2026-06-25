import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { profiles, corpusJobs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { triggerCorpusIndex } from '@/lib/ml-client'

export async function POST(req: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1)
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { document_id } = await req.json()
  if (!document_id) return NextResponse.json({ error: 'document_id required' }, { status: 400 })

  // Create corpus_jobs record
  const [job] = await db.insert(corpusJobs).values({
    documentId: document_id,
    status: 'queued',
  }).returning({ id: corpusJobs.id })

  // Trigger ML service indexing
  try {
    await triggerCorpusIndex(document_id)
  } catch (err) {
    console.error('[/api/admin/index] ML service error:', err)
    // Job stays queued — ML service will pick it up
  }

  return NextResponse.json({ job_id: job.id, status: 'queued' })
}
