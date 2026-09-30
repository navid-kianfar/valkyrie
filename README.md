# Valkyrie

An on-premise Redis / Valkey manager. A single admin account, a fleet of sources
(direct, TLS, or over an SSH tunnel), key browsing, a CLI console, bulk
operations and an audit log — all served from one container.

## Layout

```
apps/api        NestJS API · Drizzle ORM over SQLite · ioredis · ssh2
apps/web        React 19 + Vite SPA · Tailwind · shadcn/ui · 4 locales with RTL
packages/shared TypeScript types shared by both (source-only, erased at runtime)
design/         The static HTML design concept (not built, not shipped)
```

The API serves the built SPA from the same process, so a deployment is one
container on one port. Under `pnpm dev` Vite serves the SPA instead and proxies
`/api` to the API.

## Local development

Node 22+ and pnpm 12.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env     # then edit it
pnpm dev                                   # API on :4000, web on :5173
```

`pnpm dev:redis` starts a throwaway Redis on `:6399` (via `redis-memory-server`)
to point a source at. The SQLite database and its migrations live under
`apps/api/data` and `apps/api/drizzle`; migrations run automatically on boot.

| Command | What it does |
|---|---|
| `pnpm dev` | API and web together, both watching |
| `pnpm build` | Production build of every workspace |
| `pnpm --filter @valkyrie/api db:generate` | Generate a migration from a schema change |
| `pnpm --filter @valkyrie/api db:migrate` | Apply migrations by hand |

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `4000` | |
| `JWT_SECRET` | dev fallback | **Required in production**, ≥ 16 characters. Signs session tokens and derives the key that encrypts stored source credentials — changing it invalidates sessions and makes saved secrets unreadable. |
| `ADMIN_USER` | `admin` | The single admin account. |
| `ADMIN_PASSWORD` | `valkyrie` | **Set this.** There is no user management, so this pair is the only way in. |
| `DB_PATH` | `data/valkyrie.db` | |
| `NODE_ENV` | `development` | `production` turns on the `JWT_SECRET` requirement. |
| `WEB_DIST` | `./web` | Where the API looks for the built SPA. Set by the image. |

## Docker

```bash
docker build -t valkyrie .

docker run -d --name valkyrie \
  -p 8080:4000 \
  -e JWT_SECRET="$(openssl rand -base64 36)" \
  -e ADMIN_PASSWORD='a-real-password' \
  -v valkyrie-data:/app/data \
  valkyrie
```

Or with Compose, which reads the values from `.env`:

```bash
cp .env.example .env    # then fill it in
docker compose up -d
```

Either way the UI is on <http://localhost:8080>. Data lives in the
`/app/data` volume — removing the container without removing the volume keeps
your sources and keys.

The image runs as the non-root `node` user and carries a `HEALTHCHECK` against
`/api/health`.

## Releases

Images are published to Docker Hub as `kianfar/valkyrie` for `linux/amd64` and
`linux/arm64`, as a manifest list, on every `v*` tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

A tag produces, in parallel:

- `kianfar/valkyrie:<version>` and `kianfar/valkyrie:<major>.<minor>`, plus
  `:latest` for anything that is not a pre-release (`v0.2.0-rc1` gets neither
  `:latest` nor anything else pointing at it as the stable release).
- a GitHub Release with generated notes, created only after the images are
  actually on the registry.

`.github/workflows/release.yml` needs two repository secrets, the same pair the
registry-vault repository uses:

| Secret | |
|---|---|
| `DOCKERHUB_USERNAME` | Docker Hub account owning the `kianfar` namespace |
| `DOCKERHUB_TOKEN` | A Docker Hub access token with read/write scope |

## CI

`.github/workflows/ci.yml` runs on every branch push and pull request:

- **checks** — `pnpm install --frozen-lockfile`, `tsc --noEmit` for both apps,
  then the full production build.
- **image** — builds the Dockerfile for `linux/amd64` with no push and no
  credentials, so a pull request from a fork is verified too.
