import { Router } from 'express';
import * as client from 'openid-client';
import { SignJWT, jwtVerify } from 'jose';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { JWT_SECRET } from '../lib/config.js';
import { writeAuditLog } from '../lib/audit.js';
import { isOidcEnabled, getOidcConfig, getOidcRedirectUri } from '../lib/oidc.js';

export const oidcRouter = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  maxAge: 5 * 60 * 1000, // 5 minutes
  signed: true,
  secure: process.env.NODE_ENV === 'production',
};

oidcRouter.get('/auth/oidc/login', async (_req, res) => {
  if (!isOidcEnabled()) {
    res.status(404).json({ error: 'OIDC not configured' });
    return;
  }

  try {
    const config = await getOidcConfig();
    const redirectUri = getOidcRedirectUri();

    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = client.randomState();
    const nonce = client.randomNonce();

    // Store PKCE verifier, state, and nonce in a signed cookie
    res.cookie('oidc_state', JSON.stringify({ state, nonce, codeVerifier }), COOKIE_OPTS);

    const authUrl = client.buildAuthorizationUrl(config, {
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
      response_type: 'code',
    });

    res.redirect(authUrl.href);
  } catch (err) {
    console.error('[OIDC login]', err);
    res.redirect('/login?error=oidc_config_error');
  }
});

oidcRouter.get('/auth/oidc/callback', async (req, res) => {
  if (!isOidcEnabled()) {
    res.status(404).json({ error: 'OIDC not configured' });
    return;
  }

  try {
    const config = await getOidcConfig();
    const redirectUri = getOidcRedirectUri();

    const stateCookie = req.signedCookies?.oidc_state;
    if (!stateCookie) {
      res.redirect('/login?error=missing_state');
      return;
    }

    const { state, nonce, codeVerifier } = JSON.parse(stateCookie) as {
      state: string;
      nonce: string;
      codeVerifier: string;
    };

    // Clear the state cookie
    res.clearCookie('oidc_state', { signed: true });

    // Use configured redirect URI as base — behind Vite proxy req.host is the backend
    const callbackUrl = new URL(req.originalUrl, new URL(redirectUri).origin);

    const tokens = await client.authorizationCodeGrant(
      config,
      callbackUrl,
      {
        pkceCodeVerifier: codeVerifier,
        expectedState: state,
        expectedNonce: nonce,
        idTokenExpected: true,
      },
    );

    const claims = tokens.claims();
    if (!claims) {
      res.redirect('/login?error=no_id_token');
      return;
    }

    const sub = claims.sub;
    const issuer = claims.iss;
    const email = claims.email as string | undefined;
    const preferredUsername = claims.preferred_username as string | undefined;

    // Extract role from configurable OIDC claim
    const rolesClaim = process.env.OIDC_ROLES_CLAIM || 'roles';
    const adminRole = process.env.OIDC_ADMIN_ROLE || 'admin';
    const roles = (claims as Record<string, unknown>)[rolesClaim];
    const rolesList = Array.isArray(roles) ? roles as string[] : [];
    const appRole = rolesList.includes(adminRole) ? 'admin' : 'viewer';

    // Find or create local user
    const user = await findOrCreateOidcUser(sub, issuer, email, preferredUsername, appRole);

    // Issue JWT cookie (same as local login)
    const token = await new SignJWT({ sub: String(user.id), role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1d')
      .sign(JWT_SECRET);

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 1000,
      secure: process.env.NODE_ENV === 'production',
    });

    await writeAuditLog({
      user,
      action: 'OIDC_LOGIN',
      entityType: 'auth',
      entityId: user.username,
    });

    res.redirect('/dashboard');
  } catch (err) {
    console.error('[OIDC callback]', err);
    res.redirect('/login?error=oidc_callback_failed');
  }
});

oidcRouter.get('/auth/oidc/logout', async (req, res) => {
  const cookieOpts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  };

  try {
    // Read token BEFORE clearing the cookie (for audit logging)
    const token = req.cookies?.token as string | undefined;
    if (token) {
      try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        const userId = payload.sub ? parseInt(payload.sub, 10) : null;
        if (userId) {
          const [user] = await db.select().from(users).where(eq(users.id, userId));
          if (user) {
            await writeAuditLog({
              user,
              action: 'OIDC_LOGOUT',
              entityType: 'auth',
              entityId: user.username,
            });
          }
        }
      } catch {
        // Invalid token — skip audit log
      }
    }

    // Clear the JWT cookie
    res.clearCookie('token', cookieOpts);

    if (!isOidcEnabled()) {
      res.redirect('/login');
      return;
    }

    const config = await getOidcConfig();
    const endSessionEndpoint = config.serverMetadata().end_session_endpoint;

    if (!endSessionEndpoint) {
      res.redirect('/login');
      return;
    }

    // Build the post-logout redirect URI pointing to the app's login page
    const redirectUri = getOidcRedirectUri();
    const appOrigin = new URL(redirectUri).origin;
    const postLogoutRedirectUri = `${appOrigin}/login`;

    const logoutUrl = new URL(endSessionEndpoint);
    logoutUrl.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri);
    logoutUrl.searchParams.set('client_id', process.env.OIDC_CLIENT_ID!);

    console.log('[OIDC logout] redirect to:', logoutUrl.href);
    res.redirect(logoutUrl.href);
  } catch (err) {
    console.error('[OIDC logout]', err);
    res.clearCookie('token', cookieOpts);
    res.redirect('/login');
  }
});

async function findOrCreateOidcUser(
  sub: string,
  issuer: string,
  email?: string,
  preferredUsername?: string,
  role: 'admin' | 'viewer' = 'viewer',
) {
  // Look up existing user by OIDC subject + issuer
  const [existing] = await db
    .select()
    .from(users)
    .where(and(eq(users.oidcSubject, sub), eq(users.oidcIssuer, issuer)));

  if (existing) {
    // Sync role from Keycloak on each login
    if (existing.role !== role) {
      const [updated] = await db
        .update(users)
        .set({ role })
        .where(eq(users.id, existing.id))
        .returning();
      return updated;
    }
    return existing;
  }

  // Determine username: prefer email, then preferred_username, then oidc-{sub}
  let baseUsername = email || preferredUsername || `oidc-${sub}`;
  let username = baseUsername;
  let suffix = 1;

  // Ensure uniqueness
  while (true) {
    const [conflict] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username));
    if (!conflict) break;
    username = `${baseUsername}-${suffix++}`;
  }

  const [newUser] = await db
    .insert(users)
    .values({
      username,
      passwordHash: '', // OIDC users cannot login with password
      role,
      oidcSubject: sub,
      oidcIssuer: issuer,
    })
    .returning();

  return newUser;
}
