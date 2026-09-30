# syntax=docker/dockerfile:1

# Valkyrie ships as a single image: the NestJS API serves the built web app from
# the same process, so a deployment is one container on one port.
#
#   docker build -t valkyrie .
#   docker run -p 8080:4000 \
#     -e JWT_SECRET=... -e ADMIN_PASSWORD=... \
#     -v valkyrie-data:/app/data valkyrie

ARG NODE_VERSION=22
ARG PNPM_VERSION=12.8.1

# ─── Build ───────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS build

ARG PNPM_VERSION

# better-sqlite3 and ssh2 fall back to compiling from source when no prebuilt
# binary matches the platform, so the toolchain belongs here rather than in the
# runtime image.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@${PNPM_VERSION}

WORKDIR /app

# Manifests first, so the dependency layer is cached against the lockfile and
# survives every source-only change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @valkyrie/api build \
 && pnpm --filter @valkyrie/web build

# A production-only copy of the API: node_modules without the devDependencies
# (drizzle-kit, the Nest CLI, the TypeScript compiler), plus the compiled dist
# and the migration folder.
RUN pnpm deploy --filter @valkyrie/api --prod /prod

# ─── Runtime ─────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=4000 \
    DB_PATH=/app/data/valkyrie.db

WORKDIR /app

COPY --from=build --chown=node:node /prod/node_modules ./node_modules
COPY --from=build --chown=node:node /prod/dist         ./dist
COPY --from=build --chown=node:node /prod/drizzle      ./drizzle
COPY --from=build --chown=node:node /prod/package.json ./package.json
# The API picks this up as its web root because it sits next to the working
# directory; see resolveWebDist() in apps/api/src/main.ts.
COPY --from=build --chown=node:node /app/apps/web/dist ./web

# The SQLite database and the drizzle migrations it is migrated from are both
# resolved against the working directory above.
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME ["/app/data"]

USER node
EXPOSE 4000

# curl is not in the slim image, so the probe uses node's own fetch.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "dist/apps/api/src/main.js"]
