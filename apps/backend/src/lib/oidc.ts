import * as client from 'openid-client';

let cachedConfig: client.Configuration | null = null;

export function isOidcEnabled(): boolean {
  return !!(
    process.env.OIDC_ISSUER_URL &&
    process.env.OIDC_CLIENT_ID &&
    process.env.OIDC_CLIENT_SECRET
  );
}

export function getOidcRedirectUri(): string {
  return (
    process.env.OIDC_REDIRECT_URI ??
    'http://localhost:3000/auth/oidc/callback'
  );
}

export async function getOidcConfig(): Promise<client.Configuration> {
  if (cachedConfig) return cachedConfig;

  const issuerUrl = new URL(process.env.OIDC_ISSUER_URL!);
  const clientId = process.env.OIDC_CLIENT_ID!;
  const clientSecret = process.env.OIDC_CLIENT_SECRET!;

  const execute: Array<(config: client.Configuration) => void> = [];
  if (issuerUrl.protocol === 'http:') {
    execute.push(client.allowInsecureRequests);
  }

  cachedConfig = await client.discovery(
    issuerUrl,
    clientId,
    { client_secret: clientSecret },
    undefined,
    { execute },
  );

  return cachedConfig;
}
