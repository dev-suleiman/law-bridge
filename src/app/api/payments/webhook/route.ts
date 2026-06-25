import { NextRequest, NextResponse } from 'next/server'
import { verifyPaystackWebhook, verifyPaystackTransaction } from '@/lib/paystack'
import { db } from '@/lib/db'
import { payments, profiles, bookings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { sendBookingConfirmation } from '@/lib/email'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // Read raw body for HMAC verification
  const rawBody = await req.text()
  const signature = req.headers.get('x-paystack-signature')

  // ── Verify webhook signature (CRITICAL security check) ──────────────────
  if (!verifyPaystackWebhook(rawBody, signature)) {
    console.warn('[Webhook] Invalid Paystack signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: { event: string; data: { reference: string } }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // ── Only handle charge.success events ───────────────────────────────────
  if (event.event !== 'charge.success') {
    return NextResponse.json({ received: true })
  }

  const reference = event.data.reference

  try {
    // ── Idempotency check — skip already-processed payments ────────────────
    const [existingPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.paystackReference, reference))
      .limit(1)

    if (!existingPayment) {
      console.warn('[Webhook] Payment not found for reference:', reference)
      return NextResponse.json({ received: true })
    }

    if (existingPayment.paystackStatus === 'success') {
      // Already processed — idempotent
      return NextResponse.json({ received: true })
    }

    // ── Verify transaction with Paystack API ─────────────────────────────
    const txn = await verifyPaystackTransaction(reference)
    if (txn.status !== 'success') {
      await db
        .update(payments)
        .set({ paystackStatus: 'failed', updatedAt: new Date() })
        .where(eq(payments.paystackReference, reference))
      return NextResponse.json({ received: true })
    }

    // ── Mark payment as successful ────────────────────────────────────────
    await db
      .update(payments)
      .set({
        paystackStatus: 'success',
        paymentMethod: txn.channel,
        updatedAt: new Date(),
      })
      .where(eq(payments.paystackReference, reference))

    const meta = existingPayment.metadata as Record<string, unknown>

    // ── Handle subscription payment ───────────────────────────────────────
    if (existingPayment.paymentType === 'subscription') {
      await db
        .update(profiles)
        .set({ subscriptionTier: 'pro', updatedAt: new Date() })
        .where(eq(profiles.id, existingPayment.userId))

      console.log(`[Webhook] User ${existingPayment.userId} upgraded to Pro`)
    }

    // ── Handle consultation payment ───────────────────────────────────────
    if (existingPayment.paymentType === 'consultation' && existingPayment.bookingId) {
      await db
        .update(bookings)
        .set({ status: 'confirmed', updatedAt: new Date() })
        .where(eq(bookings.id, existingPayment.bookingId))

      // Get booking details for confirmation email
      const [booking] = await db
        .select({
          citizenId: bookings.citizenId,
          scheduledAt: bookings.scheduledAt,
          meetingLink: bookings.meetingLink,
          feeGhs: bookings.feeGhs,
        })
        .from(bookings)
        .where(eq(bookings.id, existingPayment.bookingId))
        .limit(1)

      if (booking) {
        const [citizen] = await db
          .select({ email: profiles.email, displayName: profiles.displayName })
          .from(profiles)
          .where(eq(profiles.id, booking.citizenId))
          .limit(1)

        if (citizen && booking.scheduledAt) {
          await sendBookingConfirmation({
            toEmail: citizen.email,
            toName: citizen.displayName ?? 'there',
            lawyerName: (meta.lawyer_name as string) ?? 'Your Lawyer',
            scheduledAt: booking.scheduledAt,
            meetingLink: booking.meetingLink ?? '#',
            feeGhs: booking.feeGhs,
          }).catch(console.error)
        }
      }

      console.log(`[Webhook] Booking ${existingPayment.bookingId} confirmed`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[Webhook] Processing error:', err)
    // Return 200 to prevent Paystack retries for server errors
    return NextResponse.json({ received: true })
  }
}
