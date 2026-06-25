import { getServerUser } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { profiles, legalDocuments, corpusJobs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    try {
        // Check auth
        const user = await getServerUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if admin
        const [profile] = await db
            .select()
            .from(profiles)
            .where(eq(profiles.id, user.id))
            .limit(1)

        if (!profile || profile.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Parse form data
        const formData = await req.formData()
        const file = formData.get('file') as File
        const actName = formData.get('actName') as string
        const actNumber = formData.get('actNumber') as string
        const year = formData.get('year') as string

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        if (!actName) {
            return NextResponse.json({ error: 'Act name is required' }, { status: 400 })
        }

        console.log('[admin/upload-document] Uploading:', { actName, actNumber, year, fileName: file.name })

        // Upload file to Supabase Storage
        const supabase = createSupabaseAdminClient()
        if (!supabase) {
            return NextResponse.json({ error: 'Storage not configured' }, { status: 500 })
        }

        // Generate unique filename
        const timestamp = Date.now()
        const storagePath = `${timestamp}-${file.name}`

        // Convert file to buffer
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('legal-documents')
            .upload(storagePath, buffer, {
                contentType: 'application/pdf',
            })

        if (uploadError) {
            console.error('[admin/upload-document] Storage error:', uploadError)
            return NextResponse.json(
                { error: `Storage error: ${uploadError.message}` },
                { status: 500 }
            )
        }

        console.log('[admin/upload-document] File uploaded to:', uploadData.path)

        // Get public URL
        const { data: publicUrl } = supabase
            .storage
            .from('legal-documents')
            .getPublicUrl(storagePath)

        // Create database entry
        const [document] = await db
            .insert(legalDocuments)
            .values({
                title: actName,
                actName,
                actNumber: actNumber || null,
                year: year ? parseInt(year) : null,
                fileUrl: publicUrl.publicUrl,
                chunkCount: 0,
                createdBy: user.id,
                createdAt: new Date(),
            })
            .returning()

        console.log('[admin/upload-document] Document created:', document.id)

        // Create indexing job
        const [job] = await db
            .insert(corpusJobs)
            .values({
                documentId: document.id,
                status: 'queued',
            })
            .returning()

        console.log('[admin/upload-document] Indexing job queued:', job.id)

        // Trigger ML service to process document
        const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000'
        const mlServiceSecret = process.env.ML_SERVICE_SECRET

        try {
            const indexResponse = await fetch(`${mlServiceUrl}/corpus/index`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Service-Secret': mlServiceSecret || '',
                },
                body: JSON.stringify({ document_id: document.id }),
            })

            if (!indexResponse.ok) {
                console.warn('[admin/upload-document] ML service error:', indexResponse.statusText)
                // Don't fail the upload — job is queued and will be retried
            } else {
                console.log('[admin/upload-document] ML indexing triggered for:', document.id)
            }
        } catch (mlError) {
            console.warn('[admin/upload-document] Failed to trigger ML service:', mlError)
            // Don't fail the upload — job is queued and can be manually triggered later
        }

        return NextResponse.json({
            success: true,
            document: {
                id: document.id,
                actName: document.actName,
                fileUrl: document.fileUrl,
            },
            job: {
                id: job.id,
                status: job.status,
            },
        })
    } catch (error) {
        console.error('[admin/upload-document] Error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Upload failed' },
            { status: 500 }
        )
    }
}
