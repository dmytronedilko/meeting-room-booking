# ---------- Stage 1: install workspace dependencies ----------
FROM node:26.5.1-alpine AS deps
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------- Stage 2: build with Nx (Next.js standalone output) ----------
FROM deps AS build
ENV NX_DAEMON=false
# Baked into the client bundle at build time. `/api` = same origin via the Nginx proxy.
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY . .
RUN npx nx build frontend --configuration=production

# ---------- Stage 3: compact runtime image ----------
FROM node:26.5.1-alpine AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app

# The standalone bundle mirrors the monorepo layout (outputFileTracingRoot);
# its server resolves distDir to dist/apps/frontend/.next, so static assets
# must land there.
COPY --from=build /workspace/dist/apps/frontend/.next/standalone ./
COPY --from=build /workspace/dist/apps/frontend/.next/static ./dist/apps/frontend/.next/static
COPY --from=build /workspace/apps/frontend/public ./apps/frontend/public

# Harden the runtime image by removing npm/corepack — build-time-only tooling.
# Their bundled deps (tar, pacote, sigstore, brace-expansion, picomatch) would
# otherwise ship as image CVEs; the Next.js standalone server runs via
# `node apps/frontend/server.js`, never npm. Matches the backend image — dropping
# this is exactly how CVE-2026-59873 reached the frontend image.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

USER node
EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]
