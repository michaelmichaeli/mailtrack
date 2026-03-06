# Development Log

> Chronological log of significant changes made to the codebase.
> Update this file after every meaningful implementation session.

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

**Follow-up**: Users should re-sync packages so 17track can re-detect correct last-mile carriers.

### Login Button Overflow

**Problem**: Dev Login button text overflowed its container on the login page.

**Change**: Added `truncate` class to button element in `apps/web/src/app/login/page.tsx` (line 79).

### Notification Toast UX

**Problem**: Toast notifications were stacking, had wrong cursor style, and weren't actionable when clicked.

**Changes** in `apps/web/src/components/notifications/notification-bell.tsx`:
- Added `id: "new-notifications"` to prevent duplicate toasts
- Added action button with `bellRef.current?.click()` to open notification dropdown
- Added "Tap to view" description

**Status**: Needs verification — sonner renders outside React component tree, click may not propagate.

---
