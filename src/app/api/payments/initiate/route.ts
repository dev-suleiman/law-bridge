import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerUser } from '@/lib/supabase/server'
import {
  initializePaystackTransaction,
  generateReference,
  PAYSTACK_PLANS,
} from '@/lib/paystack'
import { db } from '@/lib/db'
import { payments, profiles, bookings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const InitiateSchema = z.discriminatedUnion('payment_type', [
  z.object({
    payment_type: z.literal('subscription'),
  }),
  z.object({
    payment_type: z.literal('consultation'),
    booking_id: z.string().uuid(),
    lawyer_id: z.string().uuid(),
    amount_ghs: z.number().positive(),
  }),
])

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = InitiateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 422 })
    }

    const data = parsed.data

    // Get user profile for email
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1)

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const reference = generateReference(
      data.payment_type === 'subscription' ? 'PRO' : 'CON'
    )

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!

    let amountGhs: number
    let callbackUrl: string
    let metadata: Record<string, unknown>

    if (data.payment_type === 'subscription') {
      amountGhs = PAYSTACK_PLANS.PRO_MONTHLY_GHS
      callbackUrl = `${appUrl}/settings?payment=success&ref=${reference}`
      metadata = {
        payment_type: 'subscription',
        user_id: user.id,
        plan: 'pro_monthly',
      }
    } else {
      amountGhs = data.amount_ghs
      callbackUrl = `${appUrl}/bookings/${data.booking_id}?payment=success&ref=${reference}`
      metadata = {
        payment_type: 'consultation',
        user_id: user.id,
        booking_id: data.booking_id,
        lawyer_id: data.lawyer_id,
      }
    }

    // Initialise Paystack transaction
    const txn = await initializePaystackTransaction({
      email: profile.email,
      amountGhs,
      reference,
      callbackUrl,
      metadata,
      channels: ['card', 'mobile_money'],
    })

    // Record pending payment in DB
    await db.insert(payments).values({
      userId: user.id,
      bookingId: data.payment_type === 'consultation' ? data.booking_id : null,
      amountGhs,
      currency: 'GHS',
      paystackReference: reference,
      paystackStatus: 'pending',
      paymentType: data.payment_type,
      metadata,
    })

    return NextResponse.json({
      authorization_url: txn.authorization_url,
      reference: txn.reference,
      access_code: txn.access_code,
    })
  } catch (err) {
    console.error('[/api/payments/initiate]', err)
    return NextResponse.json({ error: 'Payment initialisation failed' }, { status: 500 })
  }
}
