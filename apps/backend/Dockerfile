# ---------- Stage 1: install workspace dependencies ----------
FROM node:26-alpine AS deps
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
FROM node:26-alpine AS runner
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

# Nx's generatePackageJson drops the root `overrides`, so re-add the
# @fastify/static pin here (see root package.json): @nestjs/platform-fastify@11
# declares a stale peerOptional range (^8||^9) that would otherwise fail this
# install with ERESOLVE. Setting it to the pruned exact version keeps it a valid
# override for the direct dependency.
RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('./package.json'));p.overrides={...(p.overrides||{}),'@fastify/static':p.dependencies['@fastify/static']};fs.writeFileSync('./package.json',JSON.stringify(p,null,2)+'\n');" \
  && rm -f package-lock.json \
  && npm install --omit=dev --no-audit --no-fund \
  && npm install --no-save --no-audit --no-fund prisma@7.9.1 \
  && npx prisma generate --schema ./prisma/schema.prisma \
  && printf '%s\n' "import { defineConfig } from 'prisma/config';" "export default defineConfig({ schema: 'prisma/schema.prisma', datasource: { url: process.env.DATABASE_URL ?? '' } });" > prisma.config.ts \
  && npm cache clean --force \
  && chmod +x ./docker-entrypoint.sh \
  # Harden the runtime image by removing npm/corepack — build-time-only tooling.
  # Their bundled deps (tar, pacote, sigstore, brace-expansion, picomatch) would
  # otherwise ship as image CVEs; the entrypoint runs prisma directly, not via npx.
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

EXPOSE 3001
# Applies migrations and the demo seed, then starts the API.
CMD ["./docker-entrypoint.sh"]
