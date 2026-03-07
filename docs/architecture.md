# Architecture

> High-level system overview, key modules, data flow, design decisions, and folder structure.
> Updated by the development agent whenever architecture changes.

## System Overview

MailTrack is a universal package tracking dashboard built as a monorepo with three apps (API, Web, Mobile) and two shared packages (shared types, UI components).

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Web (Next.js) │     │  Mobile (Expo)   │     │  iOS Shortcuts  │
│   Vercel CDN    │     │  React Native    │     │  SMS Webhook    │
└────────┬────────┘     └────────┬─────────┘     └────────┬────────┘
         │                       │                         │
         └───────────┬───────────┘                         │
                     │ REST API                            │
                     ▼                                     ▼
         ┌───────────────────────────────────────────────────┐
         │              API Server (Fastify)                 │
         │                                                   │
         │  ┌──────────┐  ┌───────────┐  ┌───────────────┐  │
         │  │   Auth    │  │  Tracking │  │  Email Parser │  │
         │  │  Service  │  │  Service  │  │   Service     │  │
         │  └──────────┘  └───────────┘  └───────────────┘  │
         │  ┌──────────┐  ┌───────────┐  ┌───────────────┐  │
         │  │  Gmail   │  │  Places   │  │ Notification  │  │
         │  │ Service  │  │  Service  │  │   Service     │  │
         │  └──────────┘  └───────────┘  └───────────────┘  │
         └──────────┬────────────┬───────────────┬──────────┘
                    │            │               │
              ┌─────▼─────┐ ┌───▼────┐   ┌──────▼──────┐
              │ PostgreSQL │ │ Redis  │   │  External   │
              │  (Prisma)  │ │ Cache  │   │   APIs      │
              └────────────┘ └────────┘   └─────────────┘
                                                │
                              ┌─────────────────┼──────────────┐
                              │                 │              │
                        ┌─────▼─────┐   ┌───────▼───┐  ┌──────▼──────┐
                        │  17track   │   │  Cainiao  │  │   Google    │
                        │ (Scraper)  │   │   API     │  │  APIs       │
                        └────────────┘   └───────────┘  └─────────────┘
```

## Key Modules

### API (`apps/api`)

| Module | File | Purpose |
|--------|------|---------|
| Auth | `routes/auth.routes.ts` | Google/Apple OAuth, JWT management, dev login |
| Packages | `routes/packages.routes.ts` | Package CRUD, sync, search, manual add |
| Orders | `routes/orders.routes.ts` | Order detail, delete |
| Email | `routes/email.routes.ts` | Gmail connection, email sync |
| Dashboard | `routes/dashboard.routes.ts` | Stats aggregation |
| Ingest | `routes/ingest.routes.ts` | SMS webhook for iOS Shortcuts |
| Notifications | `routes/notifications.routes.ts` | Push notifications, preferences |
| Settings | `routes/settings.routes.ts` | User settings management |
| Tracking (Cainiao) | `services/tracking.service.ts` | Primary tracking via Cainiao public API |
| Tracking (17track) | `services/tracking17.service.ts` | Secondary tracking via Playwright scraper |
| Tracking (Israel Post) | `services/israelpost.service.ts` | Direct Israel Post API tracking |
| Gmail | `services/gmail.service.ts` | Gmail API integration |
| Email Parser | `services/email-parser.service.ts` | Extract orders/tracking from email HTML |
| Places | `services/places.service.ts` | Google Places API for pickup locations |
| Notifications | `services/notification.service.ts` | Web Push + in-app notifications |
| Package Sync | `services/package-sync.service.ts` | Sync tracking results to DB: status, events, notifications |
| Carrier Detection | `lib/carrier-detect.ts` | Regex-based carrier identification |

### Web (`apps/web`)

| Page | Route | Purpose |
|------|-------|---------|
| Landing | `/` | Redirects to `/packages` |
| Login | `/login` | OAuth login (Google/Apple) |
| Auth Callback | `/auth/callback` | OAuth redirect — routes new users to onboarding |
| Packages | `/packages` | Package list (table/kanban/timeline views) with search/filter |
| Order Detail | `/orders/[id]` | Full order + tracking timeline + location map |
| Settings | `/settings` | Preferences, connections, sign out, account |
| Onboarding | `/onboarding` | First-time wizard: welcome → Gmail → sync → feature tour |
| Notifications | `/notifications` | Full notification history |

**Key UI Components:**
| Component | File | Purpose |
|-----------|------|---------|
| LogoSpinner | `components/ui/logo-spinner.tsx` | Animated logo (3D Y-axis rotation), used as loading indicator everywhere |
| KanbanBoard | `components/packages/package-kanban.tsx` | Trello-style kanban with unified page scroll |
| NotificationBell | `components/notifications/notification-bell.tsx` | Floating dropdown notification widget |
| Sidebar | `components/layout/sidebar.tsx` | App navigation with logo, theme toggle, sign out |
| Skeletons | `components/ui/skeleton.tsx` | View-specific loading skeletons (table/kanban/timeline) |

### Shared (`packages/shared`)

- `constants.ts` — Carrier regex patterns (`CARRIER_PATTERNS`), status mappings
- `enums.ts` — `Carrier`, `PackageStatus`, `AuthProvider`, `EmailProvider`, `ShopPlatform`
- `schemas.ts` — Zod validation schemas for API requests/responses
- `types.ts` — TypeScript types inferred from Zod schemas

## Data Flow

### Package Tracking Flow

```
1. User triggers sync (manual or background)
         │
2. Fetch all user's packages from DB
         │
3. For each batch (5 at a time):
   ├── Try 17track batch scraper (Playwright)
   │     └── Intercept REST API responses from t.17track.net
   └── Fallback: Cainiao direct API per package
         │
4. For each tracking result:
   ├── Detect carrier from 17track provider info (overrides regex)
   ├── Map external status → PackageStatus enum
   ├── Extract location (clean up non-place data)
   ├── Upsert tracking events (dedup by timestamp+description)
   └── Update package: status, lastLocation, estimatedDelivery
         │
5. Post-sync:
   ├── Enrich pickup locations via Google Places API
   ├── Send push notifications for status changes
   └── Clean up sync job after 5 minutes
```

### Email Sync Flow

```
1. User has connected Gmail (OAuth tokens encrypted in DB)
         │
2. Fetch emails matching shipping keywords (max 500)
         │
3. Parse each email:
   ├── Try AliExpress template matching
   ├── Try known merchant pattern matching
   └── Fallback: HTML parsing + regex extraction
         │
4. Extract: tracking numbers, order IDs, merchant, price, status
         │
5. Upsert orders + packages (dedup by externalOrderId)
         │
6. Trigger tracking for new packages
```

### Auth Flow

```
1. Client redirects to /api/auth/google
2. Google OAuth consent screen
3. Callback with authorization code
4. Exchange code → ID token → verify
5. Find or create user in DB
6. Generate JWT access token (1h) + refresh token (30d)
7. Set refresh token as httpOnly cookie
8. Redirect to /auth/callback?token=<access_token>
9. Client stores access token in memory
10. Check user.onboardingCompleted:
    - false → redirect to /onboarding (first-time wizard)
    - true  → redirect to /packages
```

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Fastify over Express** | Better TypeScript support, schema validation, faster performance |
| **17track as primary tracker** | Supports 2000+ carriers vs Cainiao's limited coverage |
| **Playwright scraping** | 17track has no public API; browser automation intercepts their REST calls |
| **Cainiao as fallback** | Free, no auth required, good for AliExpress packages |
| **AES-256 token encryption** | Gmail OAuth tokens contain sensitive data; encrypted at rest |
| **Carrier regex + 17track correction** | Regex is fast but imprecise for digit-only patterns; 17track provides accurate last-mile carrier |
| **Removed digit-only carrier patterns** | CANADA_POST, TNT, GLS, ARAMEX regexes were too broad, misdetecting AliExpress order IDs |
| **Israel Post direct API first** | Israeli packages try Israel Post API before 17track — faster, more accurate locations |
| **Status reconciliation after sync** | Carriers sometimes report stale overall status; check events for DELIVERED and upgrade |
| **Onboarding wizard with `onboardingCompleted` flag** | Cleanly separates first-time vs returning users; auth callback checks flag |
| **No per-column scrolling in kanban** | User explicitly rejected it; Trello-style unified page scroll only |
| **Simplified favicon for small sizes** | Full logo is unreadable at 16/32px; bold geometric pin shape used instead |
| **LogoSpinner replaces all loading spinners** | Consistent branding; 3D Y-axis rotation animation |
| **Background sync with polling** | Sync can take minutes; non-blocking with status polling is better UX |
| **Sonner for toasts** | Lightweight, good API, supports actions and rich content |
| **TanStack Query for data** | Automatic caching, refetching, optimistic updates |

## Database Schema Overview

See `apps/api/prisma/schema.prisma` for full schema.

**Core entities**: User → ConnectedEmail, ConnectedShop, Order → Package → TrackingEvent

**Key relationships**:
- User has many Orders, ConnectedEmails, ConnectedShops
- Order has many Packages
- Package has many TrackingEvents
- Cascade deletes from User down

**Indexes**: userId, trackingNumber, status, createdAt for query performance.

## Deployment

| Component | Platform | Config |
|-----------|----------|--------|
| Web (Next.js) | Vercel | `vercel.json` |
| API (Fastify) | Railway | `railway.toml` + `Dockerfile.api` |
| PostgreSQL | Railway (managed) | `DATABASE_URL` env var |
| Redis | Railway (managed) | `REDIS_URL` env var |

## External APIs

| API | Usage | Auth | Rate Limits |
|-----|-------|------|-------------|
| Google OAuth | Login | Client ID + Secret | Standard |
| Gmail API | Email sync | OAuth 2.0 token | 500 emails/sync |
| Google Places | Pickup enrichment | API Key | Pay-per-use, cache results |
| Cainiao | Package tracking | None (public) | 2 min cooldown per tracking # |
| 17track | Universal tracking | None (scraping) | ~40 packages/batch |
| Web Push | Notifications | VAPID keys | No hard limit |
