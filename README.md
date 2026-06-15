# Voids

A self-hosted background service that finds the **gaps (voids)** in your Plex movie
collections — where you own a movie but are missing its sequels or other entries in the
same collection — and surfaces them for review, RSS, and automation.

Voids is a TypeScript reimplementation and spiritual successor to
[Gaps](https://github.com/JasonHHouse/gaps) by Jason H House. New name, new codebase,
credit retained. See [NOTICE](./NOTICE) and [LICENSE](./LICENSE).

## Tech stack

- **Backend:** NestJS (Node 22) on Express
- **Frontend:** React 19 + Vite, served statically by Nest (single container, single port)
- **Shared types:** zod schemas + inferred types in `@voids/shared`
- **DB:** SQLite via Drizzle ORM
- **Tooling:** pnpm workspaces, Vitest, ESLint + Prettier

## Monorepo layout

```
voids/
├─ packages/shared    # @voids/shared — zod contract shared by server + web
└─ apps/
   ├─ server          # @voids/server — NestJS API + static web host
   └─ web             # @voids/web — React + Vite SPA
```

## Dev quickstart

Requires Node 22 and pnpm 11 (this repo uses [mise](https://mise.jdx.dev/) to pin Node).

```bash
pnpm install
pnpm -r build      # builds shared, then server + web
pnpm dev           # runs server (8484) + web dev server (with /api proxy)
```

Useful scripts:

```bash
pnpm -r typecheck
pnpm -r test
pnpm -r lint
pnpm db:generate   # generate a new Drizzle migration
pnpm db:migrate    # apply migrations
```

## Docker

```bash
docker build -t voids:dev .
docker run --rm -p 8484:8484 -v "$PWD/data:/data" voids:dev
# then visit http://localhost:8484  and  http://localhost:8484/api/health
```

Or with compose:

```bash
docker compose up --build
```

### Environment variables

| Var             | Default          | Purpose                          |
| --------------- | ---------------- | -------------------------------- |
| `PORT`          | `8484`           | HTTP port                        |
| `DATA_DIR`      | `./data`         | Directory for the SQLite DB      |
| `DATABASE_PATH` | `$DATA_DIR/voids.db` | Explicit DB file path        |
| `BASE_URL`      | `/`              | Sub-path mount for the web build |

## Attribution

Voids is inspired by and reimplements the behavior of **Gaps** by Jason H House. See
[NOTICE](./NOTICE) for details.
