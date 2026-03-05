const BASE_URL = (process.env.PDNS_URL ?? 'http://localhost:8081').replace(/\/$/, '');
const API_KEY = process.env.PDNS_API_KEY ?? '';
const API_PREFIX = '/api/v1/servers/localhost';

async function pdnsRequest<T = unknown>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${BASE_URL}${API_PREFIX}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`Cannot reach PowerDNS Auth Server at ${BASE_URL} — check PDNS_URL and that the server is running`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`PowerDNS API error ${res.status}: ${text}`);
  }

  // Some endpoints return empty body (204)
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return {} as T;
  }

  return res.json() as Promise<T>;
}

async function pdnsTextRequest(method: string, path: string): Promise<string> {
  const url = `${BASE_URL}${API_PREFIX}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { 'X-API-Key': API_KEY },
    });
  } catch {
    throw new Error(`Cannot reach PowerDNS Auth Server at ${BASE_URL} — check PDNS_URL and that the server is running`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`PowerDNS API error ${res.status}: ${text}`);
  }

  return res.text();
}

export const pdnsClient = {
  getServerInfo: () => pdnsRequest('GET', ''),
  getStats: () => pdnsRequest<unknown[]>('GET', '/statistics'),
  listZones: () => pdnsRequest<unknown[]>('GET', '/zones'),
  getZone: (id: string) => pdnsRequest('GET', `/zones/${encodeURIComponent(id)}`),
  createZone: (data: unknown) => pdnsRequest('POST', '/zones', data),
  updateZone: (id: string, data: unknown) =>
    pdnsRequest('PUT', `/zones/${encodeURIComponent(id)}`, data),
  deleteZone: (id: string) => pdnsRequest('DELETE', `/zones/${encodeURIComponent(id)}`),
  rectifyZone: (id: string) =>
    pdnsRequest('PUT', `/zones/${encodeURIComponent(id)}/rectify`),
  patchZoneRRSets: (id: string, rrsets: unknown) =>
    pdnsRequest('PATCH', `/zones/${encodeURIComponent(id)}`, { rrsets }),
  flushCache: (domain?: string) => {
    const target = domain || '.';
    return pdnsRequest('PUT', `/cache/flush?domain=${encodeURIComponent(target)}`);
  },
  listCryptoKeys: (zoneId: string) =>
    pdnsRequest<unknown[]>('GET', `/zones/${encodeURIComponent(zoneId)}/cryptokeys`),
  createCryptoKey: (zoneId: string, data: unknown) =>
    pdnsRequest('POST', `/zones/${encodeURIComponent(zoneId)}/cryptokeys`, data),
  getCryptoKey: (zoneId: string, keyId: number) =>
    pdnsRequest('GET', `/zones/${encodeURIComponent(zoneId)}/cryptokeys/${keyId}`),
  deleteCryptoKey: (zoneId: string, keyId: number) =>
    pdnsRequest('DELETE', `/zones/${encodeURIComponent(zoneId)}/cryptokeys/${keyId}`),
  updateCryptoKey: (zoneId: string, keyId: number, data: unknown) =>
    pdnsRequest('PUT', `/zones/${encodeURIComponent(zoneId)}/cryptokeys/${keyId}`, data),

  // Zone actions
  axfrRetrieve: (id: string) =>
    pdnsRequest('PUT', `/zones/${encodeURIComponent(id)}/axfr-retrieve`),
  notifyZone: (id: string) =>
    pdnsRequest('PUT', `/zones/${encodeURIComponent(id)}/notify`),
  exportZone: (id: string) =>
    pdnsTextRequest('GET', `/zones/${encodeURIComponent(id)}/export`),

  // Metadata
  listMetadata: (zoneId: string) =>
    pdnsRequest<unknown[]>('GET', `/zones/${encodeURIComponent(zoneId)}/metadata`),
  createMetadata: (zoneId: string, data: unknown) =>
    pdnsRequest('POST', `/zones/${encodeURIComponent(zoneId)}/metadata`, data),
  getMetadata: (zoneId: string, kind: string) =>
    pdnsRequest('GET', `/zones/${encodeURIComponent(zoneId)}/metadata/${encodeURIComponent(kind)}`),
  updateMetadata: (zoneId: string, kind: string, data: unknown) =>
    pdnsRequest('PUT', `/zones/${encodeURIComponent(zoneId)}/metadata/${encodeURIComponent(kind)}`, data),
  deleteMetadata: (zoneId: string, kind: string) =>
    pdnsRequest('DELETE', `/zones/${encodeURIComponent(zoneId)}/metadata/${encodeURIComponent(kind)}`),

  // TSIG Keys
  listTsigKeys: () =>
    pdnsRequest<unknown[]>('GET', '/tsigkeys'),
  createTsigKey: (data: unknown) =>
    pdnsRequest('POST', '/tsigkeys', data),
  getTsigKey: (id: string) =>
    pdnsRequest('GET', `/tsigkeys/${encodeURIComponent(id)}`),
  updateTsigKey: (id: string, data: unknown) =>
    pdnsRequest('PUT', `/tsigkeys/${encodeURIComponent(id)}`, data),
  deleteTsigKey: (id: string) =>
    pdnsRequest('DELETE', `/tsigkeys/${encodeURIComponent(id)}`),

  // Autoprimaries
  listAutoprimaries: () =>
    pdnsRequest<unknown[]>('GET', '/autoprimaries'),
  createAutoprimary: (data: unknown) =>
    pdnsRequest('POST', '/autoprimaries', data),
  deleteAutoprimary: (ip: string, nameserver: string) =>
    pdnsRequest('DELETE', `/autoprimaries/${encodeURIComponent(ip)}/${encodeURIComponent(nameserver)}`),

  // Search
  searchData: (q: string, max?: number, objectType?: string) => {
    // PowerDNS requires wildcards for partial matching
    const query = q.includes('*') ? q : `*${q}*`;
    const params = new URLSearchParams({ q: query, max: String(max ?? 100) });
    if (objectType && objectType !== 'all') params.set('object_type', objectType);
    return pdnsRequest<unknown[]>('GET', `/search-data?${params.toString()}`);
  },
};
