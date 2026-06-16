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
# Version string, derived from the git tag by scripts/release.sh and threaded in as
# a build arg. Vite bakes it into the web bundle (__APP_VERSION__) at build time;
# the server reads it from the environment at runtime (see runtime stage). Defaults
# to "0.0.0-untagged" so an ad-hoc `docker build` still produces a sensible value.
ARG APP_VERSION=0.0.0-untagged
ENV APP_VERSION=${APP_VERSION}
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
# Re-declare the build arg (ARGs don't cross stage boundaries) so the server can
# report it from /api/version at runtime. Must match the value baked into the web
# bundle in the build stage.
ARG APP_VERSION=0.0.0-untagged
ENV NODE_ENV=production \
    APP_VERSION=${APP_VERSION} \
    DATA_DIR=/data \
    DATABASE_PATH=/data/voids.db \
    PORT=8484 \
    PUID=1000 \
    PGID=1000

# gosu lets the entrypoint drop from root to the requested PUID:PGID after it has
# fixed ownership of the bind-mounted /data volume.
RUN apt-get update \
  && apt-get install -y --no-install-recommends gosu \
  && rm -rf /var/lib/apt/lists/*

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

# Entrypoint chowns /data to PUID:PGID and drops privileges before running the
# server. It starts as root (no `USER` line) so it can adjust the bind mount.
COPY deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /data

VOLUME /data
EXPOSE 8484
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "apps/server/dist/main.js"]
