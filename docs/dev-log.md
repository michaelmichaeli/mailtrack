# Development Log

> Chronological log of significant changes made to the codebase.
> Update this file after every meaningful implementation session.

---

## 2026-03-07 — Next.js 16 Upgrade (Turbopack, React 19)

### Problem
Next.js 14 dev server used webpack, which corrupted its `.next` cache during hot module replacement. This caused repeated "Cannot find module './XXX.js'" crashes requiring manual `rm -rf .next`.

### Solution
Upgraded the entire web stack:
- **Next.js**: 14.2.35 → 16.1.6
- **React**: 18.3.1 → 19.2.4
- **@types/react**: 18 → 19

### Key Changes
- **Turbopack is now the default dev bundler** — no webpack cache = no crashes
- Dev server startup: ~1300ms → ~290ms
- Added `skipLibCheck: true` to web tsconfig for monorepo compatibility (mobile uses React 18)
- Added root `overrides` in package.json to force `@types/react@19` across all workspaces
- Removed `optimizePackageImports` from `experimental` (not a valid config key in Next.js 16)
- `next-env.d.ts` auto-updated by Next.js 16

### Files Changed
- `apps/web/package.json`: next, react, react-dom, @types/react, @types/react-dom versions
- `apps/web/next.config.mjs`: Removed invalid optimizePackageImports
- `apps/web/tsconfig.json`: Added skipLibCheck
- `package.json`: Added @types/react + overrides at root level
- `apps/web/next-env.d.ts`: Auto-updated by Next.js 16

---

## 2026-03-07 — Loading Skeletons, Logo Link, Scroll-to-Top

### Content-Shaped Loading Skeletons

**Problem**: Pages used `LogoSpinner` (a rotating logo) as loading state, instead of content-shaped skeleton placeholders.

**Changes**:
- Added to `skeleton.tsx`: `ProfileSkeleton` (avatar + details + stats grid), `NotificationsSkeleton` (card with list items), `SettingsSkeleton` (connected emails + notification prefs + appearance cards), `OrderDetailSkeleton` (back button + info cards + timeline)
- `app/profile/page.tsx`: Replaced `LogoSpinner` with `ProfileSkeleton`
- `app/notifications/page.tsx`: Replaced `LogoSpinner` with inline notification item skeletons
- `app/orders/[id]/page.tsx`, `app/packages/[id]/page.tsx`: Replaced basic `Skeleton` blocks with `OrderDetailSkeleton`

### Sidebar Logo → Home Link

Wrapped logo + brand text in `<Link href="/packages">` so clicking navigates to the home (packages) page.

### Floating Scroll-to-Top Button

Created `components/ui/scroll-to-top.tsx`:
- Listens to scroll events on `<main>` element (which has `overflow-y-auto`)
- Shows floating button with up arrow after scrolling 300px
- Smooth scroll to top on click
- Fade-in animation with `tailwindcss-animate`
- Added to `Sidebar` component so it appears on all authenticated pages

### SMS Ingest — CSS Copy Fix & Notification Bug Fix

**Curl malformed URL**: User reported curl "malformed URL" when pasting the test command from the settings page. Root cause: `break-all select-all` CSS on `<code>` elements inserted newlines at visual wrap points when text was copied. Fixed by using `whitespace-nowrap overflow-x-auto select-all` on all three code blocks (ingest key, webhook URL, curl command).

**Notifications not created**: SMS ingest returned 200 and added packages, but no in-app notification records were created. Root cause: `notification.create()` calls in `ingest.routes.ts` included a `metadata` field that does NOT exist in the Prisma `Notification` model. Prisma threw an error, caught by try/catch, notification creation silently failed. Fix: removed `metadata` field, added `orderId` instead.

**Deployment fix**: All Railway deployments via `railway up` were failing because `prisma db push` errors on `googleId String? @unique` with existing duplicate NULL values. Fix: added `--accept-data-loss` flag to prisma db push in both `Dockerfile.api` CMD and `railway.toml` startCommand.

### Visual Verification Protocol

Added Playwright-based visual verification to `AGENT_INSTRUCTIONS.md` as a hard rule. Agents must capture screenshots using Playwright (with dev-login auth flow) instead of asking the user for screenshots.

### Next.js Cache Recovery

Added `.next` cache recovery procedure to `AGENT_INSTRUCTIONS.md`. Stale `.next` cache causes "Cannot find module './XXX.js'" crashes — fix is `rm -rf apps/web/.next` and rebuild.

---

## 2026-03-07 — Extract syncPackageFromResult to Shared Service

### DRY Refactor: package-sync.service.ts

**Problem**: `syncPackageFromResult` was duplicated in `packages.routes.ts` and `ingest.routes.ts`. The ingest version was a simplified copy missing: terminal status protection (DELIVERED/RETURNED), push notifications on status change, pickup location enrichment via Google Places, smart event deduplication (6h status window), and status reconciliation.

**Fix**: Extracted the comprehensive version into `apps/api/src/services/package-sync.service.ts`. Both route files now import from the shared service.

**Changes**:
- `apps/api/src/services/package-sync.service.ts` (NEW): Full `syncPackageFromResult` with all features
- `apps/api/src/routes/packages.routes.ts`: Removed inline function, imports from service
- `apps/api/src/routes/ingest.routes.ts`: Removed simplified duplicate, imports from service. SMS ingested packages now get full sync treatment (notifications, status reconciliation, etc.)

**Impact**: SMS-ingested packages now benefit from the same sync quality as email-parsed ones — terminal status protection, push notifications, and status reconciliation.

---

## 2026-03-06 — Onboarding Wizard, Branding, Kanban Redesign, Status Reconciliation

### Onboarding Wizard (In Progress)

**What**: Multi-step first-time user wizard with animations, confetti, sound effects, feature tour.

**Changes**:
- `apps/api/prisma/schema.prisma`: Added `onboardingCompleted Boolean @default(false)` to User model
- `apps/api/src/routes/auth.routes.ts`: `/me` now returns `onboardingCompleted`; added `POST /auth/onboarding-complete`
- `apps/web/src/lib/api.ts`: Added `completeOnboarding()` method
- `apps/web/src/app/auth/callback/page.tsx`: Checks `onboardingCompleted` → routes new users to `/onboarding`
- `apps/web/src/app/onboarding/page.tsx`: Complete rewrite with framer-motion, canvas-confetti, Web Audio API sounds, 5 steps: Welcome → Connect Gmail → Sync → Feature Tour → Completion
- Installed `canvas-confetti` + `@types/canvas-confetti`

**Status**: Built, NOT pushed — awaiting user review.

### Custom Logo & Branding

- Copied user's Gemini-generated logo, cropped to transparent pin+box icon (1071×1231)
- Generated all icon sizes (16/32/180/192/512px) from logo
- Simplified bold geometric pin for small favicon sizes (16/32/48px) — full logo too detailed at small sizes
- All favicons have indigo (#6366F1) rounded rect background
- Updated sidebar and login page to use logo `<Image>` with `drop-shadow-sm`
- Created `LogoSpinner` component (3D Y-axis rotation, `@keyframes logo-spin` in globals.css)
- Replaced all loading spinners (auth callback, onboarding, notifications, infinite scroll) with LogoSpinner

### Kanban Board Redesign

**Problem**: User hated per-column scrolling. Wanted Trello/Jira style.

**Final approach**: Columns extend full height, page scrolls as one unit, horizontal scroll for overflow. Columns have `bg-muted/40` rounded containers with sticky headers.

**File**: `apps/web/src/components/packages/package-kanban.tsx`

### View-Specific Loading Skeletons

- Created `TableSkeleton`, `KanbanSkeleton`, `TimelineSkeleton` in `skeleton.tsx`
- Packages page shows correct skeleton per active view (initial + infinite scroll)

### Package Status Reconciliation Fix

**Problem**: Packages stuck at `OUT_FOR_DELIVERY` when `DELIVERED` events existed. Carrier tracking returned stale overall status.

**Fix**: After upserting events in `syncPackageFromResult`, check all events for highest-priority status and upgrade package/order accordingly.

**File**: `apps/api/src/routes/packages.routes.ts` (end of `syncPackageFromResult`)

### Time Filter Compact Labels

- Removed "3 months" period
- Shortened labels: 7D, 30D, 6M, 1Y, All
- Styled as compact pill-group with `bg-muted` container

### Notification Bell Dropdown Fix

**Problem**: "See all notifications" button cut off at bottom of dropdown.

**Fix**: Changed from `overflow-hidden` to flex column layout. Header/footer are `shrink-0`, list is `flex-1 overflow-y-auto`.

### iPhone Safe Area Fix

**Problem**: Sidebar sign-out button hidden behind iPhone home indicator.

**Fix**: Added `pb-[max(0.75rem,env(safe-area-inset-bottom))]` to sidebar bottom. Added `viewportFit: "cover"` to viewport config.

### Sign Out in Settings

Added Sign Out button between Appearance and Data & Privacy sections in settings page.

### Database Cleanup

Deleted all packages/orders/events/notifications for user account (requested by user).

---

## 2025-01 — Carrier Detection Overhaul + UI Fixes

### Carrier Misdetection Fix

**Problem**: AliExpress order IDs (16-digit numbers like `1119117991510782`) were being detected as `CANADA_POST` by the overly broad regex `/\b\d{16}\b/`. Similar issues with TNT (`/\d{9}/`), GLS (`/\d{11,12}/`), and ARAMEX (`/\d{10}/`). Affected 55 packages in the database.

**Changes**:
- `packages/shared/src/constants.ts`: Removed `CANADA_POST`, `TNT`, `GLS`, `ARAMEX` digit-only patterns from `CARRIER_PATTERNS`
- `apps/api/src/services/tracking17.service.ts`: Added `detectCarrierFrom17track()` function that maps 17track provider names (e.g., "Israel Post", "Royal Mail") and country codes to the `Carrier` enum
- `apps/api/src/routes/packages.routes.ts`: `syncPackageFromResult()` now persists corrected carrier to DB when 17track detects a more specific one
- `apps/api/src/routes/ingest.routes.ts`: Same carrier correction logic added
- Database: Ran migration script to fix 55 misdetected packages → set carrier to `UNKNOWN`

### Login Button Overflow

**Change**: Added `truncate` class to button element in `apps/web/src/app/login/page.tsx`.

### Notification Toast UX

**Changes** in `apps/web/src/components/notifications/notification-bell.tsx`:
- Added `id: "new-notifications"` to prevent duplicate toasts
- Added action button with `bellRef.current?.click()` to open notification dropdown

---
