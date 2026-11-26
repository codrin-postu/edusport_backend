import { FIXTURES, type Fixture } from './fixtures';
import type { FlowId } from './flows';

export type Decision = { kind: 'pass' } | { kind: 'refuse' } | { kind: 'fixture'; body: unknown };

const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/** Fixtures match against the path plus query as the page requests it, whether `url` is absolute or relative. */
const pathAndQuery = (url: string): string => {
  const m = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*(.*)$/i.exec(url);
  return (m ? m[1] : url).replace(/#.*$/, '') || '/';
};

/** Writes a running flow must not block: the admin's own session upkeep (token refresh, logout) and the tour's progress post. */
const SESSION_WRITES = /(^|\/)(admin\/(access-token|renew-token|logout)|api\/club\/onboarding)\/?$/;

/** True when `url` goes to `origin` (the admin's own): relative urls always do, absolute ones only on the same scheme, host and port. */
export function isSameOrigin(url: string, origin: string): boolean {
  const m = /^(?:([a-z][a-z0-9+.-]*:)?\/\/)([^/?#]*)/i.exec(url);
  if (!m) return !/^[a-z][a-z0-9+.-]*:/i.test(url);
  const o = /^([a-z][a-z0-9+.-]*:)\/\/(.*)$/i.exec(origin);
  if (!o) return true; // an origin it cannot read guards everything, never passes
  return (m[1] ?? o[1]).toLowerCase() === o[1].toLowerCase() && m[2].toLowerCase() === o[2].toLowerCase();
}

/** `origin` is the admin's own origin: with it, a request to another origin (GlitchTip, Umami) is never guarded. */
export function decide(
  req: { method: string; url: string },
  flow: FlowId | null,
  fixtures: Partial<Record<FlowId, Fixture[]>> = FIXTURES,
  origin?: string,
): Decision {
  if (flow === null) return { kind: 'pass' };
  if (origin !== undefined && !isSameOrigin(req.url, origin)) return { kind: 'pass' };
  const method = req.method.toUpperCase();
  if (!READ_METHODS.includes(method)) return SESSION_WRITES.test(pathAndQuery(req.url).replace(/\?.*$/, '')) ? { kind: 'pass' } : { kind: 'refuse' };
  if (method !== 'GET') return { kind: 'pass' };
  const target = pathAndQuery(req.url);
  const hit = (fixtures[flow] ?? []).find((f) => f.match.test(target));
  return hit ? { kind: 'fixture', body: hit.body } : { kind: 'pass' };
}

export const refusalResponse = (): { status: 409; body: { error: { message: string } } } => ({
  status: 409,
  body: { error: { message: 'Exemplu: modificările nu se salvează' } },
});
