'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Star, MapPin, Globe, Search, Filter, X } from 'lucide-react'
import type { Lawyer } from '@/lib/db/schema'
import { BookingModal } from './booking-modal'

const SPECIALISATIONS = ['Labour & Employment', 'Tenancy & Housing', 'Family Law', 'Criminal Law', 'Consumer Rights', 'Civil Litigation', 'Human Rights']
const REGIONS = ['Greater Accra', 'Ashanti', 'Western', 'Central', 'Eastern', 'Volta', 'Northern', 'Upper East', 'Upper West', 'Brong-Ahafo', 'Bono East', 'Oti', 'Ahafo', 'Western North', 'Savannah', 'North East']
const LANGUAGES = ['English', 'Twi', 'Ga', 'Hausa', 'Ewe', 'Dagbani']

interface LawyerSearchProps {
  initialLawyers: Lawyer[]
}

export function LawyerSearch({ initialLawyers }: LawyerSearchProps) {
  const [lawyers, setLawyers] = useState<Lawyer[]>(initialLawyers)
  const [loading, setLoading] = useState(false)
  const [selectedLawyer, setSelectedLawyer] = useState<Lawyer | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    specialisation: '',
    region: '',
    language: '',
    maxFee: '',
  })

  const applyFilters = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.specialisation) params.set('specialisation', filters.specialisation)
      if (filters.region) params.set('region', filters.region)
      if (filters.language) params.set('language', filters.language)
      if (filters.maxFee) params.set('max_fee', filters.maxFee)

      const res = await fetch(`/api/lawyers?${params}`)
      const data = await res.json()
      setLawyers(data.lawyers ?? [])
    } catch {
      // Keep current results on error
    } finally {
      setLoading(false)
    }
  }

  const clearFilters = () => {
    setFilters({ specialisation: '', region: '', language: '', maxFee: '' })
    setLawyers(initialLawyers)
  }

  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div>
      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-border p-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
              showFilters || hasFilters
                ? 'bg-primary text-white border-primary'
                : 'border-border text-text-secondary hover:border-primary hover:text-primary'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters {hasFilters ? `(${Object.values(filters).filter(Boolean).length})` : ''}
          </button>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-sm text-text-muted hover:text-danger transition-colors"
            >
              <X className="w-4 h-4" /> Clear filters
            </button>
          )}

          <span className="ml-auto text-sm text-text-muted">{lawyers.length} lawyers found</span>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Specialisation</label>
              <select
                value={filters.specialisation}
                onChange={e => setFilters(p => ({ ...p, specialisation: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All areas</option>
                {SPECIALISATIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Region</label>
              <select
                value={filters.region}
                onChange={e => setFilters(p => ({ ...p, region: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All regions</option>
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Language</label>
              <select
                value={filters.language}
                onChange={e => setFilters(p => ({ ...p, language: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Any language</option>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Max fee (GHS)</label>
              <input
                type="number"
                value={filters.maxFee}
                onChange={e => setFilters(p => ({ ...p, maxFee: e.target.value }))}
                placeholder="e.g. 200"
                className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="col-span-2 md:col-span-4 flex justify-end">
              <button
                onClick={applyFilters}
                disabled={loading}
                className="flex items-center gap-2 bg-primary text-white font-medium px-5 py-2 rounded-lg hover:bg-primary-hover transition-colors text-sm disabled:opacity-60"
              >
                <Search className="w-4 h-4" />
                {loading ? 'Searching…' : 'Apply Filters'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lawyer grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-border p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="skeleton w-16 h-16 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-3/4 rounded" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                </div>
              </div>
              <div className="skeleton h-16 rounded mb-4" />
              <div className="skeleton h-10 rounded-xl" />
            </div>
          ))}
        </div>
      ) : lawyers.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-text-secondary font-medium mb-2">No lawyers match your filters</p>
          <button onClick={clearFilters} className="text-primary hover:underline text-sm">Clear filters</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {lawyers.map(lawyer => (
            <LawyerCard key={lawyer.id} lawyer={lawyer} onBook={() => setSelectedLawyer(lawyer)} />
          ))}
        </div>
      )}

      {/* Booking modal */}
      {selectedLawyer && (
        <BookingModal lawyer={selectedLawyer} onClose={() => setSelectedLawyer(null)} />
      )}
    </div>
  )
}

function LawyerCard({ lawyer, onBook }: { lawyer: Lawyer; onBook: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-border card-hover flex flex-col overflow-hidden">
      <div className="p-6 flex-1">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-surface-tertiary flex-shrink-0">
            {lawyer.photoUrl ? (
              <Image
                src={lawyer.photoUrl}
                alt={lawyer.fullName}
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary/10">
                <span className="text-2xl font-bold text-primary">
                  {lawyer.fullName.charAt(0)}
                </span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-text-primary truncate">{lawyer.fullName}</h3>
            {lawyer.ratingCount > 0 && (
              <div className="flex items-center gap-1 mt-0.5">
                <Star className="w-3.5 h-3.5 text-accent fill-current" />
                <span className="text-sm font-medium text-text-primary">
                  {lawyer.ratingAvg.toFixed(1)}
                </span>
                <span className="text-xs text-text-muted">({lawyer.ratingCount})</span>
              </div>
            )}
          </div>
        </div>

        {lawyer.bio && (
          <p className="text-sm text-text-secondary leading-relaxed mb-4 line-clamp-3">
            {lawyer.bio}
          </p>
        )}

        <div className="space-y-2">
          {lawyer.regions.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{lawyer.regions.slice(0, 2).join(', ')}</span>
            </div>
          )}
          {lawyer.languages.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <Globe className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{lawyer.languages.join(', ')}</span>
            </div>
          )}
        </div>

        {lawyer.specialisations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {lawyer.specialisations.slice(0, 3).map(spec => (
              <span key={spec} className="text-xs bg-primary/10 text-primary font-medium px-2.5 py-1 rounded-full">
                {spec}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="px-6 pb-6">
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div>
            <p className="text-xs text-text-muted">Consultation fee</p>
            <p className="text-lg font-display font-bold text-text-primary">
              GHS {lawyer.consultationFeeGhs.toFixed(0)}
            </p>
          </div>
          <button
            onClick={onBook}
            className="bg-primary text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-primary-hover transition-colors text-sm"
          >
            Book Now
          </button>
        </div>
      </div>
    </div>
  )
}
