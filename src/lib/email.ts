import type { Resend } from 'resend'

function getFromEmail() {
  return process.env.RESEND_FROM_EMAIL || 'noreply@lawbridge.gh'
}

async function createResendClient(): Promise<Resend | null> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY is not configured; skipping send')
    return null
  }

  const { Resend } = await import('resend')
  return new Resend(apiKey)
}

export async function sendBookingConfirmation(params: {
  toEmail: string
  toName: string
  lawyerName: string
  scheduledAt: Date
  meetingLink: string
  feeGhs: number
}) {
  const resend = await createResendClient()
  if (!resend) return

  const from = getFromEmail()
  const dateStr = params.scheduledAt.toLocaleString('en-GH', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Africa/Accra',
  })

  await resend.emails.send({
    from: `LawBridge GH <${from}>`,
    to: params.toEmail,
    subject: `Booking Confirmed — ${params.lawyerName}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <div style="background:#006B3F;padding:20px;border-radius:8px 8px 0 0;text-align:center">
          <h1 style="color:#FCD116;margin:0;font-size:24px">LawBridge GH</h1>
          <p style="color:#fff;margin:4px 0 0">Know Your Rights</p>
        </div>
        <div style="background:#fff;border:1px solid #E2EAE6;border-top:none;padding:32px;border-radius:0 0 8px 8px">
          <h2 style="color:#0F1F18">Booking Confirmed ✓</h2>
          <p>Dear ${params.toName},</p>
          <p>Your consultation has been confirmed. Here are your details:</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0">
            <tr><td style="padding:8px 0;color:#4A5C54;border-bottom:1px solid #E2EAE6"><strong>Lawyer</strong></td><td style="padding:8px 0;border-bottom:1px solid #E2EAE6">${params.lawyerName}</td></tr>
            <tr><td style="padding:8px 0;color:#4A5C54;border-bottom:1px solid #E2EAE6"><strong>Date & Time</strong></td><td style="padding:8px 0;border-bottom:1px solid #E2EAE6">${dateStr}</td></tr>
            <tr><td style="padding:8px 0;color:#4A5C54"><strong>Fee Paid</strong></td><td style="padding:8px 0">GHS ${params.feeGhs.toFixed(2)}</td></tr>
          </table>
          <a href="${params.meetingLink}" style="display:inline-block;background:#006B3F;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Join Video Call</a>
          <p style="color:#7A9089;font-size:14px;margin-top:24px">If you need to reschedule, please contact your lawyer at least 24 hours in advance.</p>
          <hr style="border:none;border-top:1px solid #E2EAE6;margin:24px 0">
          <p style="color:#7A9089;font-size:12px">LawBridge GH — Making legal knowledge accessible to every Ghanaian.<br>This is an automated message. The information provided is not legal advice.</p>
        </div>
      </div>
    `,
  })
}

export async function sendLawyerVerificationResult(params: {
  toEmail: string
  lawyerName: string
  approved: boolean
  rejectionReason?: string
}) {
  const resend = await createResendClient()
  if (!resend) return

  const from = getFromEmail()
  const subject = params.approved
    ? 'Your LawBridge GH Profile is Approved!'
    : 'LawBridge GH — Application Update'

  const body = params.approved
    ? `<p>Congratulations ${params.lawyerName}! Your lawyer profile has been verified and is now live on LawBridge GH.</p><p>Citizens can now find and book consultations with you.</p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display:inline-block;background:#006B3F;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600">View Your Profile</a>`
    : `<p>Dear ${params.lawyerName},</p><p>After review, we were unable to verify your application at this time.</p>${params.rejectionReason ? `<p><strong>Reason:</strong> ${params.rejectionReason}</p>` : ''}<p>Please contact support@lawbridge.gh if you have questions.</p>`

  await resend.emails.send({
    from: `LawBridge GH <${from}>`,
    to: params.toEmail,
    subject,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">${body}</div>`,
  })
}

export async function sendWelcomeEmail(params: { toEmail: string; name: string }) {
  const resend = await createResendClient()
  if (!resend) return

  const from = getFromEmail()

  await resend.emails.send({
    from: `LawBridge GH <${from}>`,
    to: params.toEmail,
    subject: 'Welcome to LawBridge GH — Know Your Rights',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h2>Welcome, ${params.name || 'there'}!</h2>
        <p>You now have access to free AI-powered legal guidance based on Ghana's Constitution, Labour Act, Rent Act, and more.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/query" style="display:inline-block;background:#006B3F;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600">Ask Your First Question</a>
        <p style="color:#7A9089;font-size:12px;margin-top:24px">Remember: LawBridge GH provides information, not legal advice. For your specific situation, consult a qualified Ghanaian lawyer.</p>
      </div>
    `,
  })
}
