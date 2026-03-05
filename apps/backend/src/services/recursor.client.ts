const BASE_URL = (process.env.RECURSOR_URL ?? 'http://localhost:8082').replace(/\/$/, '');
const API_KEY = process.env.RECURSOR_API_KEY ?? '';
const API_PREFIX = '/api/v1/servers/localhost';

async function recursorRequest<T = unknown>(
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
    throw new Error(`Cannot reach PowerDNS Recursor at ${BASE_URL} — check RECURSOR_URL and that the server is running`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Recursor API error ${res.status}: ${text}`);
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return {} as T;
  }

  return res.json() as Promise<T>;
}

export const recursorClient = {
  getServerInfo: () => recursorRequest<unknown>('GET', ''),
  getStats: () => recursorRequest<unknown[]>('GET', '/statistics'),
  getCacheStats: () =>
    recursorRequest<unknown[]>('GET', '/statistics?statistic=cache-entries&statistic=cache-hits&statistic=cache-misses'),
  flushCache: (name?: string, subtree?: boolean) => {
    const target = name || '.';
    const params = new URLSearchParams({ domain: target });
    if (subtree) params.set('subtree', 'true');
    return recursorRequest('PUT', `/cache/flush?${params.toString()}`);
  },
  listForwarders: () => recursorRequest<unknown[]>('GET', '/zones'),
  getForwarder: (id: string) => recursorRequest<unknown>('GET', `/zones/${encodeURIComponent(id)}`),
  createForwarder: (data: unknown) => recursorRequest('POST', '/zones', data),
  updateForwarder: (id: string, data: unknown) =>
    recursorRequest('PUT', `/zones/${encodeURIComponent(id)}`, data),
  deleteForwarder: (id: string) =>
    recursorRequest('DELETE', `/zones/${encodeURIComponent(id)}`),
  getRpzStatistics: () => recursorRequest<unknown[]>('GET', '/rpzstatistics'),
  getConfig: () => recursorRequest<unknown[]>('GET', '/config'),
  getAllowFrom: () => recursorRequest<unknown>('GET', '/config/allow-from'),
  setAllowFrom: (value: string[]) =>
    recursorRequest('PATCH', '/config/allow-from', { name: 'allow-from', value }),
  getAllowNotifyFrom: () => recursorRequest<unknown>('GET', '/config/allow-notify-from'),
  setAllowNotifyFrom: (value: string[]) =>
    recursorRequest('PATCH', '/config/allow-notify-from', { name: 'allow-notify-from', value }),
};
