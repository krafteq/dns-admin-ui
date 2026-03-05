# DNS Admin UI — Claude Instructions

## Project
Full-stack web UI to manage PowerDNS Authoritative Server and PowerDNS Recursor via their REST APIs.

## Stack
- **Monorepo**: pnpm workspaces (`apps/*`, `packages/*`)
- **Frontend**: `apps/frontend` — React + Vite + TypeScript + Tailwind CSS + shadcn/ui + React Router v6
- **Backend**: `apps/backend` — Node.js + Express + tRPC v11 + Zod
- **DB**: SQLite via Drizzle ORM (better-sqlite3), file at `apps/backend/data/dns-admin.db`
- **Auth**: JWT in httpOnly cookies (jose library), bcrypt passwords
- **Shared types**: `packages/shared` — Zod schemas + inferred TypeScript types used by both apps

## Dev Workflow

```bash
# First-time setup (after clone or clean install)
pnpm install
pnpm rebuild better-sqlite3   # required on Windows — pnpm v10 blocks native builds
pnpm setup                    # runs db:migrate then db:seed

# Daily development
pnpm dev                      # starts backend (:3000) and frontend (:5173) in parallel
```

Default login: **admin / admin**

## Environment
- Backend config: `apps/backend/.env` (copy from `.env.example`)
- PowerDNS Auth Server: `PDNS_URL` + `PDNS_API_KEY`
- PowerDNS Recursor: `RECURSOR_URL` + `RECURSOR_API_KEY`
- JWT: `JWT_SECRET`

## Key Conventions

### Adding a new tRPC procedure
1. Define Zod input schema in `packages/shared/src/schemas/` and export it from `packages/shared/src/index.ts`
2. Add the procedure to the appropriate router in `apps/backend/src/routers/`
3. Call `writeAuditLog()` inside every mutating procedure
4. The frontend picks up the new procedure automatically via the `AppRouter` type

### Adding a new page
1. Create `apps/frontend/src/pages/MyPage.tsx`
2. Add a `<Route>` in `apps/frontend/src/App.tsx`
3. Add a nav link in `apps/frontend/src/components/layout/Sidebar.tsx`

### Database schema changes
```bash
# 1. Edit apps/backend/src/db/schema.ts
# 2. Generate migration
pnpm --filter @dns-admin/backend db:generate
# 3. Apply migration
pnpm --filter @dns-admin/backend db:migrate
```

Migration SQL files must use `-->statement-breakpoint` between statements (Drizzle requirement):
```sql
CREATE TABLE foo (...);
--> statement-breakpoint
CREATE INDEX ...;
```

## Known Gotchas

### better-sqlite3 on Windows + pnpm v10
pnpm v10 blocks native build scripts by default. If you see "Could not locate the bindings file":
```bash
pnpm rebuild better-sqlite3
# if that fails:
cd node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3 && npx node-gyp rebuild
```

### tRPC v11 + Express body parsing
Do **not** add `app.use(express.json())`. tRPC v11 reads the request body from the raw stream itself. Adding `express.json()` consumes the stream before tRPC can read it, causing all inputs to be `undefined`.

### Shared package ESM
`packages/shared/package.json` must have `"type": "module"`. Re-exports in `index.ts` must use `.js` extensions:
```ts
export * from './schemas/auth.js';   // ✓ correct
export * from './schemas/auth';      // ✗ breaks Node.js ESM resolution
```

### React Query v5
`onSuccess` / `onError` callbacks were removed from `useQuery`. Side-effect on query result:
```tsx
useEffect(() => {
  if (query.data) doSomething(query.data);
  else if (query.isError) handleError();
}, [query.data, query.isError]);
```

### Backend tsconfig
Backend `tsconfig.json` must set `"declaration": false` to avoid "inferred type cannot be named" errors caused by pnpm's symlinked `@types/express` paths.

### PowerDNS Auth Server — cache flush
`PUT /cache/flush` requires `?domain=` parameter. To flush all, pass `domain=.` (root dot). Empty string or missing param returns 422 "DNS Name '' is not canonical".
```ts
const target = domain || '.';
pdnsRequest('PUT', `/cache/flush?domain=${encodeURIComponent(target)}`);
```

### PowerDNS Recursor — cache flush
`PUT /cache/flush` requires `?domain=` parameter (same as Auth Server). The endpoint is NOT `DELETE /cache`.
```ts
const target = name || '.';
recursorRequest('PUT', `/cache/flush?domain=${encodeURIComponent(target)}`);
```

### PowerDNS Recursor — forwarders via API
The Recursor API requires `api-config-dir` to be set before it allows forwarder creation/deletion. Add to `docker-compose.yml`:
```yaml
command:
  - "--api-config-dir=/etc/powerdns/recursor.d"
volumes:
  - pdns-recursor-data:/etc/powerdns/recursor.d
```
After changing docker-compose.yml, use `docker compose up -d --force-recreate pdns-recursor` (not just `restart`) to apply the new config.

### Docker Compose v2
System uses Docker Compose v2 plugin — use `docker compose` (no hyphen). `docker-compose` (v1) is not installed.

### Port conflicts on dev restart
If Vite falls back to port 5174 or backend fails with EADDRINUSE on 3000, run `pnpm stop` then `pnpm dev`. The stop script kills Docker containers and all Node processes.

### Vitest + in-memory SQLite FK constraints
When using in-memory SQLite for tests, delete child tables before parent tables in `beforeEach`:
```ts
await db.delete(auditLog); // must come before users — FK constraint
await db.delete(users);
```

### PowerDNS Auth Server — search API requires wildcards
The `/search-data` endpoint does **not** do partial matching by default. Wrap the query with `*` wildcards:
```ts
const query = q.includes('*') ? q : `*${q}*`;
```
Without wildcards, searching `mail` returns nothing; `*mail*` finds MX records.

### PowerDNS Auth Server — TSIG key list omits secrets
`GET /tsigkeys` returns keys with empty `key` field. To get the actual secret, fetch each key individually via `GET /tsigkeys/{id}`.

### PowerDNS Recursor — packet cache vs record cache
The `cache-hits` stat counts **record cache** hits (rarely incremented for simple queries). Repeated identical queries are served from the **packet cache** (`packetcache-hits`). Dashboard should display both.

### DNS record names are relative to zone
When creating records via the PowerDNS API, names must be fully qualified and within the zone. The frontend should append the zone name to user input (e.g. user types `www` → send `www.example.com.`). Sending just `www.` returns 422 "Name is out of zone".

### OIDC role mapping from Keycloak
Roles are configured via env vars (defaults work with Keycloak):
- `OIDC_ROLES_CLAIM` (default `roles`) — which ID token claim to read
- `OIDC_ADMIN_ROLE` (default `admin`) — which value grants admin role

Keycloak requires a **realm role protocol mapper** on the client to include roles in the ID token. Realm roles are assigned to users via Keycloak admin UI (Role Mappings → filter by **realm roles**, not client roles).

### Keycloak realm-export.json changes require container rebuild
```bash
docker compose build --no-cache keycloak && docker compose down keycloak && docker compose up -d keycloak
```
Just `--force-recreate` may reuse the existing realm. `down` + `up` ensures a fresh import.

### tRPC test context typing
When mocking `res` in tRPC test contexts, extract it to a named variable to avoid TypeScript `never` type issues:
```ts
function makeCtx(user = null) {
  const res = { cookie: vi.fn(), clearCookie: vi.fn() };
  return { req: {} as never, res: res as any, user, _resMock: res };
}
// Use ctx._resMock.cookie in assertions, not ctx.res.cookie
```
