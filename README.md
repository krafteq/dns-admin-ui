# DNS Admin UI

Web UI for managing PowerDNS Authoritative Server and PowerDNS Recursor via their REST APIs.

## Features

**DNS Authoritative Server**
- Zone management (create, edit, delete, AXFR retrieve, notify, rectify, export)
- DNS record editing via RRsets
- DNSSEC (enable/disable, key management)
- TSIG key management
- Autoprimaries configuration
- Full-text search across zones and records

**DNS Recursor**
- Forwarder zone management
- Cache statistics and flush
- Configuration (allow-from, allow-notify-from)
- RPZ statistics

**System**
- Local and OIDC/SSO authentication (Keycloak, etc.)
- Role-based access (admin / viewer)
- Audit log of all changes
- Dark / light / system theme

## Quick Start (Docker)

The image is publicly available — no authentication needed to pull.

```bash
docker pull krafteq.azurecr.io/dns-admin-ui:latest
```

### Docker Compose

Create a `docker-compose.yml`:

```yaml
services:
  dns-admin-ui:
    image: krafteq.azurecr.io/dns-admin-ui:latest
    ports:
      - "3000:3000"
    environment:
      PDNS_URL: http://your-pdns-auth:8081
      PDNS_API_KEY: your-api-key
      RECURSOR_URL: http://your-recursor:8082
      RECURSOR_API_KEY: your-api-key
      JWT_SECRET: change-me-to-a-long-random-string
    volumes:
      - dns-admin-data:/app/apps/backend/data
    restart: unless-stopped

volumes:
  dns-admin-data:
```

```bash
docker compose up -d
```

Open http://localhost:3000 — default login: **admin / admin**

On first start the container automatically runs database migrations and seeds the admin user.

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PDNS_URL` | Yes | — | PowerDNS Auth Server API URL |
| `PDNS_API_KEY` | Yes | — | Auth Server API key |
| `RECURSOR_URL` | Yes | — | PowerDNS Recursor API URL |
| `RECURSOR_API_KEY` | Yes | — | Recursor API key |
| `JWT_SECRET` | Yes | — | Secret for signing JWT tokens |
| `PORT` | No | `3000` | Server port |
| `DATABASE_URL` | No | `./data/dns-admin.db` | SQLite database path |

#### OIDC / SSO (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `OIDC_ISSUER_URL` | — | OIDC provider URL (e.g. `https://keycloak.example.com/realms/dns-admin`) |
| `OIDC_CLIENT_ID` | — | Client ID |
| `OIDC_CLIENT_SECRET` | — | Client secret |
| `OIDC_REDIRECT_URI` | — | Callback URL (e.g. `https://dns-admin.example.com/auth/oidc/callback`) |
| `OIDC_ROLES_CLAIM` | `roles` | ID token claim containing user roles |
| `OIDC_ADMIN_ROLE` | `admin` | Claim value that grants admin access |

When OIDC is configured, a "Sign in with SSO" button appears on the login page. Local login remains available.

For step-by-step Keycloak setup instructions, see [Keycloak Manual Setup Guide](docs/keycloak-setup.md).

### Data Persistence

The SQLite database is stored at `/app/apps/backend/data/dns-admin.db` inside the container. Mount a volume to persist it across restarts:

```yaml
volumes:
  - dns-admin-data:/app/apps/backend/data
```

### Reverse Proxy

The app serves both the API and frontend from a single port. Place it behind a reverse proxy for TLS:

```nginx
server {
    listen 443 ssl;
    server_name dns-admin.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Development

### Prerequisites

- Node.js 22+
- pnpm 10+
- Docker (for PowerDNS services)

### Setup

```bash
git clone git@github.com:krafteq/dns-admin-ui.git
cd dns-admin-ui

pnpm install
pnpm setup    # runs db:migrate + db:seed
pnpm dev      # starts PowerDNS containers + backend (:3000) + frontend (:5173)
```

Default login: **admin / admin**

### Project Structure

```
├── apps/
│   ├── backend/          # Express + tRPC + Drizzle (SQLite)
│   └── frontend/         # React + Vite + Tailwind + shadcn/ui
├── packages/
│   └── shared/           # Zod schemas + TypeScript types
├── docker/
│   ├── pdns-auth/        # PowerDNS Auth Server config
│   ├── pdns-recursor/    # PowerDNS Recursor config
│   └── keycloak/         # Keycloak OIDC provider config
├── Dockerfile            # Multi-stage production build
├── docker-compose.yml    # Dev services (PowerDNS + Keycloak)
└── docker-compose.prod.yml  # Production deployment example
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev servers + Docker services |
| `pnpm build` | Build all packages |
| `pnpm test` | Run tests |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm setup` | Initialize database (migrate + seed) |
| `pnpm stop` | Stop Docker containers + kill Node processes |
| `pnpm smoke` | Run smoke tests |

### Dev Services

`pnpm dev` starts these Docker containers automatically:

| Service | Port | Purpose |
|---------|------|---------|
| pdns-auth | 8081 (API), 5300 (DNS) | PowerDNS Authoritative Server |
| pdns-recursor | 8082 (API), 5301 (DNS) | PowerDNS Recursor |
| keycloak | 8080 | OIDC provider for SSO testing |

### Adding a tRPC Procedure

1. Define Zod schema in `packages/shared/src/schemas/` and export from `packages/shared/src/index.ts`
2. Add the procedure to the router in `apps/backend/src/routers/`
3. Call `writeAuditLog()` in every mutation
4. Frontend picks up the new procedure automatically via the `AppRouter` type

### Adding a Page

1. Create `apps/frontend/src/pages/MyPage.tsx`
2. Add a `<Route>` in `apps/frontend/src/App.tsx`
3. Add a nav link in `apps/frontend/src/components/layout/Sidebar.tsx`

### Database Migrations

```bash
# 1. Edit apps/backend/src/db/schema.ts
# 2. Generate migration
pnpm --filter @dns-admin/backend db:generate
# 3. Apply migration
pnpm --filter @dns-admin/backend db:migrate
```
