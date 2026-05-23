# Deployment Guide

Stack: Next.js → Vercel | Express → GCP Cloud Run | MongoDB Atlas M0 | Upstash Redis

---

## Step 1 — MongoDB Atlas

1. Go to atlas.mongodb.com → New Project → Create Cluster → **M0 Free**
2. Region: closest to your GCP region (e.g. us-central1 → Iowa)
3. Database Access → Add user → password auth → note credentials
4. Network Access → Add IP → `0.0.0.0/0` (allow all — Cloud Run IPs are dynamic)
5. Connect → Drivers → copy connection string:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/vedaai?retryWrites=true&w=majority
   ```

---

## Step 2 — Upstash Redis

1. Go to upstash.com → Sign up (free) → Create Database
2. Region: match your GCP region
3. Copy **Redis URL** (format: `rediss://default:PASSWORD@HOST:PORT`)
4. This is your `REDIS_URL`

> BullMQ requires ioredis. Upstash's Redis URL works directly — no config changes needed.

---

## Step 3 — GCP Cloud Run (Backend)

### 3a — Enable APIs (one time)
```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
```

### 3b — Create Artifact Registry repo
```bash
gcloud artifacts repositories create vedaai \
  --repository-format=docker \
  --location=us-central1 \
  --description="VedaAI backend images"
```

### 3c — Build and push image
Run from **repo root** (not backend/):
```bash
gcloud builds submit . \
  --dockerfile=backend/Dockerfile \
  --tag=us-central1-docker.pkg.dev/YOUR_PROJECT_ID/vedaai/backend:latest
```
Replace `YOUR_PROJECT_ID` with your GCP project ID (`gcloud config get project`).

### 3d — Deploy to Cloud Run
```bash
gcloud run deploy vedaai-backend \
  --image=us-central1-docker.pkg.dev/YOUR_PROJECT_ID/vedaai/backend:latest \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --min-instances=1 \
  --port=8080 \
  --set-env-vars="NODE_ENV=production,\
PORT=8080,\
MONGODB_URI=mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/vedaai,\
REDIS_URL=rediss://default:PASS@HOST:PORT,\
GEMINI_API_KEY=YOUR_KEY,\
GEMINI_MODEL=gemini-2.5-flash,\
GEMINI_MODEL_MATH=gemini-2.5-pro,\
LLM_PRIMARY=gemini,\
LLM_FALLBACK=groq,\
GROQ_API_KEY=YOUR_KEY,\
GROQ_MODEL=llama-3.3-70b-versatile,\
CORS_ORIGIN=https://YOUR_APP.vercel.app,\
FRONTEND_URL=https://YOUR_APP.vercel.app,\
VEDA_API_KEY=,\
WORKER_CONCURRENCY=2,\
MAX_FILE_SIZE_MB=10"
```

> `--min-instances=1` keeps the BullMQ worker alive so queued jobs process without cold-start delay.

### 3e — Get backend URL
```bash
gcloud run services describe vedaai-backend --region=us-central1 --format='value(status.url)'
```
Looks like: `https://vedaai-backend-xxxxxxxxxx-uc.a.run.app`

---

## Step 4 — Vercel (Frontend)

1. vercel.com → Add New Project → Import from GitHub → select `VedaAI` repo
2. **Root Directory**: set to `frontend`
3. Framework Preset: Next.js (auto-detected)
4. Environment Variables — add:
   ```
   NEXT_PUBLIC_API_URL=https://vedaai-backend-xxxxxxxxxx-uc.a.run.app/api/v1
   NEXT_PUBLIC_SOCKET_URL=https://vedaai-backend-xxxxxxxxxx-uc.a.run.app
   NEXT_PUBLIC_API_KEY=
   ```
5. Deploy

---

## Step 5 — Update CORS on backend

Once Vercel gives you the URL (e.g. `https://vedaai.vercel.app`):
```bash
gcloud run services update vedaai-backend \
  --region=us-central1 \
  --update-env-vars="CORS_ORIGIN=https://vedaai.vercel.app,FRONTEND_URL=https://vedaai.vercel.app"
```

---

## Redeploy after code changes

```bash
# From repo root
gcloud builds submit . \
  --dockerfile=backend/Dockerfile \
  --tag=us-central1-docker.pkg.dev/YOUR_PROJECT_ID/vedaai/backend:latest

gcloud run deploy vedaai-backend \
  --image=us-central1-docker.pkg.dev/YOUR_PROJECT_ID/vedaai/backend:latest \
  --region=us-central1
```

Frontend redeploys automatically on every push to main via Vercel GitHub integration.

---

## Smoke Test

```bash
# Health check
curl https://vedaai-backend-xxxxxxxxxx-uc.a.run.app/api/v1/health

# Expected: {"status":"ok","mongo":"connected","redis":"connected"}
```

---

## Costs (estimated)

| Service | Free tier | After free |
|---|---|---|
| Cloud Run | 2M req/month free | ~$0.40/1M req |
| Artifact Registry | 0.5GB free | $0.10/GB |
| MongoDB Atlas M0 | Free forever (512MB) | Upgrade to M10 = $57/mo |
| Upstash Redis | 10K cmds/day free | $0.20/100K cmds |
| Vercel | Free (hobby) | $20/mo pro |

> Total for demo/portfolio: **$0** unless you exceed free tiers.

---

## Notes

- `VEDA_API_KEY` left blank = open API (fine for demo). Set a value to lock it.
- Cloud Run WebSocket support is native — Socket.io works without extra config.
- Puppeteer uses system Chromium installed in the Docker image (`/usr/bin/chromium`).
- BullMQ jobs survive restarts via Redis persistence — if Cloud Run restarts, jobs re-process.
