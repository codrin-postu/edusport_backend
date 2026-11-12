/**
 * Server-side client for the skate-results API. Every call is bounded (3 s,
 * 2 MB), carries the shared key only when one is configured, and never logs or
 * echoes it. Failures are values (`down` / `not_found`), never thrown.
 */

const DEFAULT_BASE = 'https://skate-api.codrin.space';
const TIMEOUT_MS = 3000;
const MAX_BYTES = 2 * 1024 * 1024;

export function base(env: NodeJS.ProcessEnv = process.env): string {
  return (env.SKATE_RESULTS_API || DEFAULT_BASE).replace(/\/+$/, '');
}

/** Request headers for skate-results: the shared key is attached only when set. */
export function keyHeaders(
  extra: Record<string, string> = {},
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const headers: Record<string, string> = { accept: 'application/json', ...extra };
  const key = env.SKATE_RESULTS_API_KEY;
  if (key) headers['X-API-Key'] = key;
  return headers;
}

type Segment = { segment: string; is_short: boolean; tss: number | null; tes: number | null; pcs: number | null; deductions: number | null };
export type SkateResult = {
  result_id: number | null;
  placement: number | null;
  event_id: number;
  event_slug: string | null;
  event_name: string;
  event_date: string | null;
  event_location: string | null;
  category: string;
  total_score: number | null;
  short_score: number | null;
  free_score: number | null;
  segments: Segment[];
};
export type SkateProtocol = {
  result_id: number;
  segments: (Segment & { elements: { name: string; base_value: number | null; score: number | null }[] })[];
};
export type Fetched<T> = { ok: true; value: T } | { ok: false; reason: 'down' | 'not_found' };
export interface SkateClient {
  results(slug: string): Promise<Fetched<SkateResult[]>>;
  protocol(resultId: number): Promise<Fetched<SkateProtocol>>;
  fieldSize(eventId: number, category: string): Promise<Fetched<number>>;
  officialUrl(eventId: number, name: string): Promise<Fetched<string | null>>;
}

const DOWN = { ok: false, reason: 'down' } as const;
const NOT_FOUND = { ok: false, reason: 'not_found' } as const;
const fail = (reason: 'down' | 'not_found'): { ok: false; reason: 'down' | 'not_found' } => ({ ok: false, reason });

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const rec = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

function segment(raw: unknown): Segment | null {
  const s = rec(raw);
  if (!s || typeof s.segment !== 'string') return null;
  return {
    segment: s.segment,
    is_short: s.is_short === true,
    tss: num(s.tss),
    tes: num(s.tes),
    pcs: num(s.pcs),
    deductions: num(s.deductions),
  };
}

function result(raw: unknown): SkateResult | null {
  const r = rec(raw);
  if (!r || typeof r.event_id !== 'number' || typeof r.event_name !== 'string' || typeof r.category !== 'string') return null;
  const segs = Array.isArray(r.segments) ? r.segments : [];
  return {
    result_id: num(r.result_id),
    placement: num(r.placement),
    event_id: r.event_id,
    event_slug: str(r.event_slug),
    event_name: r.event_name,
    event_date: str(r.event_date),
    event_location: str(r.event_location),
    category: r.category,
    total_score: num(r.total_score),
    short_score: num(r.short_score),
    free_score: num(r.free_score),
    segments: segs.map(segment).filter((s): s is Segment => s !== null),
  };
}

async function readCapped(res: Response): Promise<string | null> {
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BYTES) return null;
  if (!res.body) {
    const text = await res.text();
    return text.length > MAX_BYTES ? null : text;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const validId = (id: number) => Number.isSafeInteger(id) && id > 0;

export function skateClient(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = TIMEOUT_MS,
): SkateClient {
  async function get(path: string): Promise<Fetched<unknown>> {
    try {
      const res = await fetchImpl(`${base(env)}${path}`, {
        headers: keyHeaders({}, env),
        signal: AbortSignal.timeout(timeoutMs),
        // The key must never follow a redirect to another host.
        redirect: 'manual',
      });
      if (res.status === 404) return NOT_FOUND;
      if (res.status >= 300 && res.status < 400) return DOWN;
      if (res.type === 'opaqueredirect') return DOWN;
      if (!res.ok) return DOWN;
      const text = await readCapped(res);
      if (text === null) return DOWN;
      return { ok: true, value: JSON.parse(text) };
    } catch {
      return DOWN;
    }
  }

  return {
    async results(slug) {
      if (!SLUG.test(slug)) return NOT_FOUND;
      const got = await get(`/skaters/${encodeURIComponent(slug)}/results?segments=summary`);
      if ('reason' in got) return fail(got.reason);
      if (!Array.isArray(got.value)) return DOWN;
      return { ok: true, value: got.value.map(result).filter((r): r is SkateResult => r !== null) };
    },

    async protocol(resultId) {
      if (!validId(resultId)) return NOT_FOUND;
      const got = await get(`/results/${encodeURIComponent(String(resultId))}/protocol`);
      if ('reason' in got) return fail(got.reason);
      const p = rec(got.value);
      if (!p || typeof p.result_id !== 'number' || !Array.isArray(p.segments)) return DOWN;
      const segments: SkateProtocol['segments'] = [];
      for (const raw of p.segments) {
        const base = segment(raw);
        if (!base) continue;
        const elements = Array.isArray(rec(raw)?.elements) ? (rec(raw)!.elements as unknown[]) : [];
        segments.push({
          ...base,
          elements: elements.flatMap((e) => {
            const el = rec(e);
            return el && typeof el.name === 'string'
              ? [{ name: el.name, base_value: num(el.base_value), score: num(el.score) }]
              : [];
          }),
        });
      }
      return { ok: true, value: { result_id: p.result_id, segments } };
    },

    async fieldSize(eventId, category) {
      if (!validId(eventId)) return NOT_FOUND;
      // The response lists every skater in the competition. Only a count leaves
      // this function: no other skater's name, id or score is kept.
      const got = await get(`/events/${encodeURIComponent(String(eventId))}/results?segments=none`);
      if ('reason' in got) return fail(got.reason);
      if (!Array.isArray(got.value)) return DOWN;
      let count = 0;
      for (const row of got.value) if (rec(row)?.category === category) count += 1;
      return { ok: true, value: count };
    },

    async officialUrl(eventId, name) {
      if (!validId(eventId)) return NOT_FOUND;
      const got = await get(`/events?q=${encodeURIComponent(name)}&limit=20`);
      if ('reason' in got) return fail(got.reason);
      if (!Array.isArray(got.value)) return DOWN;
      const row = got.value.map(rec).find((r) => r?.id === eventId);
      return { ok: true, value: str(row?.source_url) };
    },
  };
}
