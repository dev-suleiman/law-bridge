'use client'

import { useState } from 'react'
import { X, Calendar, CreditCard, Smartphone, Loader2, CheckCircle2 } from 'lucide-react'
import type { Lawyer } from '@/lib/db/schema'

interface BookingModalProps {
  lawyer: Lawyer
  onClose: () => void
}

export function BookingModal({ lawyer, onClose }: BookingModalProps) {
  const [step, setStep] = useState<'details' | 'payment' | 'success'>('details')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [notes, setNotes] = useState('')

  const commission = lawyer.consultationFeeGhs * 0.15
  const totalFee = lawyer.consultationFeeGhs

  const handleProceedToPayment = async () => {
    if (!selectedDate || !selectedTime) {
      setError('Please select a date and time for your consultation.')
      return
    }
    setError(null)
    setStep('payment')
  }

  const handlePayWithPaystack = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_type: 'consultation',
          lawyer_id: lawyer.id,
          amount_ghs: totalFee,
          // booking_id would be created server-side in a real flow
          booking_id: '00000000-0000-0000-0000-000000000000',
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        if (res.status === 401) {
          setError('Please sign in to book a consultation.')
          return
        }
        setError(data.error ?? 'Payment failed. Please try again.')
        return
      }

      // Redirect to Paystack checkout
      window.location.href = data.authorization_url
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  // Generate time slots
  const timeSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00']

  // Min date: tomorrow
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().split('T')[0]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-xl max-h-[90dvh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between rounded-t-3xl sm:rounded-t-2xl z-10">
          <h2 className="font-display font-bold text-xl text-text-primary">
            {step === 'success' ? 'Booking Confirmed!' : `Book — ${lawyer.fullName}`}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-surface-secondary rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Step: Details */}
          {step === 'details' && (
            <div className="space-y-5">
              <div className="bg-surface-secondary rounded-xl p-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text-secondary">Consultation fee</span>
                  <span className="font-semibold text-text-primary">GHS {totalFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-text-muted">
                  <span>Includes platform service fee</span>
                  <span>Video call, 1 hour</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Preferred date <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  min={minDate}
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Preferred time <span className="text-danger">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {timeSlots.map(time => (
                    <button
                      key={time}
                      onClick={() => setSelectedTime(time)}
                      className={`py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                        selectedTime === time
                          ? 'bg-primary text-white border-primary'
                          : 'border-border text-text-secondary hover:border-primary hover:text-primary'
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Brief description of your issue (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Help the lawyer prepare…"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm resize-none"
                />
              </div>

              {error && (
                <p className="text-sm text-danger bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
              )}

              <button
                onClick={handleProceedToPayment}
                className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary-hover transition-colors flex items-center justify-center gap-2"
              >
                <Calendar className="w-5 h-5" />
                Continue to Payment — GHS {totalFee.toFixed(2)}
              </button>
            </div>
          )}

          {/* Step: Payment */}
          {step === 'payment' && (
            <div className="space-y-5">
              <div className="bg-surface-secondary rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Consultation with</span>
                  <span className="font-semibold">{lawyer.fullName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Date & time</span>
                  <span className="font-semibold">{selectedDate} at {selectedTime}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span>GHS {totalFee.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-text-secondary">Payment methods accepted:</p>
                <div className="grid grid-cols-2 gap-3 text-sm text-text-secondary">
                  {['MTN MoMo', 'Vodafone Cash', 'AirtelTigo Money', 'Debit/Credit Card'].map(method => (
                    <div key={method} className="flex items-center gap-2 bg-surface-secondary rounded-lg px-3 py-2">
                      <Smartphone className="w-4 h-4 text-primary" />
                      {method}
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-sm text-danger bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
              )}

              <button
                onClick={handlePayWithPaystack}
                disabled={loading}
                className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Redirecting to payment…</>
                ) : (
                  <><CreditCard className="w-5 h-5" /> Pay GHS {totalFee.toFixed(2)} with Paystack</>
                )}
              </button>

              <button
                onClick={() => setStep('details')}
                className="w-full text-sm text-text-muted hover:text-text-secondary py-2"
              >
                ← Back to details
              </button>

              <p className="text-xs text-text-muted text-center">
                Secured by Paystack. You will be redirected to complete payment.
              </p>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-display font-bold text-xl text-text-primary mb-2">Booking Confirmed!</h3>
              <p className="text-text-secondary mb-6">
                A confirmation email with your video call link has been sent.
              </p>
              <button
                onClick={onClose}
                className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary-hover transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
