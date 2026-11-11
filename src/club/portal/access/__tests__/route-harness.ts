import type { AdminCtx } from '../../../admin-http';

type Route = { method: string; path: string; handler: string };
type Controller = Record<string, (ctx: AdminCtx) => Promise<unknown>>;
export type Reply = { status: number; body: unknown; handler: string; params: Record<string, string | undefined> };

const patternOf = (path: string): RegExp => new RegExp(`^${path.replace(/:[A-Za-z]+/g, '([^/]+)')}$`);
const namesOf = (path: string): string[] => [...path.matchAll(/:([A-Za-z]+)/g)].map((m) => m[1]);

/**
 * A request as Strapi's router would serve it: the first declared route that matches the method and the path is the handler, and the
 * controller runs with the Koa context it would get. A path no route matches answers 404 with no handler.
 */
export async function dispatch(routes: Route[], controllers: Record<string, Controller>, method: string, url: string, body: unknown = {}): Promise<Reply> {
  for (const r of routes) {
    const m = r.method === method ? patternOf(r.path).exec(url) : null;
    if (!m) continue;
    const params = Object.fromEntries(namesOf(r.path).map((n, i) => [n, m[i + 1]]));
    const ctx: AdminCtx = { params, query: {}, request: { body, header: {} }, status: 200, body: undefined };
    const [name, fn] = r.handler.split('.');
    await controllers[name][fn](ctx);
    return { status: ctx.status, body: ctx.body, handler: r.handler, params };
  }
  return { status: 404, body: null, handler: '', params: {} };
}
