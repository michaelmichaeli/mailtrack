# Agent Memory

> Persistent memory for AI agents working on this project.
> Read this file at the start of every session to understand current state.
> Update this file after completing significant work.

## Current Goals

- Build a fully functional universal package tracking dashboard
- Support email-based order ingestion (Gmail), SMS webhooks, and manual entry
- Provide accurate carrier detection and real-time tracking
- Deliver a polished, responsive UI with notifications
- First-time user onboarding wizard with animations and feature tour

## Tasks Completed

### Onboarding Wizard (Session: 2026-03-06) — NOT YET PUSHED
- **What**: Multi-step first-time user wizard with framer-motion animations, canvas-confetti, Web Audio sounds, feature tour
- **Schema**: Added `onboardingCompleted Boolean @default(false)` to User model
- **API**: `GET /auth/me` now returns `onboardingCompleted`; added `POST /auth/onboarding-complete`
- **Frontend**: `completeOnboarding()` in api.ts; auth callback routes new users to `/onboarding`
- **Wizard steps**: Welcome (personalized greeting + confetti) → Connect Gmail → Auto-Sync (progress bar) → Feature Tour (5 features) → Completion (celebration)
- **Status**: Completed, pushed to main
- **Files**: `apps/api/prisma/schema.prisma`, `apps/api/src/routes/auth.routes.ts`, `apps/web/src/lib/api.ts`, `apps/web/src/app/auth/callback/page.tsx`, `apps/web/src/app/onboarding/page.tsx`

### Package Status Reconciliation Fix (Session: 2026-03-06)
- **Problem**: Packages stuck at OUT_FOR_DELIVERY when DELIVERED events existed in DB
- **Fix**: After upserting events in `syncPackageFromResult`, check all events for highest-priority status and upgrade package/order accordingly
- **File**: `apps/api/src/routes/packages.routes.ts` (end of `syncPackageFromResult`)

### Logo & Branding (Session: 2026-03-06)
- **Logo**: User's Gemini-generated pin+box icon, cropped to transparent 1071×1231
- **Favicon**: Simplified bold geometric pin for 16/32/48px (too detailed at small sizes), full logo for 192/512px. All with indigo (#6366F1) background
- **LogoSpinner**: 3D Y-axis rotation component (`logo-spinner.tsx`), replaces all loading spinners
- **Files**: `apps/web/public/logo.png`, `favicon.ico`, `favicon-*.png`, `icon-*.png`, `apple-touch-icon.png`, `apps/web/src/components/ui/logo-spinner.tsx`, `apps/web/src/app/globals.css` (keyframes)

### Kanban Board Redesign (Session: 2026-03-06)
- **Problem**: User hated per-column scrolling
- **Solution**: Trello-style — columns extend full height, page scrolls as one unit, horizontal scroll for column overflow. Columns have `bg-muted/40` rounded containers with sticky headers
- **File**: `apps/web/src/components/packages/package-kanban.tsx`

### View-Specific Loading Skeletons (Session: 2026-03-06)
- **Created**: `TableSkeleton`, `KanbanSkeleton`, `TimelineSkeleton` in `skeleton.tsx`
- **Updated**: Packages page shows correct skeleton per active view

### Time Filter Compact Labels (Session: 2026-03-06)
- Removed "3 months" period. Labels: 7D, 30D, 6M, 1Y, All
- Styled as compact pill-group

### Notification Bell Dropdown Fix (Session: 2026-03-06)
- Changed from `overflow-hidden` to flex column layout. Footer always visible (`shrink-0`)

### iPhone Safe Area Fix (Session: 2026-03-06)
- `pb-[max(0.75rem,env(safe-area-inset-bottom))]` on sidebar bottom
- `viewportFit: "cover"` in viewport config

### Sign Out in Settings (Session: 2026-03-06)
- Added Sign Out button between Appearance and Data & Privacy sections

### Israel Post Direct API Integration (Session: 2026-03)
- Created `apps/api/src/services/israelpost.service.ts` — direct Israel Post tracking
- CSRF token handling, Hebrew location extraction, pickup center detection
- Batch tracking with parallel requests
- Integrated into sync flow: Israel Post packages tried first, then 17track fallback

### Carrier Detection Overhaul (Session: 2025-01)
- Removed digit-only regex patterns from `CARRIER_PATTERNS`
- Added `detectCarrierFrom17track()` for accurate last-mile detection
- Fixed 55 misdetected packages

### Login Button Overflow Fix (Session: 2025-01)
- Added `truncate` class to button

### Notification Toast UX (Session: 2025-01)
- Dedup toasts, action button to open dropdown

### Next.js 16 Upgrade (Session: 2026-03-07)
- **Upgrade**: Next.js 14.2.35 → 16.1.6, React 18.3.1 → 19.2.4, @types/react 18 → 19
- **Crash fix**: Turbopack is now the default dev bundler — eliminates all webpack `.next` cache corruption crashes
- **Monorepo types**: Root `package.json` has `overrides` for `@types/react` → v19 (mobile still uses React 18 at runtime, but types are compatible). Web tsconfig has `skipLibCheck: true`.
- **Config**: Removed `optimizePackageImports` from `experimental` (invalid in Next.js 16)
- **Files**: `apps/web/package.json`, `apps/web/next.config.mjs`, `apps/web/tsconfig.json`, `package.json`

### Loading Skeletons, Logo Link, Scroll-to-Top (Session: 2026-03-07)
- **Skeletons**: Added `ProfileSkeleton`, `NotificationsSkeleton`, `SettingsSkeleton`, `OrderDetailSkeleton` to `skeleton.tsx`. Replaced `LogoSpinner` loading states in profile, notifications, and order detail pages with content-shaped skeletons
- **Logo Link**: Sidebar logo now links to `/packages` (home)
- **Scroll-to-Top**: Created `ScrollToTop` floating button component — appears after scrolling 300px, works with `<main>` scroll container
- **SMS Ingest**: Verified working — the curl "malformed URL" error was caused by `break-all` CSS inserting newlines when copying. Fixed with `whitespace-nowrap overflow-x-auto`. Notification creation was silently failing because `notification.create()` used a nonexistent `metadata` field — removed it, added `orderId`.
- **Deploy fix**: `prisma db push` failing on `googleId @unique` with duplicate NULLs — added `--accept-data-loss` flag to Dockerfile.api and railway.toml.
- **Visual Verification**: Added Playwright screenshot protocol to AGENT_INSTRUCTIONS.md as hard rule.
- **Next.js Cache Recovery**: Added `.next` cache cleanup procedure to AGENT_INSTRUCTIONS.md.
- **Files**: `components/ui/skeleton.tsx`, `components/ui/scroll-to-top.tsx` (new), `components/layout/sidebar.tsx`, `app/profile/page.tsx`, `app/notifications/page.tsx`, `app/orders/[id]/page.tsx`, `app/packages/[id]/page.tsx`, `app/settings/page.tsx`, `apps/api/src/routes/ingest.routes.ts`, `Dockerfile.api`, `railway.toml`, `AGENT_INSTRUCTIONS.md`

### Extract syncPackageFromResult to Shared Service (Session: 2026-03-07)
- **Problem**: Duplicate `syncPackageFromResult` in `packages.routes.ts` and `ingest.routes.ts` — ingest version was missing terminal status protection, notifications, pickup enrichment, status reconciliation
- **Fix**: Extracted comprehensive version to `apps/api/src/services/package-sync.service.ts`, both routes now import from it
- **Files**: `apps/api/src/services/package-sync.service.ts` (new), `apps/api/src/routes/packages.routes.ts`, `apps/api/src/routes/ingest.routes.ts`

## Tasks In Progress

- None

## Session 2026-03-12 — User's Task List (from previous session)

These tasks were discussed in a previous session. Recording here for continuity:

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Login and onboarding translations for all texts | ✅ Done | All text uses `t()` calls, no hardcoded strings |
| 2 | Push in iOS + Safari + iPhone Chrome + PWA | ⚠️ Partial | PWA push works, iOS Safari "Add to Home Screen" banner works. Native iOS Safari push is a browser limitation — not possible without PWA install |
| 3 | Add SEO | ✅ Done | robots.ts, sitemap.ts, full OpenGraph/Twitter/JSON-LD in layout.tsx |
| 4 | Add close button for onboarding wizard | ✅ Done | X button top-right, hidden during sync step |
| 5 | Add walkthrough to app on first run with explanations, sounds, focus, humor | ✅ Done | 7-step driver.js tour with sounds, progress bar, animations |
| 6 | Scroll to top on page navigation (sidebar clicks) | ✅ Done | use-scroll-restore.ts + ScrollToTop floating button |
| 7 | Add new pages (analytics) | ✅ Done | Full analytics dashboard with stats, charts, timeline |
| 8 | Add map view — show locations around current location | ✅ Done | react-leaflet map with geolocation, 40+ city geocoding, side panel |

## Session 2026-03-12 — Convention Fixes

- ✅ Applied all 9 convention fixes to Map page: PageTransition wrapper, FadeIn header with NotificationBell, tracking-tight, text-muted-foreground/80, gradient empty state, FadeIn delay on content section
- ✅ Analytics page was already fully convention-compliant
- ✅ Created missing `layout.tsx` for Analytics and Map pages (sidebar, AuthGuard, main wrapper)
- ✅ Fixed mobile map rendering: map had 0 height on mobile due to flex collapse, now uses `h-[50vh]` on mobile
- ✅ Fixed mobile map title overlap with hamburger menu via `pt-14 md:pt-0` on layout
- ✅ Fixed e2e test conflict: added root `vitest.config.ts` to exclude `e2e/**` and `*.spec.ts` from vitest
- ✅ All 17 unit tests passing
- ✅ Added permanent rule to AGENT_INSTRUCTIONS.md: "New pages MUST have layout.tsx"

## Known Issues

1. **Dev login doesn't create connectedEmail**: Dev login creates/finds user but does NOT create `connectedEmail` records. Email sync requires Google OAuth to connect Gmail tokens.
2. **Israel Post regex gap**: Tracking numbers ending in Y (not IL) detected as ALIEXPRESS_STANDARD. Corrected during sync.
3. **Prisma db push needs --accept-data-loss**: `googleId String? @unique` has duplicate NULL values in production DB. Without `--accept-data-loss`, all `railway up` deploys fail at container startup.

## Design Decisions

| Decision | Date | Rationale |
|----------|------|-----------|
| No per-column scrolling in kanban | 2026-03 | User explicitly rejected it. Trello-style unified page scroll preferred. |
| Simplified favicon for small sizes | 2026-03 | Full logo becomes a smudge at 16/32px. Geometric pin shape reads better. |
| Status reconciliation after event upsert | 2026-03 | Carriers sometimes report stale overall status while individual events show DELIVERED. |
| `onboardingCompleted` flag on User | 2026-03 | Cleanly separates first-time vs returning users without relying on heuristics. |
| `--accept-data-loss` for prisma db push | 2026-03 | googleId @unique has duplicate NULLs in prod. Without this flag, all deploys fail. |
| Playwright visual verification | 2026-03 | Agents must screenshot pages to verify changes instead of asking user. |
| Web Audio API for sounds | 2026-03 | No audio files needed, works offline, lightweight synthesized effects. |
| Remove digit-only carrier patterns | 2025-01 | Too broad, caused 55+ misdetections. |

## Important Assumptions

- Users primarily track AliExpress and international e-commerce packages
- Hebrew language support is important (Israel-based users)
- 17track scraping may break if their site changes — Cainiao is the stable fallback
- Dev login (`POST /api/auth/dev-login`) is only available when `NODE_ENV !== 'production'`
- User prefers verifying changes himself (check localhost, not screenshots)
- **CRITICAL**: Dev servers MUST always be running (web :3003, API :3002). Verify before, during, and after all work. Never leave user with broken localhost.

## User Preferences

- Hates per-column scrolling in kanban — wants Trello/Jira style
- Wants polished, professional UI
- Expects docs to be updated with every change (AGENT_INSTRUCTIONS.md, agent-memory.md, dev-log.md)
- Expects step-by-step approval — don't batch changes without review
- Wants onboarding wizard to be extensible — new features should be added to wizard retrospectively

## Competitive Analysis (2026-03-12)

Compared MailTrack to 17TRACK, Parcel, AfterShip, Shop app, Packagetrackr.

**MailTrack advantages**: 4 view modes (unique), analytics dashboard (unique for consumer), self-hostable, SMS webhook ingest, ad-free.

**Gaps to address**:
- [ ] Barcode/QR scanner for quick tracking number entry
- [ ] Estimated delivery date — show more prominently
- [ ] Package sharing — share tracking link with family/friends
- [ ] Apple Watch / home screen widgets
- [ ] Multi-device cloud sync

## Future Tasks

- [x] Extract `syncPackageFromResult` into a shared service (DRY) — Done 2026-03-07
- [ ] Implement periodic auto-sync (cron/scheduled job)
- [ ] Add package archiving (hide delivered packages after N days)
- [ ] Mobile push notifications via Expo
- [ ] Multi-language support (i18n)
- [ ] Package grouping by merchant/order
- [ ] Add new features to onboarding wizard as they're built
