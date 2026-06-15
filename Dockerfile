# syntax=docker/dockerfile:1

# ---- base: install all workspace deps (with native build toolchain) ----
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
# Run pnpm non-interactively (no TTY prompts for modules-dir purge, etc.).
ENV CI=true
RUN corepack enable
WORKDIR /app

# better-sqlite3 ships prebuilt binaries (via prebuild-install) for node 22 on
# linux glibc, so no C/C++ toolchain is needed here. If a future bump lacks a
# prebuild, add: apt-get install -y --no-install-recommends python3 make g++.

# Copy manifests first for better layer caching.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

# ---- build: compile shared, server, web ----
FROM base AS build
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm -r build

# ---- prod-deps: production-only node_modules (rebuilds native modules) ----
FROM base AS prod-deps
WORKDIR /app
RUN pnpm install --frozen-lockfile --prod

# ---- runtime ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    DATA_DIR=/data \
    DATABASE_PATH=/data/voids.db \
    PORT=8484

# Production node_modules (hoisted at the workspace root) incl. native better-sqlite3.
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=prod-deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Built artifacts.
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/drizzle ./apps/server/drizzle
COPY --from=build /app/apps/web/dist ./apps/web/dist

# Run as the unprivileged node user; ensure it can write the data volume.
RUN mkdir -p /data && chown -R node:node /data /app
USER node

VOLUME /data
EXPOSE 8484
CMD ["node", "apps/server/dist/main.js"]
