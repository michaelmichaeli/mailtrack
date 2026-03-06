# Agent Memory

> Persistent memory for AI agents working on this project.
> Read this file at the start of every session to understand current state.
> Update this file after completing significant work.

## Current Goals

- Build a fully functional universal package tracking dashboard
- Support email-based order ingestion (Gmail), SMS webhooks, and manual entry
- Provide accurate carrier detection and real-time tracking
- Deliver a polished, responsive UI with notifications

## Tasks Completed

### Carrier Detection Overhaul (Session: 2025-01)
- **Problem**: Digit-only regex patterns (CANADA_POST `/\d{16}/`, TNT `/\d{9}/`, GLS `/\d{11,12}/`, ARAMEX `/\d{10}/`) were misdetecting AliExpress order IDs as wrong carriers
- **Fix**: Removed all digit-only patterns from `CARRIER_PATTERNS` in `packages/shared/src/constants.ts`
- **Enhancement**: Added `detectCarrierFrom17track()` in `tracking17.service.ts` — maps 17track provider name/country to `Carrier` enum for accurate last-mile detection
- **DB Migration**: Fixed 55 misdetected packages (CANADA_POST/TNT → UNKNOWN)
- **Files**: `packages/shared/src/constants.ts`, `apps/api/src/services/tracking17.service.ts`, `apps/api/src/routes/packages.routes.ts`, `apps/api/src/routes/ingest.routes.ts`

### Login Button Overflow Fix (Session: 2025-01)
- **Problem**: Dev Login button text was overflowing on the login page
- **Fix**: Added `truncate` class to button in `apps/web/src/app/login/page.tsx`

### Notification Toast UX (Session: 2025-01)
- **Problem**: Toast notifications stacked, had wrong cursor, weren't actionable
- **Fix**: Added `id: "new-notifications"` for deduplication, action button with `bellRef.current?.click()`
- **Status**: May need verification — sonner renders outside React tree, click propagation uncertain
- **File**: `apps/web/src/components/notifications/notification-bell.tsx`

## Tasks In Progress

_None currently_

## Known Issues

1. **Toast click may not work**: The sonner toast action button uses `bellRef.current?.click()` to open the notification dropdown. Since sonner renders outside the React component tree, this might not propagate correctly. May need a global event approach.
2. **Israel Post regex gap**: Tracking numbers like `RS1299291146Y` (ending in Y, not IL) are detected as `ALIEXPRESS_STANDARD` by regex. They get corrected to `ISRAEL_POST` during 17track sync, but only after a sync occurs.
3. **Duplicate `syncPackageFromResult`**: The function exists in both `packages.routes.ts` and `ingest.routes.ts`. Should be extracted to a shared service.

## Design Decisions

| Decision | Date | Rationale |
|----------|------|-----------|
| Remove digit-only carrier patterns | 2025-01 | Too broad, caused 55+ misdetections. Better to default to UNKNOWN and let 17track correct. |
| 17track carrier detection layer | 2025-01 | 17track provides accurate provider info (e.g., "Israel Post") that regex cannot match for ambiguous tracking formats. |
| Carrier correction persisted to DB | 2025-01 | Once 17track identifies the real carrier, update the DB so subsequent views show correct carrier without re-scraping. |

## Important Assumptions

- Users primarily track AliExpress and international e-commerce packages
- Hebrew language support is important (Israel-based users)
- 17track scraping may break if their site changes — Cainiao is the stable fallback
- Dev login (`POST /api/auth/dev-login`) is only available when `NODE_ENV !== 'production'`

## Future Tasks

- [ ] Extract `syncPackageFromResult` into a shared service (DRY)
- [ ] Add Israel Post direct API integration (bypass 17track for IL packages)
- [ ] Implement periodic auto-sync (cron/scheduled job)
- [ ] Add package archiving (hide delivered packages after N days)
- [ ] Mobile push notifications via Expo
- [ ] Multi-language support (i18n)
- [ ] Package grouping by merchant/order
