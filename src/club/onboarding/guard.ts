import { FIXTURES } from './fixtures';
import type { FlowId } from './flows';

export type Decision = { kind: 'pass' } | { kind: 'refuse' } | { kind: 'fixture'; body: unknown };

const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/** Fixtures match against the path plus query as the page requests it, whether `url` is absolute or relative. */
const pathAndQuery = (url: string): string => {
  const m = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*(.*)$/i.exec(url);
  return (m ? m[1] : url).replace(/#.*$/, '') || '/';
};

export function decide(req: { method: string; url: string }, flow: FlowId | null): Decision {
  if (flow === null) return { kind: 'pass' };
  const method = req.method.toUpperCase();
  if (!READ_METHODS.includes(method)) return { kind: 'refuse' };
  if (method !== 'GET') return { kind: 'pass' };
  const target = pathAndQuery(req.url);
  const hit = (FIXTURES[flow] ?? []).find((f) => f.match.test(target));
  return hit ? { kind: 'fixture', body: hit.body } : { kind: 'pass' };
}

export const refusalResponse = (): { status: 409; body: { error: { message: string } } } => ({
  status: 409,
  body: { error: { message: 'Exemplu: modificările nu se salvează' } },
});
