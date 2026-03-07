# Agent Instructions

> **⚠️ STOP — READ THIS ENTIRE FILE BEFORE DOING ANYTHING ⚠️**
> This file is the first thing any AI agent MUST read before making changes to this codebase.
> It contains mandatory procedures, user preferences, coding standards, and architecture rules.

---

## 🚨 MANDATORY: Before Starting ANY Work

**You MUST complete these steps at the start of every session, before touching any code:**

1. ✅ Read this file completely (`AGENT_INSTRUCTIONS.md`)
2. ✅ Read `docs/agent-memory.md` — current state, completed tasks, user preferences, known issues
3. ✅ Read `docs/dev-log.md` — recent changes and their details
4. ✅ Read `docs/architecture.md` — system overview and design decisions
5. ✅ Check for any in-progress tasks in `agent-memory.md` and continue from where the last session left off

**Do NOT skip these steps.** They contain critical context that prevents you from repeating mistakes, breaking existing features, or ignoring user preferences.

---

## 🚨 MANDATORY: After Every Significant Change

**After completing any feature, fix, or modification, you MUST:**

1. ✅ Update `docs/dev-log.md` — add an entry describing what changed, which files, and why
2. ✅ Update `docs/agent-memory.md` — update tasks completed, tasks in progress, known issues
3. ✅ Update `docs/architecture.md` — if architecture, data flow, or key modules changed
4. ✅ Evaluate: should this feature be added to the onboarding wizard? (see User Preferences below)
5. ✅ Do NOT push to git without explicit user approval for large changes

**This is not optional.** The user relies on these docs for continuity across sessions.

---

## 👤 User Preferences (Standing Instructions)

These are permanent instructions from the user. Follow them in EVERY session:

| Rule | Details |
|------|---------|
| **Don't push without approval** | For large features, show the user first. Small bug fixes can be pushed. |
| **Step-by-step approval** | Complete one task at a time. Summarize what was done. Wait for approval before the next task. |
| **No batch changes** | Don't chain multiple unrelated tasks without review. |
| **Update docs after every change** | `agent-memory.md`, `dev-log.md`, `architecture.md` — every time, no exceptions. |
| **Add features to onboarding wizard** | When adding a new user-facing feature, add it to the `FEATURES` array in `apps/web/src/app/onboarding/page.tsx` |
| **Verify changes visually** | Don't ask the user for screenshots. Use Playwright to open pages in a real browser, take screenshots, and verify UI changes yourself. See "Visual Verification Protocol" below. |
| **Hebrew/RTL awareness** | User is Israel-based. Hebrew text appears in tracking locations. Ensure UI handles `dir="auto"`. |
| **Kanban style** | User wants Trello/Jira-style board — unified page scroll, NO per-column scrolling. Never revert this. |
| **Dev servers** | API: port 3002, Web: port 3003. Dev login: `POST /api/auth/dev-login` with `{"email":"michaelmichaeli888@gmail.com"}` |
| **Record ALL instructions** | Any new preference or instruction from the user must be added to this table and to `docs/agent-memory.md`. |

---

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

## Workflow Rules

1. **Step-by-step approval**: Complete one task at a time. After each task, provide a summary of what was done and wait for user approval before proceeding to the next step.
2. **No batch changes**: Do not chain multiple tasks together without review.
3. **Summary format**: After each task, provide a clear summary including: what changed, which files were modified, and what the next step would be.

## Self-Recovery Protocol

If you lose context or are starting a new session:

1. **READ `AGENT_INSTRUCTIONS.md` FIRST** — especially the MANDATORY sections at the top
2. Read `docs/agent-memory.md` for current state, user preferences, and known issues
3. Read `docs/dev-log.md` for recent changes
4. Read `docs/architecture.md` for system overview
5. Check for in-progress tasks and continue from where the last session left off
6. **Before writing any code**, confirm you've read all of the above

**After completing work:**
1. Update `docs/dev-log.md` with what changed
2. Update `docs/agent-memory.md` with completed tasks, new issues, new preferences
3. Update `docs/architecture.md` if architecture changed
4. Check if any new feature should be added to the onboarding wizard

---

## 🚨 Visual Verification Protocol (HARD RULE)

**You MUST visually verify UI changes using Playwright.** Do NOT rely on `curl` for HTML output or ask the user for screenshots.

### How to Verify

```bash
# Install Playwright if not available
npx playwright install chromium

# Use a Playwright script to screenshot pages
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3003/packages');
  await page.screenshot({ path: '/tmp/verify.png', fullPage: true });
  await browser.close();
  console.log('Screenshot saved to /tmp/verify.png');
})();
"
```

### When to Use
- After ANY UI/frontend change (skeletons, layouts, styling, new components)
- After fixing CSS or visual bugs
- Before telling the user a UI task is "done"

### What to Check
- Page loads without errors (no Server Error screens)
- Layout looks correct (no broken elements)
- New components render properly
- Loading states and skeletons appear correctly

### View Screenshots
Use the `view` tool to inspect saved screenshot images (they render as base64).

---

## 🚨 Next.js Cache Recovery

Next.js 14's `.next` cache frequently corrupts when source files change during dev server runtime, causing "Cannot find module './XXX.js'" errors.

### Prevention
- After editing frontend files, restart the dev server: `kill <PID> && cd apps/web && npx next dev --port 3003`
- If errors persist, delete the cache: `rm -rf apps/web/.next`

### Recovery
```bash
# 1. Kill dev server
lsof -i :3003 -t | xargs kill 2>/dev/null

# 2. Delete stale cache
rm -rf apps/web/.next

# 3. Clean rebuild
npx turbo build --filter=@mailtrack/web --force

# 4. Restart dev
cd apps/web && npx next dev --port 3003
```

**This is a known Next.js 14 issue.** Always suspect stale cache when you see module-not-found errors at runtime.
