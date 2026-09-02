/**
 * Dashboard data proxies for the admin landing page.
 *
 * These endpoints let the admin UI show analytics + error-tracking summaries
 * without ever exposing third-party credentials to the browser: the Strapi
 * server holds the keys (env only) and returns a small compact payload. Both
 * are admin-guarded (see routes) and CACHED.
 *
 * Every response carries a `state`:
 *
 *   'ok'              data is present
 *   'not_configured'  the env vars for this service are unset
 *   'error'           configured, but the service did not answer usefully
 *
 * The distinction matters. This used to be a single `connected: false` for all
 * eight failure paths, so a dead service rendered as "not set up yet" and, on
 * the health card, an unreachable GlitchTip was indistinguishable from a site
 * with no errors. Never report health as good when we simply could not ask.
 *
 * Analytics source: the self-hosted Umami instance. Errors: self-hosted GlitchTip.
 */

type State = 'ok' | 'not_configured' | 'error';
type Payload = Record<string, unknown> & { state: State };

type Cached = { t: number; v: Payload };
const CACHE = new Map<string, Cached>();
const TTL_MS = 5 * 60 * 1000;

/**
 * Only successful payloads are cached. Caching a failure would pin a transient
 * blip on the card for the full TTL, long after the service came back.
 */
async function withCache(key: string, fn: () => Promise<Payload>): Promise<Payload> {
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.t < TTL_MS) return hit.v;
  const v = await fn();
  if (v.state === 'ok') CACHE.set(key, { t: Date.now(), v });
  return v;
}

/** Trim a trailing slash so we can concatenate paths safely. */
const trimSlash = (s: string) => s.replace(/\/$/, '');

/** Browser-reachable service address, if configured. Never the internal one. */
function publicUrl(name: 'UMAMI_PUBLIC_URL' | 'GLITCHTIP_PUBLIC_URL'): string | null {
  const v = process.env[name];
  return v ? trimSlash(v) : null;
}

/**
 * Umami traffic for the current calendar month, plus the previous month for
 * comparison, a daily series, and the most visited paths.
 *
 * Env: UMAMI_API_URL, UMAMI_WEBSITE_ID, UMAMI_USERNAME, UMAMI_PASSWORD.
 * Optional: UMAMI_PUBLIC_URL for the "open Umami" link.
 */
async function fetchUmami(): Promise<Payload> {
  const base = process.env.UMAMI_API_URL;
  const websiteId = process.env.UMAMI_WEBSITE_ID;
  const username = process.env.UMAMI_USERNAME;
  const password = process.env.UMAMI_PASSWORD;
  if (!base || !websiteId || !username || !password) return { state: 'not_configured' };

  const root = trimSlash(base);
  const loginRes = await fetch(`${root}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!loginRes.ok) return { state: 'error' };
  const token = ((await loginRes.json()) as any)?.token;
  if (!token) return { state: 'error' };
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEnd = monthStart.getTime() - 1;

  const site = encodeURIComponent(websiteId);
  const stats = (startAt: number, endAt: number) =>
    fetch(`${root}/api/websites/${site}/stats?startAt=${startAt}&endAt=${endAt}`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

  const [thisMonth, lastMonth, daily, paths] = await Promise.all([
    stats(monthStart.getTime(), now.getTime()),
    stats(prevStart.getTime(), prevEnd),
    fetch(
      `${root}/api/websites/${site}/pageviews?startAt=${monthStart.getTime()}&endAt=${now.getTime()}`
        + `&unit=day&timezone=${encodeURIComponent('Europe/Bucharest')}`,
      { headers },
    ).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(
      `${root}/api/websites/${site}/metrics?startAt=${monthStart.getTime()}&endAt=${now.getTime()}&type=path`,
      { headers },
    ).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);

  // The one call the card cannot do without.
  if (!thisMonth) return { state: 'error' };

  // Umami changed this shape between majors: 2.x returned { visitors: { value,
  // prev } }, 3.x (3.3.1 here) returns a flat number plus a `comparison`
  // object. Reading only `.value` silently produced 0 on 3.x. Handle both.
  const readNum = (s: any, key: string): number => {
    const v = s?.[key];
    if (typeof v === 'number') return v;
    return Number(v?.value ?? 0);
  };

  const visitors = readNum(thisMonth, 'visitors');
  const prevVisitors = readNum(lastMonth, 'visitors');
  const trendPct = prevVisitors > 0
    ? Math.round(((visitors - prevVisitors) / prevVisitors) * 100)
    : null;

  // `sessions` is the visits series; `pageviews` is the hits series. The card
  // plots visits, matching the headline number.
  //
  // Umami omits days with no traffic rather than returning a zero, so the raw
  // array is not one entry per day. Plotting it directly would space the points
  // evenly and silently compress quiet stretches, making a gap look like
  // steady traffic. Expand it into one bucket per elapsed day of the month.
  const dailyBody = daily as { sessions?: Array<{ x: string; y: number }> } | null;
  const buckets: Array<{ x: string; y: number }> = Array.isArray(dailyBody?.sessions)
    ? dailyBody!.sessions!
    : [];
  const byDay = new Map<string, number>();
  for (const b of buckets) {
    // Values look like "2026-09-02 00:00:00"; the date half is the key.
    const key = String(b?.x ?? '').slice(0, 10);
    if (key) byDay.set(key, (byDay.get(key) ?? 0) + Number(b?.y ?? 0));
  }
  const series: number[] = [];
  for (let d = new Date(monthStart); d <= now; d.setDate(d.getDate() + 1)) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    series.push(byDay.get(key) ?? 0);
  }

  const topPaths = (Array.isArray(paths) ? paths : [])
    .slice(0, 3)
    .map((p: any) => ({ path: String(p?.x ?? ''), count: Number(p?.y ?? 0) }));

  return {
    state: 'ok',
    visitors,
    prevVisitors,
    trendPct,
    pageviews: readNum(thisMonth, 'pageviews'),
    series,
    monthStart: monthStart.toISOString(),
    prevMonthStart: prevStart.toISOString(),
    topPaths,
    publicUrl: publicUrl('UMAMI_PUBLIC_URL'),
  };
}

/**
 * GlitchTip issues over the last 7 days, reduced to what the health card needs.
 *
 * Env: GLITCHTIP_API_URL, GLITCHTIP_API_TOKEN, GLITCHTIP_ORG (slug),
 * GLITCHTIP_PROJECT (slug). Optional: GLITCHTIP_PUBLIC_URL.
 *
 * On the daily bars: this counts ISSUES BY THEIR LAST OCCURRENCE, not the
 * number of times an error actually happened that day. An issue seen 40 times
 * on Monday and once on Friday contributes a single unit to Friday and nothing
 * to Monday. A faithful per-day count is not available here: the endpoint that
 * returns a time series answers but yields only nulls, the internal hourly
 * table it should read is not exposed, and the raw event list ignores its own
 * `start` filter and pages oldest-first. This approximation was chosen
 * deliberately over one that is exact but depends on GlitchTip's internal
 * cursor format. The UI labels the bars accordingly, so the shape is never
 * read as an occurrence count.
 */
async function fetchGlitchtip(): Promise<Payload> {
  const url = process.env.GLITCHTIP_API_URL;
  const token = process.env.GLITCHTIP_API_TOKEN;
  const org = process.env.GLITCHTIP_ORG;
  const project = process.env.GLITCHTIP_PROJECT;
  if (!url || !token || !org || !project) return { state: 'not_configured' };

  const DAY_MS = 24 * 60 * 60 * 1000;
  const since = new Date(Date.now() - 7 * DAY_MS).toISOString();

  // Bound the window with `start`, not a search query. GlitchTip does not
  // understand `lastSeen:>=<iso>` or `age:-24h` in `query`; both are accepted
  // and silently return nothing, which read as "no errors" rather than as a
  // broken filter. Verified against
  // /api/0/projects/{org}/{project}/issues/: `start` in the future returns 0,
  // so it really filters. (The per-EVENT endpoint ignores `start` entirely,
  // which is why this reads issues.)
  const LIMIT = 100;
  const endpoint = `${trimSlash(url)}/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/issues/`
    + `?start=${encodeURIComponent(since)}&limit=${LIMIT}`;

  const res = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) return { state: 'error' };
  const json: any = await res.json();
  const raw = Array.isArray(json) ? json : json?.data;
  if (!Array.isArray(raw)) return { state: 'error' };

  const pub = publicUrl('GLITCHTIP_PUBLIC_URL');
  // GlitchTip builds `permalink` from its own configured base, which is the
  // internal host in our compose setup. Re-point it at the public origin when
  // we know one, so the link works from a browser.
  const rehost = (link: string): string => {
    if (!pub || !link) return link;
    try {
      const u = new URL(link);
      return pub + u.pathname + u.search;
    } catch {
      return link;
    }
  };

  // Belt and braces: if a future GlitchTip ignores `start` the way it ignores
  // the query syntax, this would quietly become "all issues ever".
  const weekCutoff = Date.now() - 7 * DAY_MS;
  const dayCutoff = Date.now() - DAY_MS;
  const seen = (i: any): number => Date.parse(i?.lastSeen ?? '');

  const week = raw.filter((i: any) => {
    const t = seen(i);
    return Number.isNaN(t) ? false : t >= weekCutoff;
  });
  const recent = week.filter((i: any) => seen(i) >= dayCutoff);

  // Seven buckets, oldest first, keyed by local calendar day.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, idx) => {
    const from = startOfToday.getTime() - (6 - idx) * DAY_MS;
    const to = from + DAY_MS;
    return {
      date: new Date(from).toISOString(),
      count: week.filter((i: any) => {
        const t = seen(i);
        return t >= from && t < to;
      }).length,
    };
  });

  const issues = [...week]
    .sort((a: any, b: any) => seen(b) - seen(a))
    .slice(0, 3)
    .map((i: any) => ({
      id: String(i?.id ?? ''),
      title: String(i?.title ?? 'Eroare necunoscută'),
      shortId: String(i?.shortId ?? ''),
      level: String(i?.level ?? 'error'),
      // GlitchTip returns `count` as a STRING ("1"), so this must be cast
      // before it is ever compared or summed.
      count: Number(i?.count ?? 0),
      lastSeen: i?.lastSeen ?? null,
      permalink: rehost(String(i?.permalink ?? '')),
    }));

  return {
    state: 'ok',
    errors24h: recent.length,
    errors7d: week.length,
    days,
    issues,
    // `raw` hit the page size, so the counts above are a floor, not a total.
    capped: raw.length >= LIMIT,
    publicUrl: pub,
  };
}

export default {
  async analytics(ctx: any) {
    try {
      ctx.body = await withCache('umami', fetchUmami);
    } catch {
      ctx.body = { state: 'error' };
    }
  },
  async siteHealth(ctx: any) {
    try {
      ctx.body = await withCache('glitchtip', fetchGlitchtip);
    } catch {
      ctx.body = { state: 'error' };
    }
  },
};
