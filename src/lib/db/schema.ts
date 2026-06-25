import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  real,
  timestamp,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ─── Enums ───────────────────────────────────────────────────────────────────

export const subscriptionTierEnum = pgEnum('subscription_tier', ['free', 'pro', 'lawyer'])
export const userRoleEnum = pgEnum('user_role', ['user', 'lawyer', 'admin'])
export const languageEnum = pgEnum('language', ['en', 'tw', 'ga'])
export const queryModeEnum = pgEnum('query_mode', ['rights', 'letter', 'both'])
export const caseStatusEnum = pgEnum('case_status', ['open', 'resolved', 'referred'])
export const bookingStatusEnum = pgEnum('booking_status', [
  'pending', 'confirmed', 'completed', 'cancelled',
])
export const paymentStatusEnum = pgEnum('payment_status', [
  'pending', 'success', 'failed', 'refunded',
])
export const paymentTypeEnum = pgEnum('payment_type', ['subscription', 'consultation'])
export const corpusJobStatusEnum = pgEnum('corpus_job_status', [
  'queued', 'processing', 'done', 'failed',
])

// ─── Profiles ─────────────────────────────────────────────────────────────────
// Each profile is linked 1:1 to a Supabase auth user via the 'id' field.
// The id field contains the auth.users.id UUID, creating a foreign key relationship.
// When a user signs up, ensure-profile creates a matching profile record.

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(), // Foreign key to auth.users.id - automatically set during signup
  displayName: text('display_name'),
  email: text('email').notNull(),
  role: userRoleEnum('role').notNull().default('user'),
  subscriptionTier: subscriptionTierEnum('subscription_tier').notNull().default('free'),
  preferredLanguage: languageEnum('preferred_language').notNull().default('en'),
  avatarUrl: text('avatar_url'),
  phone: text('phone'),
  paystackCustomerId: text('paystack_customer_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Queries ──────────────────────────────────────────────────────────────────

export const queries = pgTable('queries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'set null' }),
  inputText: text('input_text').notNull(),
  inputLanguage: languageEnum('input_language').notNull().default('en'),
  translatedInput: text('translated_input'),
  retrievedChunks: jsonb('retrieved_chunks'), // top-5 chunks used
  rightsResponse: text('rights_response'),
  letterResponse: text('letter_response'),
  responseLanguage: languageEnum('response_language').notNull().default('en'),
  citedArticles: text('cited_articles').array(),
  latencyMs: integer('latency_ms'),
  satisfied: boolean('satisfied'), // null = no rating given
  flagged: boolean('flagged').default(false),
  flagReason: text('flag_reason'),
  ipHash: text('ip_hash'), // hashed IP for anonymous rate-limiting
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Saved Cases ──────────────────────────────────────────────────────────────

export const savedCases = pgTable('saved_cases', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  queryId: uuid('query_id').references(() => queries.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  notes: text('notes'),
  status: caseStatusEnum('status').notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Lawyers ──────────────────────────────────────────────────────────────────

export const lawyers = pgTable('lawyers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  fullName: text('full_name').notNull(),
  barNumber: text('bar_number').notNull().unique(),
  photoUrl: text('photo_url'),
  specialisations: text('specialisations').array().notNull().default(sql`ARRAY[]::text[]`),
  languages: text('languages').array().notNull().default(sql`ARRAY[]::text[]`),
  regions: text('regions').array().notNull().default(sql`ARRAY[]::text[]`),
  bio: text('bio'),
  consultationFeeGhs: real('consultation_fee_ghs').notNull(),
  isVerified: boolean('is_verified').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  ratingAvg: real('rating_avg').notNull().default(0),
  ratingCount: integer('rating_count').notNull().default(0),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Bookings ─────────────────────────────────────────────────────────────────

export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  citizenId: uuid('citizen_id').references(() => profiles.id).notNull(),
  lawyerId: uuid('lawyer_id').references(() => lawyers.id).notNull(),
  queryId: uuid('query_id').references(() => queries.id, { onDelete: 'set null' }),
  status: bookingStatusEnum('status').notNull().default('pending'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  meetingLink: text('meeting_link'),
  feeGhs: real('fee_ghs').notNull(),
  commissionGhs: real('commission_ghs').notNull(), // 15%
  paystackReference: text('paystack_reference'),
  citizenRating: integer('citizen_rating'), // 1-5
  citizenReview: text('citizen_review'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Payments ─────────────────────────────────────────────────────────────────

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id).notNull(),
  bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
  amountGhs: real('amount_ghs').notNull(),
  currency: text('currency').notNull().default('GHS'),
  paystackReference: text('paystack_reference').notNull().unique(),
  paystackStatus: paymentStatusEnum('paystack_status').notNull().default('pending'),
  paymentType: paymentTypeEnum('payment_type').notNull(),
  paymentMethod: text('payment_method'), // card, mobile_money
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Legal Documents ──────────────────────────────────────────────────────────

export const legalDocuments = pgTable('legal_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  actName: text('act_name').notNull(),
  actNumber: text('act_number'),
  year: integer('year'),
  fileUrl: text('file_url'),
  chunkCount: integer('chunk_count').notNull().default(0),
  lastIndexedAt: timestamp('last_indexed_at', { withTimezone: true }),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Corpus Jobs ─────────────────────────────────────────────────────────────

export const corpusJobs = pgTable('corpus_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').references(() => legalDocuments.id, { onDelete: 'cascade' }).notNull(),
  status: corpusJobStatusEnum('status').notNull().default('queued'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Analytics ────────────────────────────────────────────────────────────────

export const analyticsDaily = pgTable('analytics_daily', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: text('date').notNull().unique(), // YYYY-MM-DD
  totalQueries: integer('total_queries').notNull().default(0),
  uniqueUsers: integer('unique_users').notNull().default(0),
  queriesByLanguage: jsonb('queries_by_language'), // { en: 100, tw: 50, ga: 20 }
  queriesByAct: jsonb('queries_by_act'), // { "Labour Act 651": 45, ... }
  avgLatencyMs: real('avg_latency_ms'),
  satisfactionRate: real('satisfaction_rate'),
  newSignups: integer('new_signups').notNull().default(0),
  proUpgrades: integer('pro_upgrades').notNull().default(0),
  bookingsCreated: integer('bookings_created').notNull().default(0),
})

// ─── Types ────────────────────────────────────────────────────────────────────

export type Profile = typeof profiles.$inferSelect
export type Query = typeof queries.$inferSelect
export type SavedCase = typeof savedCases.$inferSelect
export type Lawyer = typeof lawyers.$inferSelect
export type Booking = typeof bookings.$inferSelect
export type Payment = typeof payments.$inferSelect
export type LegalDocument = typeof legalDocuments.$inferSelect
export type CorpusJob = typeof corpusJobs.$inferSelect

export type NewQuery = typeof queries.$inferInsert
export type NewBooking = typeof bookings.$inferInsert
export type NewPayment = typeof payments.$inferInsert
