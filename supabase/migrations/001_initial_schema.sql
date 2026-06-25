-- ============================================================
-- LawBridge GH — Supabase Database Migration
-- Run via: supabase db push  OR  paste into Supabase SQL Editor
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enums ─────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'lawyer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('user', 'lawyer', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE language_code AS ENUM ('en', 'tw', 'ga');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'success', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_type AS ENUM ('subscription', 'consultation');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE corpus_job_status AS ENUM ('queued', 'processing', 'done', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE case_status AS ENUM ('open', 'resolved', 'referred');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Profiles ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name      TEXT,
  email             TEXT NOT NULL,
  role              user_role NOT NULL DEFAULT 'user',
  subscription_tier subscription_tier NOT NULL DEFAULT 'free',
  preferred_language language_code NOT NULL DEFAULT 'en',
  avatar_url        TEXT,
  phone             TEXT,
  paystack_customer_id TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'user')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Queries ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS queries (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  input_text        TEXT NOT NULL,
  input_language    language_code NOT NULL DEFAULT 'en',
  translated_input  TEXT,
  retrieved_chunks  JSONB,
  rights_response   TEXT,
  letter_response   TEXT,
  response_language language_code NOT NULL DEFAULT 'en',
  cited_articles    TEXT[],
  latency_ms        INTEGER,
  satisfied         BOOLEAN,
  flagged           BOOLEAN DEFAULT FALSE,
  flag_reason       TEXT,
  ip_hash           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queries_user_id ON queries(user_id);
CREATE INDEX IF NOT EXISTS idx_queries_created_at ON queries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_queries_ip_hash ON queries(ip_hash);

-- ── Saved Cases ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS saved_cases (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  query_id    UUID REFERENCES queries(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  notes       TEXT,
  status      case_status NOT NULL DEFAULT 'open',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_cases_user_id ON saved_cases(user_id);

-- ── Lawyers ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lawyers (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  full_name             TEXT NOT NULL,
  bar_number            TEXT NOT NULL UNIQUE,
  photo_url             TEXT,
  specialisations       TEXT[] NOT NULL DEFAULT '{}',
  languages             TEXT[] NOT NULL DEFAULT '{}',
  regions               TEXT[] NOT NULL DEFAULT '{}',
  bio                   TEXT,
  consultation_fee_ghs  REAL NOT NULL,
  is_verified           BOOLEAN NOT NULL DEFAULT FALSE,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  rating_avg            REAL NOT NULL DEFAULT 0,
  rating_count          INTEGER NOT NULL DEFAULT 0,
  rejection_reason      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lawyers_verified_active ON lawyers(is_verified, is_active);
CREATE INDEX IF NOT EXISTS idx_lawyers_rating ON lawyers(rating_avg DESC);

-- ── Bookings ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bookings (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  citizen_id          UUID NOT NULL REFERENCES profiles(id),
  lawyer_id           UUID NOT NULL REFERENCES lawyers(id),
  query_id            UUID REFERENCES queries(id) ON DELETE SET NULL,
  status              booking_status NOT NULL DEFAULT 'pending',
  scheduled_at        TIMESTAMPTZ,
  meeting_link        TEXT,
  fee_ghs             REAL NOT NULL,
  commission_ghs      REAL NOT NULL,
  paystack_reference  TEXT,
  citizen_rating      SMALLINT CHECK (citizen_rating BETWEEN 1 AND 5),
  citizen_review      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_citizen ON bookings(citizen_id);
CREATE INDEX IF NOT EXISTS idx_bookings_lawyer ON bookings(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- ── Payments ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES profiles(id),
  booking_id          UUID REFERENCES bookings(id) ON DELETE SET NULL,
  amount_ghs          REAL NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'GHS',
  paystack_reference  TEXT NOT NULL UNIQUE,
  paystack_status     payment_status NOT NULL DEFAULT 'pending',
  payment_type        payment_type NOT NULL,
  payment_method      TEXT,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(paystack_reference);

-- ── Legal Documents ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS legal_documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           TEXT NOT NULL,
  act_name        TEXT NOT NULL,
  act_number      TEXT,
  year            INTEGER,
  file_url        TEXT,
  chunk_count     INTEGER NOT NULL DEFAULT 0,
  last_indexed_at TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Corpus Jobs ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS corpus_jobs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id   UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
  status        corpus_job_status NOT NULL DEFAULT 'queued',
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Analytics ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS analytics_daily (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date                  DATE NOT NULL UNIQUE,
  total_queries         INTEGER NOT NULL DEFAULT 0,
  unique_users          INTEGER NOT NULL DEFAULT 0,
  queries_by_language   JSONB,
  queries_by_act        JSONB,
  avg_latency_ms        REAL,
  satisfaction_rate     REAL,
  new_signups           INTEGER NOT NULL DEFAULT 0,
  pro_upgrades          INTEGER NOT NULL DEFAULT 0,
  bookings_created      INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE lawyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE corpus_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily ENABLE ROW LEVEL SECURITY;

-- Profiles: users manage only their own profile
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Queries: users see only their own
CREATE POLICY "queries_select_own" ON queries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "queries_insert_own" ON queries FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "queries_update_own" ON queries FOR UPDATE USING (auth.uid() = user_id);

-- Saved cases: full CRUD own rows
CREATE POLICY "saved_cases_own" ON saved_cases USING (auth.uid() = user_id);

-- Lawyers: public can read verified active profiles; lawyers manage own
CREATE POLICY "lawyers_public_select" ON lawyers FOR SELECT USING (is_verified = TRUE AND is_active = TRUE);
CREATE POLICY "lawyers_insert_own" ON lawyers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lawyers_update_own" ON lawyers FOR UPDATE USING (auth.uid() = user_id);

-- Bookings: citizens see their own; lawyers see theirs
CREATE POLICY "bookings_citizen" ON bookings FOR SELECT USING (auth.uid() = citizen_id);
CREATE POLICY "bookings_lawyer" ON bookings FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM lawyers WHERE id = lawyer_id)
);
CREATE POLICY "bookings_insert" ON bookings FOR INSERT WITH CHECK (auth.uid() = citizen_id);

-- Payments: users see their own
CREATE POLICY "payments_own" ON payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "payments_insert" ON payments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Legal documents: public read active; write via service role only
CREATE POLICY "legal_docs_public_select" ON legal_documents FOR SELECT USING (is_active = TRUE);

-- Corpus jobs: service role only (no user-level access)
-- (No user policy — accessible only via service_role key in API routes)

-- Analytics: service role only
-- (No user policy)

-- ============================================================
-- SEED DATA — Core Ghana Statutes (update file_url after upload)
-- ============================================================

INSERT INTO legal_documents (title, act_name, act_number, year, is_active)
VALUES
  ('Constitution of Ghana 1992', 'Constitution', NULL, 1992, TRUE),
  ('Labour Act', 'Labour Act', '651', 2003, TRUE),
  ('Rent Act', 'Rent Act', '220', 1963, TRUE),
  ('Criminal Offences Act', 'Criminal Offences Act', '29', 1960, TRUE),
  ('Consumer Protection Act', 'Consumer Protection Act', '890', 2020, TRUE),
  ('Domestic Violence Act', 'Domestic Violence Act', '732', 2007, TRUE),
  ('Children''s Act', 'Children''s Act', '560', 1998, TRUE)
ON CONFLICT DO NOTHING;
