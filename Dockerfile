FROM node:22-alpine AS base
RUN apk add --no-cache openssl

# ──────────────── API ────────────────

FROM base AS api-builder
WORKDIR /app
COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN npm install
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npx turbo build --filter=@mailtrack/api

FROM base AS api
WORKDIR /app
COPY --from=api-builder /app/node_modules ./node_modules
COPY --from=api-builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=api-builder /app/apps/api/dist ./apps/api/dist
COPY --from=api-builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=api-builder /app/apps/api/package.json ./apps/api/
COPY --from=api-builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=api-builder /app/packages/shared/package.json ./packages/shared/
ENV NODE_ENV=production
EXPOSE ${PORT:-3001}
CMD ["sh", "-c", "npx prisma db push --schema=apps/api/prisma/schema.prisma --skip-generate && node apps/api/dist/server.js"]

# ──────────────── WEB ────────────────

FROM base AS web-builder
WORKDIR /app
COPY package.json package-lock.json turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm install
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
RUN npx turbo build --filter=@mailtrack/web

FROM base AS web
WORKDIR /app
COPY --from=web-builder /app/node_modules ./node_modules
COPY --from=web-builder /app/apps/web/.next ./apps/web/.next
COPY --from=web-builder /app/apps/web/public ./apps/web/public
COPY --from=web-builder /app/apps/web/package.json ./apps/web/
COPY --from=web-builder /app/apps/web/next.config.mjs ./apps/web/
COPY --from=web-builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=web-builder /app/packages/shared/package.json ./packages/shared/
ENV NODE_ENV=production
EXPOSE ${PORT:-3000}
CMD ["npm", "run", "start", "--prefix", "apps/web"]
