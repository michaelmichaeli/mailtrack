# MailTrack — Universal Package Tracking Aggregator

A cross-platform app (web + mobile) that connects to your Gmail/Outlook, parses order-confirmation and shipping emails, enriches with carrier APIs, and displays a unified dashboard of all packages with real-time status, location, and ETA.

## Architecture

```
Mobile (Expo/RN)  ←→  API Gateway (Fastify)  ←→  PostgreSQL
Web (Next.js)     ←→       ↕                      Redis (cache/queue)
                       Background Workers          ↕
                       (BullMQ)              Email APIs (Gmail/Outlook)
                           ↕                 Carrier APIs (17track)
                       Push Service           Shop APIs (Amazon, Ali)
                       (FCM + APNs)
```

## Tech Stack

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
| Carrier Tracking | 17track API / Ship24 API |
| Push Notifications | FCM + APNs via expo-notifications |

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL
- Redis

### Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp apps/api/.env.example apps/api/.env

# Generate Prisma client
npm run db:generate

# Push database schema
npm run db:push

# Start development
npm run dev
```

## Project Structure

```
mailtrack/
├── apps/
│   ├── web/          # Next.js web dashboard
│   ├── api/          # Fastify backend
│   └── mobile/       # Expo/React Native app
├── packages/
│   ├── shared/       # Shared types, schemas, constants
│   └── ui/           # Shared UI components
├── turbo.json
└── package.json
```

## License

MIT
