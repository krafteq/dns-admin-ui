# Keycloak Manual Setup Guide

This guide explains how to manually configure Keycloak as an OIDC identity provider for DNS Admin UI.

## 1. Start Keycloak

Create a `docker-compose.keycloak.yml`:

```yaml
services:
  keycloak:
    image: quay.io/keycloak/keycloak:26.0
    command: start-dev
    environment:
      KC_BOOTSTRAP_ADMIN_USERNAME: admin
      KC_BOOTSTRAP_ADMIN_PASSWORD: admin
    ports:
      - "8080:8080"
    restart: unless-stopped
```

```bash
docker compose -f docker-compose.keycloak.yml up -d
```

Wait for Keycloak to start, then open `http://localhost:8080` and log in with your admin credentials.

## 2. Create Realm

1. Click the realm dropdown (top-left, says **master**)
2. Click **Create realm**
3. Realm name: e.g. `dns-admin`
4. Click **Create**

## 3. Create Client

1. Left menu: **Clients** → **Create client**
2. **General settings**:
   - Client ID: e.g. `dns-admin-ui`
   - Click **Next**
3. **Capability config**:
   - Client authentication: **ON** (confidential client)
   - Authentication flow: check **Standard flow** only
   - Click **Next**
4. **Login settings**:
   - Valid redirect URIs: `http://localhost:3000/auth/oidc/callback`
   - Valid post logout redirect URIs: `http://localhost:3000/login`
   - Web origins: `http://localhost:3000`
   - Click **Save**
5. Go to **Credentials** tab → copy the **Client secret** (you'll need it later)

> **Note:** Replace `localhost:3000` with your actual app URL in production.

## 4. Create Realm Roles

1. Left menu: **Realm roles** → **Create role**
2. Role name: `admin` → **Save**
3. Repeat: **Create role** → `viewer` → **Save**

## 5. Add Protocol Mapper (required for role mapping)

Without this step, the ID token won't contain roles and all SSO users will default to `viewer`.

1. **Clients** → your client (e.g. `dns-admin-ui`) → **Client scopes** tab
2. Click the `<client-id>-dedicated` scope (e.g. `dns-admin-ui-dedicated`)
3. Click **Add mapper** → **By configuration**
4. Select **User Realm Role**
5. Configure:
   - Name: `realm roles`
   - Token Claim Name: `roles`
   - Add to ID token: **ON**
   - Add to access token: **ON**
6. Click **Save**

## 6. Create Users

1. Left menu: **Users** → **Add user**
2. Fill in username (and optionally email, first/last name)
3. Click **Create**
4. **Credentials** tab → **Set password**:
   - Enter password
   - Temporary: **ON** (user must change on first login) or **OFF**
   - Click **Save** → **Save password**
5. **Role mapping** tab → **Assign role**:
   - Change filter to **Filter by realm roles**
   - Select `admin` or `viewer`
   - Click **Assign**

Repeat for each user you want to create.

## 7. Start DNS Admin UI

Now that Keycloak is configured, start (or recreate) the DNS Admin UI container with the OIDC env vars.

Create a `docker-compose.yml` for the app:

```yaml
services:
  dns-admin-ui:
    image: krafteq.azurecr.io/dns-admin-ui:latest
    ports:
      - "3000:3000"
    environment:
      # -- Required: PowerDNS --
      PDNS_URL: http://your-pdns-auth:8081
      PDNS_API_KEY: your-api-key
      RECURSOR_URL: http://your-recursor:8082
      RECURSOR_API_KEY: your-api-key
      JWT_SECRET: change-me-to-a-long-random-string

      # -- OIDC / SSO (from steps 2-3) --
      OIDC_ISSUER_URL: http://localhost:8080/realms/dns-admin
      OIDC_CLIENT_ID: dns-admin-ui
      OIDC_CLIENT_SECRET: <your-client-secret>
      OIDC_REDIRECT_URI: http://localhost:3000/auth/oidc/callback
    extra_hosts:
      - "localhost:host-gateway"
    volumes:
      - dns-admin-data:/app/apps/backend/data
    restart: unless-stopped

volumes:
  dns-admin-data:
```

Replace `<your-client-secret>` with the client secret copied in step 3.

```bash
docker compose up -d
```

If the container is already running without OIDC, add the OIDC env vars and recreate:

```bash
docker compose up -d dns-admin-ui
```

### Docker networking note

When DNS Admin UI runs in Docker, `localhost` inside the container doesn't reach the host by default. The `extra_hosts: "localhost:host-gateway"` directive maps `localhost` inside the container to the Docker host, so both browser redirects and backend-to-Keycloak communication use the same `localhost:8080` URL.

## 8. Optional: Role Mapping Configuration

The app reads roles from the ID token using these env vars (defaults shown):

| Variable | Default | Description |
|---|---|---|
| `OIDC_ROLES_CLAIM` | `roles` | ID token claim containing the roles array |
| `OIDC_ADMIN_ROLE` | `admin` | Role value that grants admin access |

If your Keycloak uses a different claim name or role value, adjust these accordingly.

## 9. Verify

1. Open `http://localhost:3000/login`
2. The **"Sign in with SSO"** button should appear
3. Click it → authenticate in Keycloak → redirected back to dashboard
4. Check the Users page — your SSO user should appear with the correct role
