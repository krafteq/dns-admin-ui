# Keycloak Manual Setup Guide

This guide explains how to manually configure Keycloak as an OIDC identity provider for DNS Admin UI.

## Prerequisites

- Keycloak running and accessible (e.g. `http://localhost:8080`)
- DNS Admin UI deployed (e.g. via `docker-compose.prod_local.yml`)

## 1. Start Keycloak

If using the dev docker-compose:

```bash
docker compose up -d keycloak
```

Or run a standalone Keycloak:

```bash
docker run -d \
  --name keycloak \
  -p 8080:8080 \
  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin \
  -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
  quay.io/keycloak/keycloak:26.0 start-dev
```

Open `http://localhost:8080` and log in with your admin credentials.

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

## 7. Configure DNS Admin UI

Set the following environment variables for the DNS Admin UI backend:

| Variable | Description | Example |
|---|---|---|
| `OIDC_ISSUER_URL` | Keycloak realm URL | `http://localhost:8080/realms/dns-admin` |
| `OIDC_CLIENT_ID` | Client ID from step 3 | `dns-admin-ui` |
| `OIDC_CLIENT_SECRET` | Client secret from step 3 | `<copied-secret>` |
| `OIDC_REDIRECT_URI` | Must match redirect URI in step 3 | `http://localhost:3000/auth/oidc/callback` |

### Example: docker-compose.prod_local.yml

```yaml
environment:
  OIDC_ISSUER_URL: http://localhost:8080/realms/dns-admin
  OIDC_CLIENT_ID: dns-admin-ui
  OIDC_CLIENT_SECRET: <your-client-secret>
  OIDC_REDIRECT_URI: http://localhost:3000/auth/oidc/callback
```

### Docker networking note

When the DNS Admin UI runs in Docker, `localhost` inside the container doesn't reach the host by default. Add `extra_hosts` to make it work:

```yaml
services:
  dns-admin-ui:
    # ...
    extra_hosts:
      - "localhost:host-gateway"
```

This maps `localhost` inside the container to the Docker host, so both the browser redirects and backend-to-Keycloak communication use the same `localhost:8080` URL.

## 8. Optional: Role Mapping Configuration

The app reads roles from the ID token using these env vars (defaults shown):

| Variable | Default | Description |
|---|---|---|
| `OIDC_ROLES_CLAIM` | `roles` | ID token claim containing the roles array |
| `OIDC_ADMIN_ROLE` | `admin` | Role value that grants admin access |

If your Keycloak uses a different claim name or role value, adjust these accordingly.

## 9. Verify

1. Start/restart DNS Admin UI
2. Open `http://localhost:3000/login`
3. The **"Sign in with SSO"** button should appear
4. Click it → authenticate in Keycloak → redirected back to dashboard
5. Check the Users page — your SSO user should appear with the correct role
