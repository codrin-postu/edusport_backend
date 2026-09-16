/**
 * Per-announcement engagement numbers, read from the self-hosted Umami.
 *
 * The site fires three custom events, each carrying the announcement's slug in
 * an `id` property:
 *
 *   announcement.view     the announcement was rendered
 *   announcement.click    the CTA was followed
 *   announcement.dismiss  the visitor closed it
 *
 * Umami aggregates those for us:
 *
 *   GET /api/websites/{websiteId}/event-data/values
 *       ?eventName=announcement.view&propertyName=id&startAt=<ms>&endAt=<ms>
 *   -> [{ "value": "<slug>", "total": 12 }, ...]
 *
 * That path and its parameter names were verified against the running instance
 * (http://localhost:3001): it answers 200 with exactly that shape — confirmed
 * with a property that has data (`contact.submit` / `reason` ->
 * `[{"value":"partenariat","total":1}]`) and with an empty `[]` for the
 * announcement events, which have no traffic yet.
 *
 * The login + `state` handling below is a deliberate small copy of
 * `src/api/dashboard/controllers/dashboard.ts` `fetchUmami()` rather than an
 * extraction: that function is one long routine that also builds the dashboard
 * card's month-over-month payload, and pulling a shared helper out of it would
 * mean editing a working, load-bearing endpoint for no behavioural gain here.
 * If a third consumer appears, extract the session helper from both at once.
 *
 * Every failure path is soft: the admin page must still list announcements when
 * analytics is down, so stats come back `null` and the caller renders the
 * matching `umami` state.
 */

export type UmamiState = 'ok' | 'not_configured' | 'error';

export interface AnnouncementStats {
  views: number;
  clicks: number;
  dismisses: number;
  /** clicks / views, or 0 when nothing was ever shown. */
  ctr: number;
}

export interface StatsResult {
  state: UmamiState;
  /** slug -> stats. Empty when state is not 'ok'. */
  bySlug: Map<string, AnnouncementStats>;
}

/** Same 5-minute window the dashboard proxies use. */
const TTL_MS = 5 * 60 * 1000;
/** How far back to count. Announcements are short-lived; a year is plenty. */
const WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

let cache: { t: number; v: StatsResult } | null = null;

const trimSlash = (s: string) => s.replace(/\/$/, '');

type ValueRow = { value?: unknown; total?: unknown };

/** Reads one event's per-slug counts. Returns null when the call failed. */
async function eventValues(
  root: string,
  site: string,
  headers: Record<string, string>,
  eventName: string,
  startAt: number,
  endAt: number,
): Promise<Map<string, number> | null> {
  const url =
    `${root}/api/websites/${site}/event-data/values` +
    `?eventName=${encodeURIComponent(eventName)}&propertyName=id` +
    `&startAt=${startAt}&endAt=${endAt}`;
  const body = await fetch(url, { headers })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  if (!Array.isArray(body)) return null;

  const out = new Map<string, number>();
  for (const row of body as ValueRow[]) {
    const slug = String(row?.value ?? '').trim();
    if (!slug) continue;
    out.set(slug, (out.get(slug) ?? 0) + Number(row?.total ?? 0));
  }
  return out;
}

async function fetchStats(): Promise<StatsResult> {
  const base = process.env.UMAMI_API_URL;
  const websiteId = process.env.UMAMI_WEBSITE_ID;
  const username = process.env.UMAMI_USERNAME;
  const password = process.env.UMAMI_PASSWORD;
  if (!base || !websiteId || !username || !password) {
    return { state: 'not_configured', bySlug: new Map() };
  }

  const root = trimSlash(base);
  const loginRes = await fetch(`${root}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!loginRes.ok) return { state: 'error', bySlug: new Map() };
  const token = ((await loginRes.json()) as any)?.token;
  if (!token) return { state: 'error', bySlug: new Map() };

  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const site = encodeURIComponent(websiteId);
  const endAt = Date.now();
  const startAt = endAt - WINDOW_MS;

  const [views, clicks, dismisses] = await Promise.all([
    eventValues(root, site, headers, 'announcement.view', startAt, endAt),
    eventValues(root, site, headers, 'announcement.click', startAt, endAt),
    eventValues(root, site, headers, 'announcement.dismiss', startAt, endAt),
  ]);

  // A single failed sub-query would silently read as "zero engagement", which is
  // worse than saying we could not ask.
  if (!views || !clicks || !dismisses) return { state: 'error', bySlug: new Map() };

  const bySlug = new Map<string, AnnouncementStats>();
  for (const slug of new Set([...views.keys(), ...clicks.keys(), ...dismisses.keys()])) {
    const v = views.get(slug) ?? 0;
    const c = clicks.get(slug) ?? 0;
    bySlug.set(slug, {
      views: v,
      clicks: c,
      dismisses: dismisses.get(slug) ?? 0,
      ctr: v > 0 ? c / v : 0,
    });
  }
  return { state: 'ok', bySlug };
}

/**
 * Cached entry point. Only successful reads are cached, so a transient Umami
 * blip is not pinned to the admin page for the full TTL.
 */
export async function getAnnouncementStats(): Promise<StatsResult> {
  if (cache && Date.now() - cache.t < TTL_MS) return cache.v;
  try {
    const v = await fetchStats();
    if (v.state === 'ok') cache = { t: Date.now(), v };
    return v;
  } catch {
    return { state: 'error', bySlug: new Map() };
  }
}
