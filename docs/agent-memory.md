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
- **Status**: Built, awaiting user review before push
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

## Tasks In Progress

- **Onboarding Wizard**: Built, awaiting user review before push

## Known Issues

1. **Dev login doesn't create connectedEmail**: Dev login creates/finds user but does NOT create `connectedEmail` records. Email sync requires Google OAuth to connect Gmail tokens.
2. **Israel Post regex gap**: Tracking numbers ending in Y (not IL) detected as ALIEXPRESS_STANDARD. Corrected during sync.
3. **Duplicate `syncPackageFromResult`**: Exists in both `packages.routes.ts` and `ingest.routes.ts`. Should extract to shared service.

## Design Decisions

| Decision | Date | Rationale |
|----------|------|-----------|
| No per-column scrolling in kanban | 2026-03 | User explicitly rejected it. Trello-style unified page scroll preferred. |
| Simplified favicon for small sizes | 2026-03 | Full logo becomes a smudge at 16/32px. Geometric pin shape reads better. |
| Status reconciliation after event upsert | 2026-03 | Carriers sometimes report stale overall status while individual events show DELIVERED. |
| `onboardingCompleted` flag on User | 2026-03 | Cleanly separates first-time vs returning users without relying on heuristics. |
| Web Audio API for sounds | 2026-03 | No audio files needed, works offline, lightweight synthesized effects. |
| Remove digit-only carrier patterns | 2025-01 | Too broad, caused 55+ misdetections. |

## Important Assumptions

- Users primarily track AliExpress and international e-commerce packages
- Hebrew language support is important (Israel-based users)
- 17track scraping may break if their site changes — Cainiao is the stable fallback
- Dev login (`POST /api/auth/dev-login`) is only available when `NODE_ENV !== 'production'`
- User prefers verifying changes himself (check localhost, not screenshots)

## User Preferences

- Hates per-column scrolling in kanban — wants Trello/Jira style
- Wants polished, professional UI
- Expects docs to be updated with every change (AGENT_INSTRUCTIONS.md, agent-memory.md, dev-log.md)
- Expects step-by-step approval — don't batch changes without review
- Wants onboarding wizard to be extensible — new features should be added to wizard retrospectively

## Future Tasks

- [ ] Extract `syncPackageFromResult` into a shared service (DRY)
- [ ] Implement periodic auto-sync (cron/scheduled job)
- [ ] Add package archiving (hide delivered packages after N days)
- [ ] Mobile push notifications via Expo
- [ ] Multi-language support (i18n)
- [ ] Package grouping by merchant/order
- [ ] Add new features to onboarding wizard as they're built
