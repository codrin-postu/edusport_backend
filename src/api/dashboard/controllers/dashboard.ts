/**
 * Dashboard data proxies for the admin landing page.
 *
 * These endpoints let the admin UI show analytics + error-tracking summaries
 * without ever exposing third-party credentials to the browser: the Strapi
 * server holds the keys (env only) and returns a small compact payload. Both
 * are admin-guarded (see routes) and CACHED. When their env is unset (or a call
 * fails) they return `{ connected: false }` so the dashboard cards degrade to a
 * clean "not connected" state instead of showing wrong data.
 *
 * Analytics source: the self-hosted Umami instance. Errors: self-hosted GlitchTip.
 */

type Cached = { t: number; v: unknown };
const CACHE = new Map<string, Cached>();
const TTL_MS = 5 * 60 * 1000;

async function withCache<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.t < TTL_MS) return hit.v as T;
  const v = await fn();
  CACHE.set(key, { t: Date.now(), v });
  return v;
}

/**
 * Umami monthly unique visitors (last 6 months). Env: UMAMI_API_URL,
 * UMAMI_WEBSITE_ID, UMAMI_USERNAME, UMAMI_PASSWORD. Logs in for a token, then
 * reads `visitors.value` from the /stats endpoint for each month range.
 * Returns { connected, visitors, trendPct, series }.
 */
async function fetchUmami(): Promise<Record<string, unknown>> {
  const base = process.env.UMAMI_API_URL;
  const websiteId = process.env.UMAMI_WEBSITE_ID;
  const username = process.env.UMAMI_USERNAME;
  const password = process.env.UMAMI_PASSWORD;
  if (!base || !websiteId || !username || !password) return { connected: false };

  const root = base.replace(/\/$/, '');
  const loginRes = await fetch(`${root}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!loginRes.ok) return { connected: false };
  const token = ((await loginRes.json()) as any)?.token;
  if (!token) return { connected: false };
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  // Last 6 calendar months as [startMs, endMs] ranges.
  const now = new Date();
  const ranges: Array<{ start: number; end: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() - 1;
    ranges.push({ start, end });
  }

  const stats = await Promise.all(ranges.map((r) =>
    fetch(`${root}/api/websites/${encodeURIComponent(websiteId)}/stats?startAt=${r.start}&endAt=${r.end}`, { headers })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null),
  ));
  if (stats.every((s) => s === null)) return { connected: false };

  const series = stats.map((s: any) => Number(s?.visitors?.value ?? 0));
  const visitors = series[series.length - 1] ?? 0;
  const prev = series.length >= 2 ? series[series.length - 2] : 0;
  const trendPct = prev > 0 ? Math.round(((visitors - prev) / prev) * 100) : 0;

  return { connected: true, visitors, trendPct, series };
}

/**
 * GlitchTip error count in the last 24h. Env: GLITCHTIP_API_URL,
 * GLITCHTIP_API_TOKEN, GLITCHTIP_ORG (slug), GLITCHTIP_PROJECT (slug).
 * Returns { connected, errors24h }.
 */
async function fetchGlitchtip(): Promise<Record<string, unknown>> {
  const url = process.env.GLITCHTIP_API_URL;
  const token = process.env.GLITCHTIP_API_TOKEN;
  const org = process.env.GLITCHTIP_ORG;
  const project = process.env.GLITCHTIP_PROJECT;
  if (!url || !token || !org || !project) return { connected: false };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  // GlitchTip is Sentry-API compatible. List issues seen in the last 24h.
  const endpoint = `${url.replace(/\/$/, '')}/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/issues/`
    + `?query=${encodeURIComponent(`lastSeen:>=${since}`)}&limit=100`;

  const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  if (!res.ok) return { connected: false };
  const json: any = await res.json();
  const issues = Array.isArray(json) ? json : json?.data ?? [];
  const errors24h = Array.isArray(issues) ? issues.length : 0;
  return { connected: true, errors24h };
}

export default {
  async analytics(ctx: any) {
    try {
      ctx.body = await withCache('umami', fetchUmami);
    } catch {
      ctx.body = { connected: false };
    }
  },
  async siteHealth(ctx: any) {
    try {
      ctx.body = await withCache('glitchtip', fetchGlitchtip);
    } catch {
      ctx.body = { connected: false };
    }
  },
};
