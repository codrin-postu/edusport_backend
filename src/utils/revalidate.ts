/**
 * Fire-and-forget ping to the frontend's on-demand revalidation endpoint
 * (see edusport_frontend/src/app/api/revalidate/route.ts). Called after any
 * write to a content type whose data is baked into statically-rendered
 * pages, so editors see their change without waiting for the page's own
 * cache TTL to expire.
 *
 * Never throws: a failed ping only means the frontend serves stale content
 * until its TTL elapses, which must never fail the CMS write that triggered
 * it.
 *
 * Env vars (see .env.example):
 *   REVALIDATE_FRONTEND_URL  base URL of the frontend, e.g. https://scoaladepatinaj.com
 *                            (falls back to FRONTEND_ORIGIN, already used for CORS)
 *   REVALIDATE_SECRET        must match the frontend's REVALIDATE_SECRET
 */
export async function pingRevalidate(tag?: string): Promise<void> {
  const base = process.env.REVALIDATE_FRONTEND_URL || process.env.FRONTEND_ORIGIN;
  const secret = process.env.REVALIDATE_SECRET;
  if (!base || !secret) return; // not configured (e.g. local dev) — silently skip

  const url = new URL('/api/revalidate', base);
  if (tag) url.searchParams.set('tag', tag);

  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'x-revalidate-secret': secret },
    });
    if (!res.ok) {
      strapi?.log?.warn?.(`[revalidate] frontend responded ${res.status} for ${url.pathname}${url.search}`);
    }
  } catch (err) {
    strapi?.log?.warn?.(`[revalidate] ping failed: ${(err as Error)?.message ?? err}`);
  }
}
