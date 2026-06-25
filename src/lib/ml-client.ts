/**
 * ML Microservice Client
 * Calls the Python FastAPI service running on Railway.
 * Falls back gracefully if the service is unreachable.
 */

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000'
const ML_SECRET = process.env.ML_SERVICE_SECRET!

export interface MLQueryRequest {
  query: string           // English query text
  mode: 'rights' | 'letter' | 'both'
  user_id?: string
}

export interface RetrievedChunk {
  source_act: string
  article_number?: string
  section_number?: string
  text: string
  score: number
}

export interface MLQueryResponse {
  rights_response?: string
  letter_response?: string
  cited_articles: string[]
  retrieved_chunks: RetrievedChunk[]
  latency_ms: number
  model_mode: 'stub' | 'mistral'
}

export interface MLHealthResponse {
  status: 'ok' | 'degraded'
  model_mode: string
  pinecone_connected: boolean
  version: string
}

async function mlFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${ML_URL}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Secret': ML_SECRET,
      ...options.headers,
    },
    signal: options.signal ?? AbortSignal.timeout(60_000),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ML service ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

export async function queryMLService(req: MLQueryRequest): Promise<MLQueryResponse> {
  return mlFetch<MLQueryResponse>('/query', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

export async function checkMLHealth(): Promise<MLHealthResponse> {
  return mlFetch<MLHealthResponse>('/health')
}

export async function triggerCorpusIndex(documentId: string): Promise<{ job_id: string }> {
  return mlFetch<{ job_id: string }>('/corpus/index', {
    method: 'POST',
    body: JSON.stringify({ document_id: documentId }),
  })
}
