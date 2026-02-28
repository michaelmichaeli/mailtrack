# 📦 MailTrack — Every Package, One Dashboard

> Universal package tracking aggregator that auto-syncs with your email, supports 30+ carriers, and gives you real-time delivery updates.

A cross-platform app (web + mobile) that connects to your Gmail/Outlook, parses order-confirmation and shipping emails, enriches with carrier APIs, and displays a unified dashboard of all packages with real-time status, location, and ETA.

## Architecture

```
Mobile (Expo/RN)  ←→  API Gateway (Fastify)  ←→  PostgreSQL
Web (Next.js)     ←→       ↕                      Redis (cache/queue)
                       Background Workers          ↕
                       (BullMQ)              Email APIs (Gmail/Outlook)
                           ↕                 Carrier APIs (17track)
                       Push Service           Shop APIs (Amazon, Ali)
                       (FCM + APNs)
```

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo |
| Web | Next.js 14 (App Router), Tailwind CSS, shadcn/ui |
| Mobile | Expo (SDK 51+), React Native, NativeWind |
| Backend | Fastify, Node.js 20+ |
| Database | PostgreSQL, Prisma ORM |
| Cache/Queue | Redis, BullMQ |
| Auth | Google OAuth 2.0, Apple Sign-In, JWT |
| Email APIs | Gmail API, Microsoft Graph API |
| Carrier Tracking | 17track API / Ship24 API |
| Push Notifications | FCM + APNs via expo-notifications |

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL
- Redis

### Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp apps/api/.env.example apps/api/.env

# Generate Prisma client
npm run db:generate

# Push database schema
npm run db:push

# Start development
npm run dev
```

## Deployment

### Option 1: Railway (Recommended)

The easiest way to deploy — Railway supports monorepos, Postgres, and Redis as add-ons.

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Create a Railway project** at [railway.app](https://railway.app)
   - Click **"New Project"** → **"Deploy from GitHub Repo"**
   - Select the `michaelmichaeli/mailtrack` repository

3. **Add databases** (click "+ New" in the project)
   - Add **PostgreSQL** — Railway provides a managed instance
   - Add **Redis** — Railway provides a managed instance

4. **Deploy the API service**
   - Click "+ New" → "GitHub Repo" → select this repo
   - Settings:
     - **Root Directory**: `/` (root)
     - **Builder**: Dockerfile
     - **Dockerfile Path**: `Dockerfile`
     - **Target**: `api`
   - Add environment variables (Settings → Variables):
     ```
     DATABASE_URL        → copy from Railway Postgres service
     REDIS_URL           → copy from Railway Redis service
     JWT_SECRET          → generate: openssl rand -hex 32
     JWT_REFRESH_SECRET  → generate: openssl rand -hex 32
     ENCRYPTION_KEY      → generate: openssl rand -hex 16
     PORT                → 3001
     HOST                → 0.0.0.0
     NODE_ENV            → production
     GOOGLE_CLIENT_ID    → from Google Cloud Console
     GOOGLE_CLIENT_SECRET → from Google Cloud Console
     WEB_URL             → https://your-web-service.up.railway.app
     API_URL             → https://your-api-service.up.railway.app
     ```
   - Generate a **domain** in Settings → Networking

5. **Deploy the Web service**
   - Click "+ New" → "GitHub Repo" → select this repo again
   - Settings:
     - **Root Directory**: `/` (root)
     - **Builder**: Dockerfile
     - **Dockerfile Path**: `Dockerfile`
     - **Target**: `web`
     - **Build Args**: `NEXT_PUBLIC_API_URL=https://your-api-domain.up.railway.app/api`
   - Variables:
     ```
     PORT → 3000
     NODE_ENV → production
     ```
   - Generate a **domain** in Settings → Networking

6. **Update Google OAuth** redirect URIs in [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   - Add `https://your-api-domain.up.railway.app/api/auth/google/callback`

### Option 2: Docker Compose (Self-hosted VPS)

Deploy on any VPS (DigitalOcean, Hetzner, AWS EC2, etc.):

```bash
# Clone the repo
git clone https://github.com/michaelmichaeli/mailtrack.git
cd mailtrack

# Create production env file
cp .env.production.example .env
# Edit .env with your values (secrets, domains, Google OAuth)

# Build and start
docker compose up -d --build

# The app will be available at:
# - API: http://your-server:3001
# - Web: http://your-server:3000
```

For HTTPS, put Nginx or Caddy in front:
```bash
# Example with Caddy (auto-HTTPS)
caddy reverse-proxy --from yourdomain.com --to localhost:3000
```

### Option 3: Vercel (Web) + Railway (API)

For the best Next.js performance, deploy the web app on Vercel:

1. Import `michaelmichaeli/mailtrack` on [vercel.com](https://vercel.com)
   - **Root Directory**: `apps/web`
   - **Framework**: Next.js
   - **Environment Variable**: `NEXT_PUBLIC_API_URL=https://your-api.up.railway.app/api`

2. Deploy the API + databases on Railway (follow Option 1, steps 3-4)

### Environment Variables Reference

See [`.env.production.example`](.env.production.example) for all required variables.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `JWT_SECRET` | ✅ | JWT signing secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | ✅ | Refresh token secret |
| `ENCRYPTION_KEY` | ✅ | AES encryption key for OAuth tokens |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth client secret |
| `WEB_URL` | ✅ | Public URL of the web app |
| `API_URL` | ✅ | Public URL of the API |
| `NEXT_PUBLIC_API_URL` | ✅ | API URL for the browser (build-time) |
| `VAPID_*` | Optional | Web Push notification keys |

## Project Structure

```
mailtrack/
├── apps/
│   ├── web/          # Next.js web dashboard
│   ├── api/          # Fastify backend
│   └── mobile/       # Expo/React Native app
├── packages/
│   ├── shared/       # Shared types, schemas, constants
│   └── ui/           # Shared UI components
├── Dockerfile        # Multi-stage build (api + web targets)
├── docker-compose.yml
├── turbo.json
└── package.json
```

## License

MIT
