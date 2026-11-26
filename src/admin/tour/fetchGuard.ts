import { decide, refusalResponse } from '../../club/onboarding/guard';
import type { FlowId } from '../../club/onboarding/flows';

type Fetch = typeof window.fetch;

function methodAndUrl(input: RequestInfo | URL, init?: RequestInit): { method: string; url: string } {
  const isReq = typeof Request !== 'undefined' && input instanceof Request;
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = init?.method ?? (isReq ? input.method : undefined) ?? 'GET';
  return { method: method || 'GET', url };
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function route(flow: FlowId, original: Fetch, life: { active: boolean }): Fetch {
  return (input, init) => {
    if (!life.active) return original(input, init);
    try {
      const d = decide(methodAndUrl(input, init), flow, undefined, window.location.origin);
      if (d.kind === 'pass') return original(input, init);
      if (d.kind === 'fixture') return Promise.resolve(json(200, d.body));
    } catch {
      // Anything unclear is refused, never sent.
    }
    const r = refusalResponse();
    return Promise.resolve(json(r.status, r.body));
  };
}

let restore: (() => void) | null = null;
/** Per install; `active` goes false on uninstall, so a wrapper that could not be taken off (something wrapped fetch after it) just delegates. */
let life: { active: boolean } | null = null;

/** Puts the guard in front of window.fetch for `flow`: fixtures for reads, refusal for writes. Replaces a guard already installed. */
export function installFetchGuard(flow: FlowId): void {
  uninstallFetchGuard();
  const original = window.fetch;
  const mine = { active: true };
  life = mine;
  window.fetch = route(flow, original.bind(window), mine);
  const guarded = window.fetch;
  restore = () => {
    if (window.fetch === guarded) window.fetch = original;
  };
}

/** Puts the original fetch back; safe to call when nothing is installed. */
export function uninstallFetchGuard(): void {
  if (life) life.active = false;
  life = null;
  restore?.();
  restore = null;
}
