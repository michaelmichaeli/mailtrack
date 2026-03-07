# Development Log

> Chronological log of significant changes made to the codebase.
> Update this file after every meaningful implementation session.

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
