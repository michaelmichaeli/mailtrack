FROM node:20-alpine AS base

# API build
FROM base AS api-builder
WORKDIR /app
COPY package.json package-lock.json* turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN npm install
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN npx turbo build --filter=@mailtrack/api

# API runtime
FROM base AS api
WORKDIR /app
COPY --from=api-builder /app/node_modules ./node_modules
COPY --from=api-builder /app/apps/api/dist ./apps/api/dist
COPY --from=api-builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=api-builder /app/apps/api/package.json ./apps/api/
COPY --from=api-builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=api-builder /app/packages/shared/package.json ./packages/shared/
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "apps/api/dist/server.js"]
