# -- build stage (compiles the app) --
FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile

COPY . .

# Build frontend (Vite → static files) and bundle backend (esbuild → single JS files)
RUN pnpm --filter @dns-admin/frontend build && pnpm --filter @dns-admin/backend build:bundle

# -- deps stage (compiles better-sqlite3 native bindings) --
FROM node:22-bookworm-slim AS deps

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /deps

RUN echo '{"private":true,"type":"module"}' > package.json

RUN npm install --no-save better-sqlite3

# -- prod stage (runtime only, no build tools) --
FROM node:22-bookworm-slim AS prod

RUN apt-get update && apt-get install -y --no-install-recommends \
    tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy bundled backend (index.js, db/migrate.js, db/seed.js)
COPY --from=build /app/apps/backend/dist ./apps/backend/dist

# Copy migration SQL files (needed at runtime by Drizzle migrator)
COPY --from=build /app/apps/backend/src/db/migrations ./apps/backend/dist/db/migrations

# Copy built frontend static files
COPY --from=build /app/apps/frontend/dist ./apps/frontend/dist

# Copy pre-compiled node_modules from deps stage (better-sqlite3 native addon)
COPY --from=deps /deps/node_modules ./node_modules

# Create data directory for SQLite
RUN mkdir -p apps/backend/data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["tini", "--"]
CMD ["sh", "-c", "node apps/backend/dist/db/migrate.js && node apps/backend/dist/db/seed.js && node apps/backend/dist/index.js"]
