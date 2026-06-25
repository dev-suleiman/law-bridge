# LawBridge GH — KnowYourRights GH Platform

> **Every person who knows their rights is harder to cheat.**

AI-powered legal rights guidance for Ghanaian citizens — in English, Twi, and Ga. Built for mobile, free at its core, and grounded in Ghana's Constitution and statutory law.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Quick Start — Local Development](#3-quick-start--local-development)
4. [Service-by-Service Setup](#4-service-by-service-setup)
   - [Supabase](#41-supabase-database--auth)
   - [Pinecone](#42-pinecone-vector-store)
   - [Anthropic Claude API](#43-anthropic-claude-api-stub-llm-mode)
   - [GhanaNLP Khaya AI](#44-ghanalp-khaya-ai-translation)
   - [Paystack](#45-paystack-payments)
   - [Upstash Redis](#46-upstash-redis-rate-limiting)
   - [Resend Email](#47-resend-email)
   - [Railway ML Service](#48-railway-ml-microservice)
   - [Vercel Next.js](#49-vercel-nextjs-deployment)
5. [Environment Variables Reference](#5-environment-variables-reference)
6. [AI Model — Stub vs Mistral Mode](#6-ai-model--stub-vs-mistral-mode)
7. [LoRA Fine-Tuning Pipeline](#7-lora-fine-tuning-pipeline)
8. [Legal Corpus Indexing](#8-legal-corpus-indexing)
9. [Paystack Webhook Setup](#9-paystack-webhook-setup)
10. [Admin Dashboard](#10-admin-dashboard)
11. [CI/CD](#11-cicd)
12. [Performance Targets](#12-performance-targets)
13. [Security Notes](#13-security-notes)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  Next.js 14 (Vercel)             │
│  Landing · Query · Lawyers · Dashboard · Admin   │
│                                                   │
│  API Routes:                                      │
│    POST /api/query          ← core AI endpoint   │
│    POST /api/payments/initiate                    │
│    POST /api/payments/webhook  ← Paystack        │
│    GET  /api/lawyers                              │
│    POST /api/admin/index                          │
└──────────┬──────────────────────┬────────────────┘
           │                      │
           ▼                      ▼
┌──────────────────┐   ┌──────────────────────────┐
│  Supabase        │   │  ML Microservice (Railway)│
│  - Postgres DB   │   │                           │
│  - Auth          │   │  /query  → RAG + LLM      │
│  - Storage       │   │  /health                  │
│  - RLS Policies  │   │  /corpus/index            │
└──────────────────┘   │                           │
                       │  Stage 1: Pinecone/FAISS  │
┌──────────────────┐   │  Stage 2: Cross-encoder   │
│  Upstash Redis   │   │  LLM: Claude API (stub)   │
│  Rate limiting   │   │       or Mistral 7B+LoRA  │
└──────────────────┘   └──────────────────────────┘
                                    │
                       ┌────────────┴───────────┐
                       │                        │
                       ▼                        ▼
              ┌─────────────────┐    ┌──────────────────┐
              │  Pinecone       │    │  GhanaNLP Khaya  │
              │  Vector store   │    │  Twi/Ga ↔ EN     │
              └─────────────────┘    └──────────────────┘
```

**Tech Stack Summary:**

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS, shadcn/ui |
| Auth | Supabase Auth (cookie-based sessions) |
| Database | Supabase Postgres + Drizzle ORM |
| Vector Store | Pinecone (production) / FAISS (local fallback) |
| LLM (stub) | Anthropic Claude API |
| LLM (production) | Fine-tuned Mistral 7B + LoRA adapter |
| Translation | GhanaNLP Khaya AI |
| Payments | Paystack (MoMo + card) |
| Email | Resend |
| Rate Limiting | Upstash Redis |
| ML Hosting | Railway (Docker container) |
| Web Hosting | Vercel |

---

## 2. Prerequisites

- **Node.js 20 LTS** — [nodejs.org](https://nodejs.org)
- **Python 3.11+** — [python.org](https://python.org)
- **Docker Desktop** — [docker.com](https://docker.com) (for local ML service)
- **Git**

Accounts you need (all have free tiers sufficient for development):

| Service | Sign up | Purpose |
|---|---|---|
| Supabase | [supabase.com](https://supabase.com) | Database, auth, storage |
| Pinecone | [pinecone.io](https://pinecone.io) | Vector search |
| Anthropic | [console.anthropic.com](https://console.anthropic.com) | Claude API (stub LLM mode) |
| GhanaNLP | [translation.ghananlp.org](https://translation.ghananlp.org) | Khaya AI translation |
| Paystack | [paystack.com](https://paystack.com) | Payments (Ghana) |
| Upstash | [upstash.com](https://upstash.com) | Serverless Redis |
| Resend | [resend.com](https://resend.com) | Transactional email |
| Railway | [railway.app](https://railway.app) | ML microservice hosting |
| Vercel | [vercel.com](https://vercel.com) | Next.js hosting |

---

## 3. Quick Start — Local Development

```bash
# 1. Clone the repository
git clone https://github.com/your-org/lawbridge-gh.git
cd lawbridge-gh

# 2. Install Node.js dependencies
npm install

# 3. Copy environment template
cp .env.example .env.local
# → Fill in ALL values in .env.local before continuing (see Section 4)

# 4. Run database migrations
# (Supabase must be configured first — see Section 4.1)
npm run db:migrate

# 5. Start the ML microservice (Docker required)
docker-compose up ml --build -d

# 6. Start Next.js dev server
npm run dev
# → App running at http://localhost:3000
# → ML service at http://localhost:8000
# → ML health check: http://localhost:8000/health
```

> **Important:** The ML service takes ~60 seconds to start on first boot as it downloads the embedding and reranker models. Watch logs with `docker-compose logs -f ml`.

---

## 4. Service-by-Service Setup

Work through these in order — later services depend on earlier ones.

---

### 4.1 Supabase — Database & Auth

**Step 1: Create a project**
1. Go to [supabase.com](https://supabase.com) → New Project
2. Choose **EU West** or the closest available region (Ghana region not yet available)
3. Set a strong database password — save it somewhere safe

**Step 2: Run migrations**
1. In your Supabase project, go to **SQL Editor**
2. Open `supabase/migrations/001_initial_schema.sql`
3. Paste the entire file and click **Run**
4. Verify: go to **Table Editor** — you should see all tables created

**Step 3: Get API keys**
1. Go to **Settings → API**
2. Copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

**Step 4: Configure Auth**
1. Go to **Authentication → Providers → Email** — ensure it's enabled
2. Go to **Authentication → URL Configuration**:
   - Site URL: `https://your-domain.com` (or `http://localhost:3000` for dev)
   - Add redirect URLs: `https://your-domain.com/auth/callback`

**Step 5: Get Database URL (for Drizzle ORM)**
1. Go to **Settings → Database → Connection string**
2. Select **URI** mode — copy the connection string
3. Add as `DATABASE_URL` in `.env.local`

**Step 6: Create Storage bucket**
1. Go to **Storage → New bucket**
2. Name: `legal-documents`, set to **Private**
3. Create another bucket: `lawyer-photos`, set to **Public**

---

### 4.2 Pinecone — Vector Store

**Step 1: Create account & index**
1. Sign up at [pinecone.io](https://pinecone.io)
2. Go to **Indexes → Create Index**
3. Settings:
   - **Name:** `lawbridge-legal-corpus` (must match `PINECONE_INDEX_NAME`)
   - **Dimensions:** `768` (matches `paraphrase-multilingual-mpnet-base-v2`)
   - **Metric:** `cosine`
   - **Pod type:** `starter` (free tier)

**Step 2: Get API key**
1. Go to **API Keys**
2. Copy your API key → `PINECONE_API_KEY`
3. Note your environment (e.g. `us-east-1-aws`) → `PINECONE_ENVIRONMENT`

> **Note:** The index will be empty until you run corpus indexing (Section 8). The ML service handles FAISS as a fallback if Pinecone has no vectors yet.

---

### 4.3 Anthropic Claude API — Stub LLM Mode

This is the LLM used in **stub mode** (default) until the Mistral fine-tuning is complete.

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key → `ANTHROPIC_API_KEY`
3. Ensure you have access to `claude-sonnet-4-20250514` (Claude 4 Sonnet)

**Cost estimate:** At ~$3/million output tokens, and roughly 800 tokens per response, this is approximately $0.0024 per query. Very affordable at early scale.

---

### 4.4 GhanaNLP Khaya AI — Translation

**Step 1: Get API access**
1. Go to [translation.ghananlp.org](https://translation.ghananlp.org)
2. Register for API access (academic/NGO tier available)
3. Retrieve your subscription key → `KHAYA_AI_API_KEY`

**Step 2: Verify supported language pairs**

The integration uses these Khaya AI language pairs:
- `ak-en` — Twi (Akan) → English
- `en-ak` — English → Twi
- `gaa-en` — Ga → English
- `en-gaa` — English → Ga

Test your key with:
```bash
curl -X POST "https://translation-api.ghananlp.org/v1/translate" \
  -H "Ocp-Apim-Subscription-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"in": "Me ho ye", "lang": "ak-en"}'
# Expected: {"translatedText": "I am fine"}
```

**Fallback behaviour:** If Khaya AI is unavailable, the system returns the original text unchanged. English queries always work without Khaya AI.

---

### 4.5 Paystack — Payments

**⚠️ Important:** Paystack requires a **Ghana-registered business** for live keys. Use test keys during development.

**Step 1: Create account**
1. Go to [paystack.com](https://paystack.com) → Create account with Ghana business details

**Step 2: Get test keys**
1. Go to **Settings → API Keys & Webhooks**
2. Ensure **Test Mode** is active (toggle at top)
3. Copy:
   - `Test Secret Key` → `PAYSTACK_SECRET_KEY`
   - `Test Public Key` → `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`

**Step 3: Configure webhook** (see Section 9 for full webhook setup)

**Step 4: Switch to live keys for production**
1. Toggle to **Live Mode**
2. Complete Paystack's business verification
3. Replace test keys with live keys in Vercel environment variables

**Test cards:**
| Card Number | Result |
|---|---|
| 4084 0840 8408 4081 | Success |
| 4084 0840 8408 4081 | Decline (use CVV 000) |

**Test MoMo:** Use number `0551234987` with any network, OTP `123456`

---

### 4.6 Upstash Redis — Rate Limiting

1. Go to [console.upstash.com](https://console.upstash.com) → Create Database
2. Settings: **Global** replication, **Pay per request** pricing
3. Copy from the database overview:
   - `REST URL` → `UPSTASH_REDIS_REST_URL`
   - `REST Token` → `UPSTASH_REDIS_REST_TOKEN`

---

### 4.7 Resend — Email

1. Go to [resend.com](https://resend.com) → Create account
2. Go to **API Keys → Create API Key** → `RESEND_API_KEY`
3. Add your domain under **Domains** and verify DNS records
4. Set `RESEND_FROM_EMAIL` to `noreply@your-domain.com`

For local development, you can use Resend's sandbox mode (emails go to your account inbox).

---

### 4.8 Railway — ML Microservice

**Step 1: Install Railway CLI**
```bash
npm install -g @railway/cli
railway login
```

**Step 2: Create project**
```bash
cd lawbridge-gh
railway init
# Select: "Empty Project" → name it "lawbridge-ml"
```

**Step 3: Set environment variables in Railway**

Go to your Railway project → **Variables** tab and add:

```
MODEL_MODE=stub
ML_SERVICE_SECRET=your-shared-secret-32-chars
ANTHROPIC_API_KEY=sk-ant-your-key
PINECONE_API_KEY=your-pinecone-key
PINECONE_INDEX_NAME=lawbridge-legal-corpus
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
KHAYA_AI_API_KEY=your-khaya-key
KHAYA_AI_BASE_URL=https://translation-api.ghananlp.org
ENV=production
```

**Step 4: Deploy**
```bash
railway up --dockerfile Dockerfile
```

**Step 5: Get service URL**
- Go to Railway dashboard → **Settings → Networking → Generate Domain**
- Copy the URL → set as `ML_SERVICE_URL` in Vercel (e.g. `https://lawbridge-ml.up.railway.app`)

**Step 6: Add persistent volume for FAISS index**
1. In Railway, go to **Volumes → New Volume**
2. Mount path: `/app/ml-service/corpus`
3. This persists the FAISS index across container restarts

**Step 7: Verify health**
```bash
curl https://your-ml-service.up.railway.app/health
# Expected: {"status":"ok","model_mode":"stub","pinecone_connected":true,...}
```

---

### 4.9 Vercel — Next.js Deployment

**Step 1: Import project**
1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Select your `lawbridge-gh` repository
3. Framework: **Next.js** (auto-detected)

**Step 2: Set environment variables**

In Vercel → Project → **Settings → Environment Variables**, add ALL variables from `.env.example`. Key ones:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=lawbridge-legal-corpus
ML_SERVICE_URL=https://your-ml-service.up.railway.app
ML_SERVICE_SECRET=your-shared-secret
ANTHROPIC_API_KEY=...
KHAYA_AI_API_KEY=...
PAYSTACK_SECRET_KEY=...
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
RESEND_API_KEY=...
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

**Step 3: Deploy**
```bash
# Or just push to main — Vercel auto-deploys
git push origin main
```

**Step 4: Configure custom domain**
1. Vercel → Project → **Domains**
2. Add `lawbridge.gh` or your domain
3. Update DNS records as instructed by Vercel

---

## 5. Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server only) |
| `DATABASE_URL` | ✅ | Postgres connection string for Drizzle ORM |
| `PINECONE_API_KEY` | ✅ | Pinecone vector store API key |
| `PINECONE_INDEX_NAME` | ✅ | Must be `lawbridge-legal-corpus` |
| `PINECONE_ENVIRONMENT` | ✅ | e.g. `us-east-1-aws` |
| `ML_SERVICE_URL` | ✅ | Railway ML service URL |
| `ML_SERVICE_SECRET` | ✅ | Shared secret for Next.js → ML auth (32+ chars) |
| `ANTHROPIC_API_KEY` | ✅ | Claude API key (stub mode) |
| `KHAYA_AI_API_KEY` | ✅ | GhanaNLP translation key |
| `KHAYA_AI_BASE_URL` | ✅ | `https://translation-api.ghananlp.org` |
| `PAYSTACK_SECRET_KEY` | ✅ | Paystack secret (server only) |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | ✅ | Paystack public key |
| `PAYSTACK_WEBHOOK_SECRET` | ✅ | HMAC secret for webhook verification |
| `UPSTASH_REDIS_REST_URL` | ✅ | Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | Upstash Redis token |
| `RESEND_API_KEY` | ✅ | Resend email API key |
| `RESEND_FROM_EMAIL` | ✅ | e.g. `noreply@lawbridge.gh` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Full app URL (no trailing slash) |
| `NEXT_PUBLIC_POSTHOG_KEY` | ⬜ | PostHog analytics (optional) |
| `SENTRY_DSN` | ⬜ | Sentry error tracking (optional) |

---

## 6. AI Model — Stub vs Mistral Mode

The ML microservice supports two modes, controlled by the `MODEL_MODE` environment variable.

### Stub Mode (Default — use this first)

```
MODEL_MODE=stub
```

- Uses **Anthropic Claude API** as the LLM
- Zero GPU requirement — runs on Railway's standard CPU containers
- Production-quality responses using the same prompt engineering as the fine-tuned model
- Ready to use immediately after setting your `ANTHROPIC_API_KEY`
- **Use this until fine-tuning is complete**

### Mistral Mode (after fine-tuning)

```
MODEL_MODE=mistral
MISTRAL_MODEL_PATH=/app/model/lawbridge-mistral-7b-lora
HF_BASE_MODEL=mistralai/Mistral-7B-Instruct-v0.3
HF_TOKEN=your-huggingface-token
```

- Uses locally-loaded **Mistral 7B + LoRA adapter**
- Requires 16–24 GB RAM on Railway (upgrade to Pro plan: `railway upgrade`)
- Adapter weights must be present at `MISTRAL_MODEL_PATH` in the container
- See Section 7 for the full fine-tuning process

### Switching Modes

1. Complete fine-tuning (Section 7)
2. Upload adapter weights to Supabase Storage
3. Add a startup script in the Dockerfile to download weights on boot
4. Set `MODEL_MODE=mistral` in Railway environment variables
5. Redeploy: `railway up`

---

## 7. LoRA Fine-Tuning Pipeline

Complete this after the platform is running in stub mode. Fine-tuning improves response quality for Ghanaian legal domain.

### Requirements

- GPU with 16+ GB VRAM (KNUST GPU, Google Colab Pro+, or Kaggle)
- HuggingFace account with Mistral 7B access ([apply here](https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.3))

### Step 1: Install training dependencies

```bash
pip install -r training/requirements-training.txt
```

Create `training/requirements-training.txt`:
```
transformers==4.41.2
peft==0.11.1
bitsandbytes==0.43.1
accelerate==0.31.0
datasets==2.20.0
trl==0.9.4
scipy==1.13.1
anthropic==0.29.0
torch==2.3.1
tensorboard
rouge-score
```

### Step 2: Prepare source documents

Create `training/source_docs/` and add Ghana statute text files:
```
training/source_docs/
  constitution_1992.txt       ← Full text of 1992 Constitution
  labour_act_651.txt          ← Labour Act 651 (2003)
  rent_act_220.txt            ← Rent Act 220 (1963)
  criminal_offences_act_29.txt
  consumer_protection_act_890.txt
  domestic_violence_act_732.txt
  childrens_act_560.txt
```

> Source documents can be obtained from: Ghana Legal Information Institute (GhaLII) at [ghalii.org](https://ghalii.org) — all statutes are publicly available.

### Step 3: Generate training dataset

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key
python training/generate_dataset.py \
  --corpus_dir training/source_docs/ \
  --output_dir training/data/ \
  --n_samples 10000

# Output:
#   training/data/train.jsonl  → 9,000 samples
#   training/data/val.jsonl    → 500 samples
#   training/data/test.jsonl   → 500 samples
```

**Estimated time:** ~2–3 hours and ~$8–12 in Claude API costs for 10,000 samples.

### Step 4: Validate the dataset

```bash
python training/train.py --dry_run
# Checks dataset format, tokenization, and prints a sample
```

### Step 5: Run fine-tuning

```bash
export HF_TOKEN=your-huggingface-token
python training/train.py \
  --output_dir ./model/lawbridge-mistral-7b-lora \
  --data_dir training/data/

# Training logs: ./model/lawbridge-mistral-7b-lora/logs/
# View in TensorBoard: tensorboard --logdir ./model/lawbridge-mistral-7b-lora/logs/
```

**Estimated training time:**
- KNUST GPU (A100 40GB): ~4–6 hours
- Colab Pro+ (A100 40GB): ~4–6 hours
- Kaggle (T4 16GB): ~12–18 hours (slower, may need to checkpoint)

### Step 6: Resume from checkpoint (if interrupted)

```bash
python training/train.py \
  --resume_from_checkpoint ./model/lawbridge-mistral-7b-lora/checkpoint-500
```

### Step 7: Evaluate against acceptance criteria

```bash
python training/evaluate.py \
  --model_path ./model/lawbridge-mistral-7b-lora \
  --test_data training/data/test.jsonl

# All criteria must PASS before deployment:
# ✅ Citation accuracy   >= 90%
# ✅ Disclaimer present  = 100%
# ✅ Hallucination rate  <= 5%
# ✅ ROUGE-L (letters)   >= 0.55
```

**If any criterion fails:**
- Increase training epochs: edit `num_train_epochs` in `training/train.py`
- Add more training samples via `generate_dataset.py`
- Check training data quality — rerun citation verifier

### Step 8: Deploy fine-tuned model

```bash
# Upload adapter weights to Supabase Storage
# (from project root)
npx supabase storage cp \
  ./model/lawbridge-mistral-7b-lora \
  sb://your-project/models/lawbridge-mistral-7b-lora

# Then set in Railway:
# MODEL_MODE=mistral
# MISTRAL_MODEL_PATH=/app/model/lawbridge-mistral-7b-lora
# And add a wget/curl download step to your Dockerfile startup
```

---

## 8. Legal Corpus Indexing

Before users can query the system, you must index Ghana's statutes into the vector store.

### Step 1: Upload statute PDFs to Supabase Storage

1. Go to Supabase → **Storage → legal-documents**
2. Upload PDFs of each statute (obtain from [ghalii.org](https://ghalii.org))
3. Copy the storage URL for each file

### Step 2: Update legal_documents table

In Supabase SQL Editor:
```sql
UPDATE legal_documents
SET file_url = 'https://your-project.supabase.co/storage/v1/object/public/legal-documents/labour_act_651.pdf'
WHERE act_name = 'Labour Act';

-- Repeat for each statute
```

### Step 3: Trigger indexing via Admin Dashboard

1. Go to `https://your-domain.com/admin` (must be logged in as admin)
2. Find each document in the Corpus table
3. Click **Re-index** for each document
4. Monitor job status — `done` = indexed successfully

### Step 4: Verify in Pinecone

```bash
# Check vector count in Pinecone dashboard
# Or via API:
curl -H "Api-Key: your-pinecone-key" \
  "https://lawbridge-legal-corpus-xxx.svc.pinecone.io/describe_index_stats"
```

You should see several thousand vectors (typically 3,000–8,000 across all 7 statutes).

### Creating your first admin user

```sql
-- Run in Supabase SQL Editor after signing up with your admin email
UPDATE profiles
SET role = 'admin'
WHERE email = 'your-admin-email@example.com';
```

---

## 9. Paystack Webhook Setup

Webhooks are critical for processing successful payments. Without this, subscription upgrades and booking confirmations won't work.

### Step 1: Set webhook URL in Paystack

1. Paystack Dashboard → **Settings → API Keys & Webhooks**
2. Add webhook URL: `https://your-domain.com/api/payments/webhook`
3. Select event: `charge.success`
4. Copy the **Webhook Secret** → `PAYSTACK_WEBHOOK_SECRET` in Vercel

### Step 2: Test webhooks locally

```bash
# Install Paystack CLI or use ngrok
npx ngrok http 3000

# Set webhook URL in Paystack test mode to:
# https://your-ngrok-id.ngrok.io/api/payments/webhook

# Make a test payment and verify the webhook is received
```

### Step 3: Verify idempotency

The webhook handler is idempotent — duplicate events for the same `reference` are safely ignored. This handles Paystack's retry behaviour on failed webhook delivery.

---

## 10. Admin Dashboard

Access at: `https://your-domain.com/admin`

**Requirements:** Must be logged in with a user whose `role = 'admin'` in the `profiles` table.

**Features:**
- **Corpus Management** — Upload documents, trigger re-indexing, monitor job status
- **User Management** — View users, manually adjust subscription tier
- **Lawyer Verification** — Approve/reject lawyer profiles (sets `is_verified` flag)
- **Analytics** — Query volume, language breakdown, latency metrics
- **Flagged Responses** — Review responses users flagged as incorrect

**Setting up first admin:**
```sql
-- Supabase SQL Editor
UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
```

---

## 11. CI/CD

The GitHub Actions pipeline (`.github/workflows/ci.yml`) runs on every PR and push to `main`:

| Job | Trigger | What it does |
|---|---|---|
| `nextjs-ci` | PR + push | TypeScript check, ESLint, Vitest unit tests |
| `python-ci` | PR + push | Ruff linting for ML service |
| `secret-scan` | PR + push | TruffleHog scans for leaked secrets |
| `lighthouse` | PR only | Accessibility score ≥ 95 check |
| `deploy-check` | push to main | Confirms all checks passed before auto-deploy |

**Auto-deploy:**
- **Next.js** → Vercel deploys automatically on merge to `main` via GitHub integration
- **ML service** → Railway deploys automatically when `Dockerfile` changes

---

## 12. Performance Targets

| Metric | Target | How to Measure |
|---|---|---|
| Time to First Token (AI) | < 3.5s | Client-side `performance.now()` |
| Full response complete | < 12s | Client-side timing |
| Page LCP | < 2.5s on 3G | Lighthouse CI |
| Retrieval latency (p95) | < 500ms | ML service `/metrics` |
| AI response uptime | 99.5% monthly | UptimeRobot |
| Lighthouse Accessibility | ≥ 95 | GitHub Actions Lighthouse CI |

---

## 13. Security Notes

**Never commit to git:**
- `.env.local` — local secrets
- Any file containing API keys
- Model weights (use Supabase Storage)
- Training data (may contain sensitive legal scenarios)

**Key security measures in the codebase:**
- Paystack webhook signature verified via HMAC-SHA512 on every request
- Supabase RLS enforced at database level — users cannot access others' data
- `SUPABASE_SERVICE_ROLE_KEY` only used server-side (never exposed to client)
- ML microservice protected by shared secret header — not exposed to public internet
- User input sanitised (HTML stripped) before passing to ML service
- Rate limiting enforced server-side via Upstash Redis
- Prompt injection detection in `ml-service/safety.py`

**Regular security tasks:**
- Rotate `ML_SERVICE_SECRET` every 90 days
- Review TruffleHog scan results on every PR
- Monitor Sentry for unusual error patterns
- Check Supabase Auth logs for suspicious sign-in attempts

---

## 14. Troubleshooting

### ML service not reachable

```bash
# Check Railway logs
railway logs

# Test health endpoint
curl https://your-ml-service.up.railway.app/health

# Common causes:
# - ML_SERVICE_SECRET mismatch between Next.js and Railway
# - Railway container still starting (wait 2-3 minutes on cold start)
# - Port mismatch (must be 8000)
```

### "No retrieval results" on queries

The FAISS/Pinecone index is empty. Run corpus indexing first (Section 8).

```bash
# Check Pinecone vector count
# Dashboard → your index → describe_index_stats
# total_vector_count should be > 0
```

### Paystack webhook not processing

```bash
# Check Vercel function logs
vercel logs --follow

# Verify webhook secret matches exactly
# Common issue: webhook URL uses HTTP not HTTPS
# Paystack requires HTTPS for live webhooks
```

### Translation returning original text

Khaya AI API key issue or unsupported language pair.

```bash
# Test your Khaya AI key directly
curl -X POST "https://translation-api.ghananlp.org/v1/translate" \
  -H "Ocp-Apim-Subscription-Key: $KHAYA_AI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"in": "Wo ho te sen", "lang": "ak-en"}'
```

### Database migration errors

```bash
# Re-run migration — it's idempotent (all CREATE IF NOT EXISTS)
# Paste supabase/migrations/001_initial_schema.sql in Supabase SQL Editor

# Check for existing enum conflicts:
SELECT typname FROM pg_type WHERE typtype = 'e';
```

### Rate limit errors during development

```bash
# Reset your rate limit in Upstash console
# Or temporarily disable rate limiting by commenting out
# the checkRateLimit() call in src/app/api/query/route.ts
```

---

## Project Structure

```
lawbridge-gh/
├── src/
│   ├── app/
│   │   ├── (auth)/          # Login, signup pages
│   │   ├── (dashboard)/     # User dashboard, cases
│   │   ├── (public)/        # Query, lawyers, about
│   │   ├── admin/           # Admin dashboard
│   │   ├── api/             # All API routes
│   │   ├── layout.tsx       # Root layout with fonts
│   │   ├── page.tsx         # Landing page
│   │   └── globals.css      # Design tokens & utilities
│   ├── components/
│   │   ├── admin/           # Admin UI components
│   │   ├── auth/            # Login & signup forms
│   │   ├── lawyers/         # Lawyer search & booking
│   │   ├── layout/          # Navbar, footer, providers
│   │   ├── query/           # Core AI query interface
│   │   └── ui/              # shadcn/ui base components
│   ├── lib/
│   │   ├── db/              # Drizzle schema & client
│   │   ├── supabase/        # Server & browser clients
│   │   ├── email.ts         # Resend email helpers
│   │   ├── ml-client.ts     # ML microservice client
│   │   ├── paystack.ts      # Paystack helpers
│   │   ├── rate-limit.ts    # Upstash rate limiting
│   │   ├── translation.ts   # Khaya AI translation
│   │   └── utils.ts         # Shared utilities
│   └── middleware.ts        # Auth & route protection
├── ml-service/
│   ├── main.py              # FastAPI app entry point
│   ├── config.py            # Pydantic settings
│   ├── retrieval.py         # FAISS + Pinecone + reranker
│   ├── inference.py         # Stub (Claude) + Mistral engine
│   ├── safety.py            # Citation verifier + disclaimer
│   ├── indexer.py           # PDF chunking + embedding pipeline
│   └── requirements.txt
├── training/
│   ├── train.py             # QLoRA fine-tuning script
│   ├── generate_dataset.py  # Training data generation
│   └── evaluate.py          # Acceptance criteria evaluation
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Full DB schema + RLS
├── .github/workflows/
│   └── ci.yml               # CI/CD pipeline
├── Dockerfile               # ML microservice (Railway)
├── Dockerfile.nextjs        # Next.js (docker-compose only)
├── docker-compose.yml       # Local development stack
├── .env.example             # Environment variables template
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

*LawBridge GH — Making Ghana's legal knowledge accessible to every citizen.*

*Supporting SDG 1 (No Poverty) · SDG 10 (Reduced Inequalities) · SDG 16 (Peace, Justice & Strong Institutions)*
