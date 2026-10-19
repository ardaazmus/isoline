# ISOLINE web and worker images (ADR-001: own server, local network; G8 deployment).
# Build from the repository root:  docker compose --profile app build
# Two targets share the dependency and build layers:
#   web     Next.js standalone server (non-root, read-only file system friendly)
#   worker  outbox worker and database CLI (migrate / seed) run with tsx

FROM node:24-alpine AS deps
WORKDIR /app
COPY web/package.json web/package-lock.json ./
# xlsx is installed from the vendored, checksummed tarball (SheetJS CDN build), not the registry
COPY web/vendor ./vendor
RUN npm ci --no-audit --no-fund

FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY web/ ./
# the build only needs placeholders; real secrets come at run time
RUN node scripts/gen-locales.mjs && npx next build

FROM node:24-alpine AS web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN addgroup -S isoline && adduser -S -G isoline isoline
COPY --from=build --chown=isoline:isoline /app/.next/standalone ./
COPY --from=build --chown=isoline:isoline /app/.next/static ./.next/static
COPY --from=build --chown=isoline:isoline /app/public ./public
USER isoline
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=5 CMD wget -qO- http://127.0.0.1:3000/api/v1/health || exit 1
CMD ["node", "server.js"]

FROM node:24-alpine AS worker
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S isoline && adduser -S -G isoline isoline
COPY --from=build --chown=isoline:isoline /app ./
USER isoline
CMD ["npx", "tsx", "scripts/worker.ts"]
