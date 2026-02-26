## Plan: MailTrack — Universal Package Tracking Aggregator

**TL;DR:** A cross-platform app (web via Next.js + mobile via React Native/Expo) that connects to a user's Gmail/Outlook via OAuth, parses order-confirmation and shipping emails to extract tracking numbers, enriches with carrier APIs and shop APIs (Amazon SP-API, AliExpress), and displays a unified dashboard of all packages with real-time status, location, and ETA. Push notifications alert users on status changes. Auth via Google/Apple social login. Open-source. Node.js (Fastify) backend with PostgreSQL + Redis.

---

### Architecture Overview

```
Mobile (Expo/RN)  ←→  API Gateway (Fastify)  ←→  PostgreSQL
Web (Next.js)     ←→       ↕                      Redis (cache/queue)
                       Background Workers          ↕
                       (BullMQ)              Email APIs (Gmail/Outlook)
                           ↕                 Carrier APIs (17track, etc.)
                       Push Service           Shop APIs (Amazon, Ali)
                       (FCM + APNs)
```

---

### Steps

**Phase 1 — Foundation**

1. **Monorepo setup** — Use Turborepo with these packages:
   - `apps/web` — Next.js 14+ (App Router) for the web dashboard
   - `apps/mobile` — Expo (SDK 51+) / React Native for iOS & Android
   - `apps/api` — Fastify backend (Node.js 20+)
   - `packages/shared` — Shared types, constants, validation schemas (Zod)
   - `packages/ui` — Shared UI components (where possible, using Tamagui or similar cross-platform library)

2. **Database & ORM** — PostgreSQL via Prisma ORM. Key models:
   - `User` (id, name, email, avatar, authProvider)
   - `ConnectedEmail` (userId, provider, accessToken, refreshToken, lastSyncAt)
   - `ConnectedShop` (userId, platform, accessToken, refreshToken)
   - `Order` (userId, shopPlatform, orderId, orderDate, merchant, totalAmount, currency)
   - `Package` (orderId, trackingNumber, carrier, status, estimatedDelivery, lastLocation, items)
   - `TrackingEvent` (packageId, timestamp, location, status, description)
   - `NotificationPreference` (userId, pushEnabled, emailEnabled, quietHours)

3. **Auth** — Social login only (Google + Apple Sign-In):
   - Backend: `@fastify/oauth2` or Passport.js strategies for Google & Apple
   - JWT access tokens (short-lived, 15min) + refresh tokens (httpOnly cookies, 30 days)
   - Mobile: `expo-auth-session` for Google, `expo-apple-authentication` for Apple
   - Web: NextAuth.js (Auth.js v5) with the same Google/Apple providers

**Phase 2 — Email Integration & Parsing**

4. **Gmail OAuth** — Use Google OAuth 2.0 with `gmail.readonly` scope:
   - Gmail API (`users.messages.list` + `users.messages.get`) to fetch emails
   - Set up Gmail push notifications via Pub/Sub (webhook) to get real-time new-email events instead of polling
   - Filter emails using queries: `from:(amazon OR aliexpress OR ebay OR etsy) subject:(order OR shipping OR tracking OR delivered)`

5. **Outlook OAuth** — Microsoft Graph API with `Mail.Read` scope:
   - Use Microsoft Graph subscriptions (webhooks) for real-time notifications
   - Same filtering approach via `$filter` and `$search` OData queries

6. **Email parser engine** — This is the core differentiator. Build a robust multi-layer parser:
   - **Layer 1 — Pattern matching:** Regex-based extraction for tracking numbers (each carrier has known formats: UPS `1Z...`, FedEx 12/15/20-digit, USPS 20-22 digit, etc.)
   - **Layer 2 — HTML/structured parsing:** Parse email HTML for order details tables (merchant, items, price, tracking links)
   - **Layer 3 — LLM fallback:** For emails that don't match known patterns, use an LLM (OpenAI GPT-4o-mini or local Ollama) to extract structured data from email body — this handles the long tail of merchants
   - Store raw parsing results and confidence scores; flag low-confidence extractions for user confirmation
   - Build a **template registry** — known email formats from top 50 merchants get custom parsers for highest accuracy
   - **Important:** Never store raw email content long-term. Extract structured data, store it, then discard the email body (privacy best practice)

**Phase 3 — Carrier & Shop API Integration**

7. **Carrier tracking aggregation** — Use a tracking meta-API to avoid integrating 100+ carriers individually:
   - Primary: [17track API](https://api.17track.net) or [Ship24 API](https://www.ship24.com) — supports 1,500+ carriers worldwide
   - Fallback: Direct integrations for top carriers (UPS, FedEx, USPS, DHL, DPD, Royal Mail, Cainiao)
   - Auto-detect carrier from tracking number format
   - Poll frequency: every 4h for in-transit, every 12h for pre-shipment, stop after delivered + 7 days
   - Normalize all carrier statuses into a unified enum: `ORDERED → PROCESSING → SHIPPED → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED → EXCEPTION → RETURNED`

8. **Amazon SP-API** — For users who link their Amazon account:
   - Requires Amazon developer registration and SP-API approval
   - Fetch orders via `GET /orders/v0/orders` with date range filters
   - Get tracking from order items — more reliable than email parsing
   - Respect rate limits (1 req/sec burst, throttled after)

9. **AliExpress API** — Use AliExpress Open Platform:
   - `aliexpress.trade.buyer.order.list` for order history
   - `aliexpress.logistics.buyer.freight.get` for tracking info
   - Note: AliExpress API approval is notoriously slow; email parsing is the reliable fallback

10. **Additional shops** — Design a plugin/adapter pattern so new shops can be added easily:
    - Interface: `{ name, parseEmail(html) → OrderData, fetchOrders?(token) → Order[], fetchTracking?(orderId) → Tracking }`
    - Priority list: Amazon, AliExpress, eBay, Etsy, Shein, Temu, Walmart, Shopify-powered stores

**Phase 4 — Background Jobs & Real-Time Updates**

11. **Job queue (BullMQ + Redis):**
    - `sync-email` — Triggered by webhook or scheduled every 15min per user to fetch & parse new emails
    - `track-package` — Polls carrier APIs at adaptive intervals
    - `enrich-order` — Matches email-extracted data with shop API data to fill gaps
    - `send-notification` — Sends push/in-app notifications on status changes
    - Use priority queues: delivery-day packages get highest priority

12. **Push notifications (Firebase Cloud Messaging + APNs):**
    - Trigger on: status changes, estimated delivery date changes, delivery exceptions, out-for-delivery, delivered
    - Mobile: `expo-notifications` for token registration + display
    - Web: Web Push API with service worker
    - Respect user quiet hours (stored in `NotificationPreference`)
    - In-app notification center with badge counts

**Phase 5 — Frontend (Web + Mobile)**

13. **Shared state & data fetching:**
    - TanStack Query (React Query) for both web and mobile — handles caching, background refetch, optimistic updates
    - WebSocket connection (Socket.io or Fastify websocket) for real-time status updates on the dashboard

14. **Key screens/pages:**
    - **Onboarding:** Social login → connect Gmail/Outlook → initial email sync (show progress) → optional: link Amazon/AliExpress accounts
    - **Dashboard (home):** Active packages grouped by status (Arriving today, In transit, Processing, Delivered recently). Each card shows: merchant logo, item description, carrier + tracking #, status bar (visual progress), ETA
    - **Package detail:** Full timeline of tracking events on a vertical stepper. Map view showing route (if location data available). Order details (items, price, merchant link)
    - **Search & filter:** Search by merchant, tracking number, item name. Filter by status, date range, carrier
    - **Settings:** Connected accounts (email, shops) with connect/disconnect. Notification preferences. Dark/light theme. Data export (JSON/CSV)

15. **UI/UX best practices:**
    - Skeleton loaders during sync (not spinners)
    - Pull-to-refresh on mobile
    - Color-coded status badges (green = delivered, blue = in transit, orange = exception, gray = processing)
    - Package status progress bar (visual 5-step indicator)
    - Empty states with illustrations and CTAs ("Connect your email to start tracking")
    - Haptic feedback on mobile for important status changes

**Phase 6 — Security & Privacy**

16. **Critical security measures:**
    - OAuth tokens encrypted at rest (AES-256) before storing in DB — use a KMS or env-based encryption key
    - Never store email passwords — OAuth only
    - Minimal OAuth scopes (read-only email, read-only orders)
    - Rate limiting on all API endpoints (express-rate-limit / @fastify/rate-limit)
    - CORS whitelist for web
    - Input validation on every endpoint (Zod schemas)
    - SQL injection prevention (Prisma parameterized queries)
    - Audit logging for sensitive operations (token creation, account linking)
    - GDPR/privacy: Allow users to delete all their data ("right to be forgotten"), provide data export

---

### Tech Stack Summary

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
| Carrier Tracking | 17track API or Ship24 API |
| Push Notifications | FCM (Android/Web), APNs (iOS) via expo-notifications |
| Real-time | WebSockets (Fastify WS or Socket.io) |
| Email Parsing | Cheerio (HTML), regex (tracking #s), LLM fallback |
| Shared Types | Zod, TypeScript |
| Deployment | Docker, Railway/Fly.io (API), Vercel (web), EAS (mobile) |
| Monitoring | Sentry (errors), Posthog (analytics, open-source) |

---

### Verification

- **Unit tests:** Vitest for backend + shared packages; Jest + React Testing Library for frontend
- **Email parser tests:** Build a test suite of 50+ real email templates (anonymized) covering top merchants — assert correct extraction of tracking numbers, order IDs, merchant names
- **Integration tests:** Test full flow: OAuth → email fetch → parse → carrier track → notification send
- **E2E tests:** Playwright (web), Detox or Maestro (mobile) — test onboarding flow, dashboard rendering, package detail
- **Manual verification:** Connect a real Gmail account, confirm orders from Amazon/AliExpress appear correctly with live tracking data

---

### Decisions

- **Email parsing over direct shop APIs as primary:** Email parsing works across all merchants without needing individual API approvals; shop APIs enrich but are optional
- **17track/Ship24 over individual carrier integrations:** Aggregator APIs cover 1,500+ carriers, saving months of integration work
- **Social login only (no email/password):** Reduces auth attack surface, simpler UX, leverages the same Google OAuth already needed for Gmail
- **BullMQ over cron jobs:** Enables per-user adaptive scheduling, retry with backoff, priority queues, and horizontal scaling
- **Turborepo monorepo:** Keeps shared types, validation, and utilities in sync between web, mobile, and API without publishing packages
