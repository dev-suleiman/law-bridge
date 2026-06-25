import crypto from 'crypto'

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!
const PAYSTACK_BASE = 'https://api.paystack.co'

interface PaystackInitResponse {
  status: boolean
  message: string
  data: {
    authorization_url: string
    access_code: string
    reference: string
  }
}

interface PaystackVerifyResponse {
  status: boolean
  message: string
  data: {
    status: 'success' | 'failed' | 'abandoned'
    reference: string
    amount: number // in kobo (pesewas for GHS)
    currency: string
    paid_at: string
    channel: string
    customer: { email: string; customer_code: string }
    metadata: Record<string, unknown>
  }
}

async function paystackFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Paystack ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

/** Initialise a Paystack transaction and get the checkout URL */
export async function initializePaystackTransaction(params: {
  email: string
  amountGhs: number
  reference: string
  callbackUrl: string
  metadata?: Record<string, unknown>
  channels?: ('card' | 'mobile_money' | 'bank' | 'ussd')[]
}): Promise<PaystackInitResponse['data']> {
  const { data } = await paystackFetch<PaystackInitResponse>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: params.email,
      amount: Math.round(params.amountGhs * 100), // pesewas
      currency: 'GHS',
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
      channels: params.channels ?? ['card', 'mobile_money'],
    }),
  })
  return data
}

/** Verify a Paystack transaction by reference */
export async function verifyPaystackTransaction(
  reference: string
): Promise<PaystackVerifyResponse['data']> {
  const { data } = await paystackFetch<PaystackVerifyResponse>(
    `/transaction/verify/${encodeURIComponent(reference)}`
  )
  return data
}

/** Verify Paystack webhook HMAC-SHA512 signature */
export function verifyPaystackWebhook(
  rawBody: string,
  signature: string | null
): boolean {
  if (!signature) return false
  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET)
    .update(rawBody)
    .digest('hex')
  return hash === signature
}

/** Generate a unique payment reference */
export function generateReference(prefix = 'LB'): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

export const PAYSTACK_PLANS = {
  PRO_MONTHLY_GHS: 25,
} as const
