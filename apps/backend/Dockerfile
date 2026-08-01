# ---------- Stage 1: install workspace dependencies ----------
FROM node:22-alpine AS deps
WORKDIR /workspace
COPY package.json package-lock.json ./
# The postinstall hook runs `prisma generate`, which needs the schema.
COPY apps/backend/prisma ./apps/backend/prisma
RUN npm ci --no-audit --no-fund

# ---------- Stage 2: build the app with Nx ----------
FROM deps AS build
ENV NX_DAEMON=false
COPY . .
RUN npx nx build backend --configuration=production

# ---------- Stage 3: compact runtime image ----------
FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# Prisma engines need OpenSSL on Alpine.
RUN apk add --no-cache openssl

# Nx generated a pruned package.json (exact versions) next to the bundle.
# `npm install` instead of `npm ci`: the Nx-pruned lockfile can miss deduped
# transitive deps (e.g. fastify's process-warning), while top-level pins keep
# the install reproducible enough for a runtime image.
COPY --from=build /workspace/dist/apps/backend ./
COPY apps/backend/prisma ./prisma
COPY apps/backend/docker-entrypoint.sh ./docker-entrypoint.sh

RUN rm -f package-lock.json \
  && npm install --omit=dev --no-audit --no-fund \
  && npm install --no-save --no-audit --no-fund prisma@5.22.0 \
  && npx prisma generate --schema ./prisma/schema.prisma \
  && npm cache clean --force \
  && chmod +x ./docker-entrypoint.sh

EXPOSE 3001
# Applies migrations and the demo seed, then starts the API.
CMD ["./docker-entrypoint.sh"]
