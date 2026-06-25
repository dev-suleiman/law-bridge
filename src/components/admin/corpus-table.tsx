'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle2, XCircle, Clock, Loader2, Upload } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { LegalDocument, CorpusJob } from '@/lib/db/schema'

interface AdminCorpusTableProps {
  documents: LegalDocument[]
  recentJobs: CorpusJob[]
}

const STATUS_STYLES: Record<string, { icon: typeof CheckCircle2; className: string }> = {
  done: { icon: CheckCircle2, className: 'text-green-600' },
  processing: { icon: Loader2, className: 'text-blue-500 animate-spin' },
  queued: { icon: Clock, className: 'text-amber-500' },
  failed: { icon: XCircle, className: 'text-danger' },
}

export function AdminCorpusTable({ documents, recentJobs }: AdminCorpusTableProps) {
  const [indexing, setIndexing] = useState<Record<string, boolean>>({})
  const [jobStatuses, setJobStatuses] = useState<Record<string, string>>({})

  const jobsByDoc = recentJobs.reduce<Record<string, CorpusJob>>((acc, job) => {
    if (!acc[job.documentId]) acc[job.documentId] = job
    return acc
  }, {})

  const triggerIndex = async (documentId: string) => {
    setIndexing(p => ({ ...p, [documentId]: true }))
    try {
      const res = await fetch('/api/admin/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: documentId }),
      })
      const data = await res.json()
      if (res.ok) {
        setJobStatuses(p => ({ ...p, [documentId]: 'queued' }))
      } else {
        alert(data.error ?? 'Indexing failed')
      }
    } catch {
      alert('Network error')
    } finally {
      setIndexing(p => ({ ...p, [documentId]: false }))
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-secondary">
            <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Document</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Chunks</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Last Indexed</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Job Status</th>
            <th className="text-right px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {documents.map(doc => {
            const job = jobsByDoc[doc.id]
            const currentStatus = jobStatuses[doc.id] ?? job?.status
            const StatusInfo = currentStatus ? STATUS_STYLES[currentStatus] : null

            return (
              <tr key={doc.id} className="hover:bg-surface-secondary/50 transition-colors">
                <td className="px-6 py-4">
                  <p className="font-medium text-text-primary">{doc.actName}</p>
                  {doc.actNumber && (
                    <p className="text-xs text-text-muted mt-0.5">Act No. {doc.actNumber} · {doc.year}</p>
                  )}
                </td>
                <td className="px-4 py-4 text-text-secondary">
                  {doc.chunkCount > 0 ? doc.chunkCount.toLocaleString() : '—'}
                </td>
                <td className="px-4 py-4 text-text-muted text-xs">
                  {doc.lastIndexedAt
                    ? formatDistanceToNow(new Date(doc.lastIndexedAt), { addSuffix: true })
                    : 'Never'}
                </td>
                <td className="px-4 py-4">
                  {StatusInfo ? (
                    <div className="flex items-center gap-1.5">
                      <StatusInfo.icon className={`w-4 h-4 ${StatusInfo.className}`} />
                      <span className={`text-xs font-medium capitalize ${StatusInfo.className}`}>
                        {currentStatus}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-text-muted">—</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => triggerIndex(doc.id)}
                      disabled={indexing[doc.id] || currentStatus === 'processing'}
                      title="Re-index document"
                      className="flex items-center gap-1.5 text-xs font-medium text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${indexing[doc.id] ? 'animate-spin' : ''}`} />
                      {indexing[doc.id] ? 'Queuing…' : 'Re-index'}
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {documents.length === 0 && (
        <div className="text-center py-12 text-text-muted">
          <Upload className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No documents yet. Upload statute PDFs to Supabase Storage first.</p>
        </div>
      )}
    </div>
  )
}
