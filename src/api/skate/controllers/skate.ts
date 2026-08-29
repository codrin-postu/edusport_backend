/**
 * Proxy to the self-hosted skate-results API (skate-api.codrin.space).
 *
 * The Strapi admin runs in the browser and skate-results has no CORS, so the
 * admin never calls it directly. These content-api routes are auth-disabled but
 * guarded by `global::is-admin` (see routes), so only a logged-in CMS admin can
 * reach them. Used by the Sportiv editor to search for a skater and link the
 * chosen one's slug to the sportsperson record.
 */

const DEFAULT_BASE = 'https://skate-api.codrin.space';

function base(): string {
  return (process.env.SKATE_RESULTS_API || DEFAULT_BASE).replace(/\/+$/, '');
}

// Headers for mutating calls (import / delete): attach the shared API key so
// skate-results accepts the write. Reads don't need it.
function mutHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { accept: 'application/json', ...extra };
  const key = process.env.SKATE_RESULTS_API_KEY;
  if (key) headers['X-API-Key'] = key;
  return headers;
}

async function proxy(ctx: any, path: string) {
  try {
    const res = await fetch(`${base()}${path}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      ctx.status = res.status;
      ctx.body = { error: `skate-results returned ${res.status}` };
      return;
    }
    ctx.body = await res.json();
  } catch (err) {
    // Service unreachable: degrade to an empty result rather than a 500 so the
    // linker UI shows "no matches" instead of erroring.
    ctx.status = 200;
    ctx.body = ctx.state?.emptyOnError ?? { error: 'skate-results unreachable' };
  }
}

export default {
  async searchSkaters(ctx: any) {
    const q = typeof ctx.query.q === 'string' ? ctx.query.q : '';
    const limit = Math.min(Number(ctx.query.limit) || 20, 50);
    ctx.state = { emptyOnError: [] };
    await proxy(ctx, `/skaters?q=${encodeURIComponent(q)}&limit=${limit}`);
  },

  async getSkater(ctx: any) {
    const slug = encodeURIComponent(ctx.params.slug);
    await proxy(ctx, `/skaters/${slug}`);
  },

  async skaterResults(ctx: any) {
    const slug = encodeURIComponent(ctx.params.slug);
    ctx.state = { emptyOnError: [] };
    await proxy(ctx, `/skaters/${slug}/results`);
  },

  // List / search the competitions already ingested into skate-results.
  async listEvents(ctx: any) {
    const q = typeof ctx.query.q === 'string' ? ctx.query.q : '';
    ctx.state = { emptyOnError: [] };
    await proxy(ctx, `/events?q=${encodeURIComponent(q)}&limit=100`);
  },

  // Full results for one competition (every category/skater). The admin UI
  // filters these down to the club's linked athletes.
  async eventResults(ctx: any) {
    const id = encodeURIComponent(ctx.params.id);
    ctx.state = { emptyOnError: [] };
    await proxy(ctx, `/events/${id}/results`);
  },

  // Scrape a full competition from rinkresults by id (any country).
  async importCompetitionById(ctx: any) {
    const body = (ctx.request?.body ?? {}) as {
      competition_id?: string;
      event_date?: string;
      city?: string;
    };
    try {
      const res = await fetch(`${base()}/import-competition`, {
        method: 'POST',
        headers: mutHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify({
          competition_id: body.competition_id,
          event_date: body.event_date,
          city: body.city,
        }),
      });
      ctx.status = res.status;
      ctx.body = await res.json();
    } catch {
      ctx.status = 502;
      ctx.body = { error: 'skate-results unreachable' };
    }
  },

  // Discovery: a skater's competition list from rinkresults (no scraping).
  // The admin then imports each competition officially by name.
  async skaterCompetitions(ctx: any) {
    const body = (ctx.request?.body ?? {}) as { name?: string; rinkresults_id?: string };
    try {
      const res = await fetch(`${base()}/skater-competitions`, {
        method: 'POST',
        headers: mutHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify({ name: body.name, rinkresults_id: body.rinkresults_id }),
      });
      ctx.status = res.status;
      ctx.body = await res.json();
    } catch {
      ctx.status = 502;
      ctx.body = { error: 'skate-results unreachable' };
    }
  },

  // Import a skater's full competition history from the rinkresults person
  // index and attach it to the linked skate-results skater (by slug).
  async importSkater(ctx: any) {
    const body = (ctx.request?.body ?? {}) as {
      name?: string;
      rinkresults_id?: string;
      slug?: string;
    };
    try {
      const res = await fetch(`${base()}/import-skater`, {
        method: 'POST',
        headers: mutHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify({
          name: body.name,
          rinkresults_id: body.rinkresults_id,
          slug: body.slug,
        }),
      });
      ctx.status = res.status;
      ctx.body = await res.json();
    } catch {
      ctx.status = 502;
      ctx.body = { error: 'skate-results unreachable' };
    }
  },

  // Remove an imported competition from skate-results (cascades its results).
  async deleteEvent(ctx: any) {
    const id = encodeURIComponent(ctx.params.id);
    try {
      const res = await fetch(`${base()}/events/${id}`, {
        method: 'DELETE',
        headers: mutHeaders(),
      });
      ctx.status = res.status;
      ctx.body = await res.json();
    } catch {
      ctx.status = 502;
      ctx.body = { error: 'skate-results unreachable' };
    }
  },

  // Trigger an import: resolve a competition name to its results page and
  // scrape it (or scrape a direct URL). Forwards the admin's {query|url}.
  async importCompetition(ctx: any) {
    const body = (ctx.request?.body ?? {}) as {
      query?: string;
      url?: string;
      preview?: boolean;
    };
    try {
      const res = await fetch(`${base()}/import`, {
        method: 'POST',
        headers: mutHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify({ query: body.query, url: body.url, preview: !!body.preview }),
      });
      ctx.status = res.status;
      ctx.body = await res.json();
    } catch {
      ctx.status = 502;
      ctx.body = { error: 'skate-results unreachable' };
    }
  },
};
