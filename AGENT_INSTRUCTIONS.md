# Agent Instructions

> This file is the first thing any AI agent should read before making changes to this codebase.
> It contains coding standards, project rules, architecture principles, and important constraints.

## Project Overview

**MailTrack** is a universal package tracking dashboard that aggregates shipping data from emails, SMS, and manual input. It supports 2000+ carriers worldwide via 17track and Cainiao integrations.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo + npm workspaces |
| API | Fastify 5 (TypeScript) |
| Web | Next.js 14 (App Router, React 18) |
| Mobile | Expo 52 + React Native 0.76 |
| Database | PostgreSQL + Prisma 6 ORM |
| Cache | Redis (ioredis) |
| Auth | Google/Apple OAuth → JWT |
| UI | TailwindCSS 4, Radix UI, Lucide icons |
| State | TanStack React Query 5 |
| Validation | Zod 3.23 |
| Notifications | Web Push (VAPID), Sonner toasts |
| Scraping | Playwright (17track) |
| Testing | Vitest |

## Workspace Structure

```
mailtrack/
├── apps/
│   ├── api/          # Fastify backend (port 3002)
│   ├── web/          # Next.js frontend (port 3003)
│   └── mobile/       # Expo React Native app
├── packages/
│   ├── shared/       # Shared types, enums, schemas (Zod)
│   └── ui/           # Shared UI components
├── docs/             # Project documentation (architecture, memory, logs)
└── AGENT_INSTRUCTIONS.md  # This file
```

## Coding Standards

### TypeScript
- Strict mode enabled across all packages.
- Use `type` imports where possible (`import type { X } from '...'`).
- No `any` — use `unknown` and narrow with type guards or Zod.
- Prefer `const` over `let`. Never use `var`.

### Naming Conventions
- **Files**: `kebab-case.ts` (e.g., `carrier-detect.ts`, `email-parser.service.ts`)
- **Components**: `PascalCase.tsx` (e.g., `NotificationBell.tsx`) or `kebab-case.tsx` in Next.js app router
- **Functions**: `camelCase` (e.g., `detectCarrier`, `syncPackageFromResult`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `CARRIER_PATTERNS`, `STATUS_MAP`)
- **Enums**: `PascalCase` members (e.g., `Carrier.ISRAEL_POST`, `PackageStatus.IN_TRANSIT`)

### API Routes
- Route files follow `*.routes.ts` naming pattern.
- Each route file exports a Fastify plugin function.
- Use Zod schemas from `@mailtrack/shared` for request/response validation.
- All protected routes use the `authenticate` preHandler.

### Database
- Prisma schema is the source of truth for the data model.
- Always use Prisma client for DB operations (no raw SQL in production code).
- Cascade deletes are configured at the schema level.
- Use `upsert` for idempotent operations (tracking events, orders).

### Frontend
- Use TanStack React Query for all API data fetching.
- Prefer server components in Next.js where possible.
- Use Tailwind utility classes; avoid custom CSS unless absolutely necessary.
- Use Radix UI primitives for accessible interactive components.
- Use Sonner for toast notifications.

### Error Handling
- API routes should catch errors and return appropriate HTTP status codes.
- Use `reply.code(xxx).send({ error: '...' })` pattern.
- Log errors server-side; never expose internal details to clients.

### Security
- Never commit secrets or API keys — use environment variables.
- Encrypt sensitive tokens (Gmail OAuth) with AES-256 before storing in DB.
- JWT access tokens expire in 1 hour; refresh tokens in 30 days.
- CORS is configured per environment.

## Architecture Principles

1. **Shared package is the contract** — all types, enums, and schemas live in `@mailtrack/shared`. Both API and web import from it.
2. **Carrier detection is layered** — regex first (fast), then 17track provider info (accurate). Never trust regex alone for digit-only patterns.
3. **Tracking data is idempotent** — events are deduped by `(packageId, timestamp, description)`. Multiple syncs produce the same result.
4. **Email parsing is best-effort** — not all emails match templates. Gracefully degrade from template → pattern → raw extraction.
5. **Background sync is non-blocking** — `sync-all` returns immediately, client polls `sync-status`.

## Important Constraints

- **17track scraping** requires Playwright/Chromium. It's optional — the system falls back to Cainiao.
- **Gmail tokens** are AES-256 encrypted in DB. The `ENCRYPTION_KEY` env var must be exactly 32 hex chars (16 bytes).
- **Rate limiting**: Cainiao tracking has a 2-minute cooldown per tracking number.
- **Google Places API** is pay-per-use. Cache results aggressively.
- **Prisma** does not support hot-reload well — restart the API after schema changes.

## Build & Run

```bash
# Install dependencies
npm install

# Start all apps in dev mode
npm run dev

# Build everything
npm run build

# Build specific package
npx turbo build --filter=@mailtrack/shared
npx turbo build --filter=@mailtrack/api
npx turbo build --filter=@mailtrack/web

# Database
npm run db:generate    # Generate Prisma client
npm run db:push        # Push schema to DB
npm run db:studio      # Open Prisma Studio

# Tests
npx vitest run apps/api/src/__tests__/carrier-detect.test.ts

# Docker (local Postgres + Redis)
docker-compose up -d
```

## Self-Recovery Protocol

If you lose context or are starting a new session:

1. Read this file (`AGENT_INSTRUCTIONS.md`)
2. Read `docs/architecture.md` for system overview
3. Read `docs/agent-memory.md` for current state
4. Read `docs/dev-log.md` for recent changes
5. Reconstruct the project state from these files
6. Continue from the latest incomplete task
