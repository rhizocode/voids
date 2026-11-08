# Voids

<p align="center">
  <a href="https://github.com/rhizocode/voids/actions/workflows/ci.yml"><img src="https://github.com/rhizocode/voids/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/rhizocode/voids/tags"><img src="https://img.shields.io/github/v/tag/rhizocode/voids?label=version&sort=semver" alt="Latest version"></a>
  <a href="https://github.com/rhizocode/voids/pkgs/container/voids"><img src="https://img.shields.io/badge/ghcr.io-voids-2496ED?logo=docker&logoColor=white" alt="Container"></a>
  <a href="https://github.com/rhizocode/voids/pkgs/container/voids"><img src="https://img.shields.io/badge/arch-amd64%20%7C%20arm64-blue" alt="Arch"></a>
  <br>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://github.com/rhizocode/voids/pkgs/container/voids"><img src="https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white" alt="Docker"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License: MIT"></a>
</p>

**Voids** finds the gaps — the *voids* — in your movie collections. You own a movie but
are missing its sequels or other entries in the same collection; Voids scans your
[Jellyfin](https://jellyfin.org/) libraries, cross-references [TMDB](https://www.themoviedb.org/)
to discover the siblings you're missing, and surfaces them for review, RSS, and
automation.

It's **background-first**: it runs on a schedule, does its work headless, and persists
everything to a local SQLite database. The web UI exists for configuration, review, and
debugging — not as a dashboard you keep open.

Voids is a TypeScript reimplementation and spiritual successor to
[Gaps](https://github.com/JasonHHouse/gaps) by Jason H House. New name, new codebase,
credit retained. See [NOTICE](./NOTICE) and [LICENSE](./LICENSE).

> **Media source:** Voids currently uses **Jellyfin**. The codebase has a generic
> media-source abstraction; **Plex support is planned** but not yet shipped.

---

## Features

- **Jellyfin library scan** — discovers the movies you own across one or more Jellyfin
  servers and libraries, reading TMDB/IMDb identifiers for accurate matching.
- **TMDB gap finding** — for each owned movie, finds the rest of its TMDB *collection*
  and flags the entries you don't own. Backed by a persistent SQLite cache
  (movie + collection details) so repeat runs are mostly database reads.
- **Polite, fast TMDB access** — a token-bucket rate limiter (default 40 req/s,
  configurable) with automatic HTTP 429 / `Retry-After` handling, instead of fixed
  sleeps.
- **Live search progress** — searches run as cancellable background jobs whose state
  lives in the DB; the web UI streams progress over a WebSocket and falls back to polling
  if the socket drops.
- **Approval workflow** — every recommendation has a status (`new` / `approved` /
  `rejected` / `ignored`). Triage in the UI; `rejected` / `ignored` are remembered across
  re-runs.
- **RSS feed for Radarr** — a per-library JSON feed (`/rss/:serverId/:feedToken`) that
  Radarr can import as a list. Stays public even when auth is enabled. Carries only
  approved gaps by default; turn on **Include unreviewed gaps** to send every gap.
- **Push to Radarr** — push approved recommendations directly into Radarr, manually or
  automatically on scheduled runs.
- **Cron scheduler** — built-in schedule presets plus a custom cron option; a scheduled
  run validates each server, refreshes libraries and owned movies, and searches every
  default library, fully headless.
- **Released-only filter** — `MovieStatus` (`ALL` vs `RELEASED`) to optionally exclude
  unreleased / unannounced collection entries.
- **7 notification providers** — Telegram, Pushbullet, Slack, Gotify, Email (SMTP),
  Pushover, and Discord, each with subscribable notification types and a test button.
- **Mislabeled detection** — flags likely-mismatched library entries by title/year
  similarity against TMDB.
- **Auth & TLS** — optional HTTP Basic auth and optional self-signed TLS, both via env.
- **Single container, single port** — one Docker image on port `8484`, no Redis, no
  sidecars. SQLite on a single `/data` volume.

---

## Quick start (Docker)

A single image serves the API, the WebSocket, the RSS feeds, and the web UI on port
`8484`. All persistent state lives on the `/data` volume.

```bash
docker run -d --name voids \
  -p 8484:8484 \
  -v ./data:/data \
  ghcr.io/rhizocode/voids:latest
```

Then open <http://localhost:8484> and continue with the
[configuration walkthrough](#configuration-walkthrough).

### Or with Docker Compose

A ready-to-edit [`docker-compose.yml`](./docker-compose.yml) is included:

```bash
docker compose up -d
```

It maps `./data:/data` and port `8484:8484`, includes a `/api/health` healthcheck, and
has commented examples for auth, TLS, and sub-path mounting.

### Building the image locally

```bash
docker build -t voids:local .
docker run --rm -p 8484:8484 -v "$PWD/data:/data" voids:local
```

### Multi-arch build (amd64 + arm64)

The image builds cleanly on both `linux/amd64` and `linux/arm64` (native deps like
`better-sqlite3` resolve prebuilt binaries):

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/rhizocode/voids:latest .
# add --push to publish to a registry
```

---

## Configuration walkthrough

App configuration (TMDB key, Jellyfin servers, Radarr, notifications, schedule) is done
in the web UI and stored in the database — there's nothing to put in a config file. After
the container is up, open the UI and:

1. **Add your TMDB API key.** Go to **Configuration → TMDB**. Get a free key from your
   [TMDB account → Settings → API](https://www.themoviedb.org/settings/api) (request a
   "Developer" key). Paste it and test/save.
2. **Add a Jellyfin server.** Go to **Configuration → Servers → Add server**. Provide:
   - **URL / address** — e.g. `http://10.0.0.10`
   - **Port** — Jellyfin's default is `8096`
   - **API key** — create one in Jellyfin at **Dashboard → API Keys → +** (the key is
     sent in the `Authorization` header; it is never logged).

   Voids tests the connection and lists the server's libraries.
3. **Enable a movie library.** From the server's libraries, enable the movie library you
   want Voids to scan (and optionally mark it the default for scheduled runs).
4. **Run a search.** Go to the **Recommended** page, pick the server/library, and start a
   search. You'll see a live progress bar; results (the "voids") populate as it runs.
5. **Review & approve.** In the results, triage each recommendation: approve, reject, or
   ignore. Rejected/ignored items are remembered on the next run.
6. **(Optional) Set a schedule.** Go to **Configuration → Schedule** and pick a preset
   (hourly / daily / weekly / etc.) or a custom cron. Scheduled runs complete headless.
7. **(Optional) Configure Radarr + notifications.** Add your Radarr URL + API key to push
   approved movies (manually or auto-push on scheduled runs), and enable any of the 7
   notification providers under **Configuration → Notifications**.
8. **(Optional) Add the RSS feed to Radarr.** Each enabled library exposes a JSON feed at:

   ```
   http://<voids-host>:8484/rss/<serverId>/<feedToken>
   ```

   The exact URLs are listed on the **RSS** page in the UI. Add the URL to Radarr as a
   list. The `/rss/**` endpoints stay public even when auth is enabled, so Radarr can poll
   them without credentials.

   By default a feed only lists the gaps you approve, so Radarr adds nothing until you
   review it. To skip review, turn on **Include unreviewed gaps** on the RSS page: the feed
   then lists every gap you have not rejected or ignored.

---

## Environment variables

These control the **process/runtime**. They do not hold app secrets — the TMDB key,
Jellyfin server/API key, Radarr config, and notification settings are entered in the UI
and stored in the database. A committed [`.env.example`](./.env.example) lists them all
with placeholders.

| Variable          | Default                | Description                                                                                                                                  |
| ----------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`            | `8484`                 | HTTP(S) listen port.                                                                                                                          |
| `DATA_DIR`        | `/data` (image), `./data` (local) | Persistent data directory: SQLite DB and generated TLS certs. A `VOLUME` in the image.                                             |
| `DATABASE_PATH`   | `$DATA_DIR/voids.db`   | Explicit SQLite file path. Usually left unset (derived from `DATA_DIR`).                                                                      |
| `PUID`            | `1000`                 | User ID the server runs as and that owns `/data`. The entrypoint chowns `/data` to it and drops privileges. Set to `99` on unRAID.            |
| `PGID`            | `1000`                 | Group ID the server runs as. Set to `100` on unRAID (the `users` group). Pair with `PUID` so a bind-mounted `/data` is writable.              |
| `BASE_URL`        | `/`                    | Sub-path mount point for serving behind a reverse proxy at a sub-path (e.g. `/voids`).                                                        |
| `AUTH_MODE`       | `none`                 | `none` (open, for trusted LANs) or `basic` (HTTP Basic auth on the API + UI; `/rss/**` stays public).                                         |
| `AUTH_USERNAME`   | `admin`                | Basic-auth username. Only used when `AUTH_MODE=basic`.                                                                                        |
| `AUTH_PASSWORD`   | _(unset)_              | Basic-auth password (plaintext in env; hashed on boot, never logged). If `AUTH_MODE=basic` and this is unset, the server fails closed (denies all) with a warning. |
| `TLS`             | `off`                  | `off` (plain HTTP) or `on` (server generates a fresh self-signed cert into `$DATA_DIR/tls` on first boot and serves HTTPS).                   |
| `TMDB_RATE_LIMIT` | `40`                   | TMDB token-bucket sustained rate, in requests/second.                                                                                         |
| `LOG_LEVEL`       | `log`                  | Log level: `error` \| `warn` \| `log` \| `debug` \| `verbose`. Secrets are always redacted regardless of level.                              |

---

## Security / reverse proxy

- **Auth is `none` by default**, appropriate for a trusted LAN. Enable HTTP Basic auth by
  setting `AUTH_MODE=basic`, `AUTH_USERNAME`, and `AUTH_PASSWORD`. Basic auth guards the
  API and the web UI, but the **`/rss/**` feed endpoints stay public** so Radarr can poll
  them. (`GET /api/health` and `GET /api/auth/mode` are also exempt, for healthchecks and
  UI bootstrap.)
- **TLS is `off` by default.** For most homelab setups, terminate TLS at a reverse proxy
  (Traefik, Nginx Proxy Manager, Caddy) and leave Voids on plain HTTP. Example Caddy:

  ```caddy
  voids.example.com {
      reverse_proxy localhost:8484
  }
  ```

  If you prefer Voids to serve HTTPS directly, set `TLS=on` — it generates a fresh
  self-signed certificate into `$DATA_DIR/tls` (`cert.pem` + `key.pem`) on first boot.
  Browsers will warn on the self-signed cert; a reverse proxy with a real cert is the
  recommended path for anything exposed beyond your LAN.
- **Sub-path mounting:** set `BASE_URL=/voids` (and configure your proxy accordingly) to
  serve Voids under a sub-path.
- **Secrets are never logged** — a redaction layer keeps Jellyfin tokens, the TMDB key,
  and notification credentials out of the logs at every level.

---

## Development

Requires **Node 22** and **pnpm 11** (the repo pins Node via [mise](https://mise.jdx.dev/)).

```bash
pnpm install                # install all workspace deps
pnpm dev                    # run server (8484) + web dev server (Vite, with /api proxy)
```

`pnpm dev` runs `@voids/server` (NestJS watch mode) and `@voids/web` (Vite) in parallel.
To run them individually:

```bash
pnpm --filter @voids/server dev
pnpm --filter @voids/web dev
```

Quality gate (what CI runs):

```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm -r build
```

Database migrations (Drizzle):

```bash
pnpm db:generate            # generate a new migration from schema changes
pnpm db:migrate             # apply migrations
```

Migrations are applied automatically on server boot; the generated SQL lives in
`apps/server/drizzle/`.

### Project layout

```
voids/
├─ packages/shared    # @voids/shared — zod schemas + inferred types (the server/web contract)
└─ apps/
   ├─ server          # @voids/server — NestJS: API, WebSocket, RSS, scheduler, static web host
   └─ web             # @voids/web — React 19 + Vite SPA
```

- **Backend:** NestJS (Node 22) on Express; SQLite via Drizzle ORM.
- **Frontend:** React 19 + Vite, served statically by Nest (single container, single
  port). `/api`, `/ws`, and `/rss` are handled by the server; everything else falls back
  to the SPA's `index.html`.
- **Shared types:** zod schemas in `@voids/shared`, consumed by both server and web, so an
  API/UI desync is a compile error.

See [`projectBrief.md`](./projectBrief.md) for the full architecture and design rationale.

---

## Releasing & versioning

**The git tag is the single source of truth for the version.** It is injected at
build time — there is no runtime lookup — and flows to both halves of the app from
one `APP_VERSION` build arg:

- **Web:** Vite's `define` bakes it into the bundle as `__APP_VERSION__`
  (`apps/web/vite.config.ts`). The **About** page and **Config → Advanced** tab
  render this constant directly.
- **Server:** `GET /api/version` reports `process.env.APP_VERSION`
  (`apps/server/src/health/health.controller.ts`), kept as a machine-readable
  endpoint for health checks and support.

`scripts/release.sh` derives the version with `git describe --tags` and passes it
through the Docker build (`docker-compose.yml` forwards it as the `APP_VERSION`
build arg). When the arg is absent — local `vite dev`, an ad-hoc `docker build` —
the version falls back to `<package.json version>-dev` / `0.0.0-untagged`, so an
untagged build is always visibly distinguishable from a real release.

### Cutting a release

```bash
pnpm version 0.3.0          # bumps the root package.json, commits, and tags v0.3.0
git push --follow-tags      # pushes the commit and the tag together
scripts/release.sh          # builds the image stamped from the git tag
```

> **Note:** `pnpm version` only bumps the **root** `package.json`. To keep the
> workspace packages (`apps/*`, `packages/*`) in sync, bump their `version` fields
> in the same commit. The displayed version comes from the git tag regardless, so
> this is for manifest consistency rather than what users see.

---

## Attribution & license

Voids is licensed under the **MIT License** — see [LICENSE](./LICENSE).

Voids is a TypeScript reimplementation inspired by **Gaps** by
[Jason H House](https://github.com/JasonHHouse/gaps), used under the MIT License. See
[NOTICE](./NOTICE). The original copyright is retained alongside the Voids copyright.
