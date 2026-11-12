import { afterEach, describe, expect, it, vi } from 'vitest';
import { skateClient } from '../client';

const KEY = 'sekret-key-123';
const env = { SKATE_RESULTS_API: 'http://127.0.0.1:9/', SKATE_RESULTS_API_KEY: KEY } as unknown as NodeJS.ProcessEnv;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

type Call = { url: string; headers: Record<string, string> };
function stub(handler: (url: string) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    return handler(url);
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const spies = () =>
  (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('skate client', () => {
  it('encodes the slug and sends the key only when configured', async () => {
    const a = stub(() => json([]));
    await skateClient(env, a.fetchImpl).results('a b/c?d');
    expect(a.calls[0].url).toBe('http://127.0.0.1:9/skaters/a%20b%2Fc%3Fd/results?segments=summary');
    expect(a.calls[0].headers['X-API-Key']).toBe(KEY);

    const b = stub(() => json([]));
    await skateClient({ SKATE_RESULTS_API: 'http://127.0.0.1:9' } as unknown as NodeJS.ProcessEnv, b.fetchImpl).results('x');
    expect(b.calls[0].headers['X-API-Key']).toBeUndefined();
  });

  it('maps a result and drops fields it does not need', async () => {
    const { fetchImpl } = stub(() =>
      json([
        {
          result_id: 5, placement: 2, event_id: 9, event_slug: 's', event_name: 'Cup', event_date: '2026-01-01',
          event_location: 'Cluj', category: 'Junior', total_score: 100.5, short_score: 40, free_score: 60.5, club: 'X',
          segments: [{ segment: 'Short', is_short: true, placement: 1, tss: 40, tes: 22, pcs: 18, deductions: 0, components: { a: 1 } }],
        },
      ]),
    );
    const r = await skateClient(env, fetchImpl).results('s');
    expect(r).toEqual({
      ok: true,
      value: [
        {
          result_id: 5, placement: 2, event_id: 9, event_slug: 's', event_name: 'Cup', event_date: '2026-01-01',
          event_location: 'Cluj', category: 'Junior', total_score: 100.5, short_score: 40, free_score: 60.5,
          segments: [{ segment: 'Short', is_short: true, tss: 40, tes: 22, pcs: 18, deductions: 0 }],
        },
      ],
    });
  });

  it('maps 404 to not_found', async () => {
    const { fetchImpl } = stub(() => json({}, 404));
    expect(await skateClient(env, fetchImpl).results('x')).toEqual({ ok: false, reason: 'not_found' });
    expect(await skateClient(env, fetchImpl).protocol(1)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('maps 500, a network error, bad JSON and a non-array to down', async () => {
    expect(await skateClient(env, stub(() => json({}, 500)).fetchImpl).results('x')).toEqual({ ok: false, reason: 'down' });
    const boom = (async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    expect(await skateClient(env, boom).results('x')).toEqual({ ok: false, reason: 'down' });
    expect(await skateClient(env, stub(() => new Response('<html>')).fetchImpl).results('x')).toEqual({ ok: false, reason: 'down' });
    expect(await skateClient(env, stub(() => json({ a: 1 })).fetchImpl).results('x')).toEqual({ ok: false, reason: 'down' });
  });

  it('gives up after 3000 ms', async () => {
    vi.useFakeTimers();
    const slow = ((_url: string, init?: RequestInit) =>
      new Promise((_res, rej) => {
        init?.signal?.addEventListener('abort', () => rej(new Error('aborted')));
      })) as unknown as typeof fetch;
    const p = skateClient(env, slow).results('x');
    await vi.advanceTimersByTimeAsync(3001);
    expect(await p).toEqual({ ok: false, reason: 'down' });
  });

  it('treats a body over 2 MB as down', async () => {
    const big = JSON.stringify([{ pad: 'x'.repeat(2 * 1024 * 1024 + 10) }]);
    expect(await skateClient(env, stub(() => new Response(big)).fetchImpl).results('x')).toEqual({ ok: false, reason: 'down' });
  });

  it('maps a protocol to segments and elements only', async () => {
    const { fetchImpl } = stub(() =>
      json({
        result_id: 5, skater_name: 'Ana', segments: [
          { segment: 'Free', is_short: false, tss: 60, tes: 30, pcs: 30, deductions: 1, components: [], elements: [{ order: 1, name: '3T', base_value: 4.2, goe: 0.5, judges: [1], score: 4.7 }] },
        ],
      }),
    );
    expect(await skateClient(env, fetchImpl).protocol(5)).toEqual({
      ok: true,
      value: { result_id: 5, segments: [{ segment: 'Free', is_short: false, tss: 60, tes: 30, pcs: 30, deductions: 1, elements: [{ name: '3T', base_value: 4.2, score: 4.7 }] }] },
    });
  });

  it('fieldSize returns a plain number with no names', async () => {
    const rows = [
      { skater_id: 1, skater_name: 'Ana', category: 'Junior', total_score: 90 },
      { skater_id: 2, skater_name: 'Bia', category: 'Junior', total_score: 80 },
      { skater_id: 3, skater_name: 'Cia', category: 'Senior', total_score: 70 },
    ];
    const { calls, fetchImpl } = stub(() => json(rows));
    const r = await skateClient(env, fetchImpl).fieldSize(9, 'Junior');
    expect(r).toEqual({ ok: true, value: 2 });
    expect(JSON.stringify(r)).not.toMatch(/Ana|Bia|Cia/);
    expect(calls[0].url).toBe('http://127.0.0.1:9/events/9/results?segments=none');
  });

  it('officialUrl picks the row with the id', async () => {
    const { calls, fetchImpl } = stub(() =>
      json([{ id: 1, source_url: 'https://a' }, { id: 2, source_url: 'https://b' }, { id: 3, source_url: null }]),
    );
    const c = skateClient(env, fetchImpl);
    expect(await c.officialUrl(2, 'Cupa Mare')).toEqual({ ok: true, value: 'https://b' });
    expect(calls[0].url).toBe('http://127.0.0.1:9/events?q=Cupa%20Mare&limit=20');
    expect(await c.officialUrl(3, 'x')).toEqual({ ok: true, value: null });
    expect(await c.officialUrl(99, 'x')).toEqual({ ok: true, value: null });
  });

  it('never logs the key, in any outcome', async () => {
    const logs = spies();
    const boom = (async () => {
      throw new Error(`failed with ${KEY}`);
    }) as unknown as typeof fetch;
    for (const f of [stub(() => json([])).fetchImpl, stub(() => json({}, 500)).fetchImpl, stub(() => json({}, 404)).fetchImpl, boom]) {
      const c = skateClient(env, f);
      const outs = [await c.results('x'), await c.protocol(1), await c.fieldSize(1, 'a'), await c.officialUrl(1, 'a')];
      expect(JSON.stringify(outs)).not.toContain(KEY);
    }
    for (const spy of logs) expect(JSON.stringify(spy.mock.calls)).not.toContain(KEY);
  });
});
