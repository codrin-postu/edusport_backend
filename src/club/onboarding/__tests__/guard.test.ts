import { describe, expect, it } from 'vitest';
import { decide, refusalResponse } from '../guard';
import { EXAMPLE_REGISTRATION_ID, FIXTURES, isExampleAnunt, type Fixture } from '../fixtures';
import { CLUB_URLS, openListParams } from '../../inscrieri-panel';

const fixture: Fixture = { method: 'GET', match: /\/content-manager\/collection-types\/api::demo\.demo(\?|$)/, body: { results: [] } };

describe('decide', () => {
  it('passes everything when no flow runs', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'GET']) {
      expect(decide({ method, url: '/admin/x' }, null)).toEqual({ kind: 'pass' });
    }
  });

  it('refuses writes while a flow runs, case-insensitively', () => {
    for (const method of ['POST', 'put', 'Patch', 'DELETE']) {
      expect(decide({ method, url: '/admin/x' }, 'sportiv')).toEqual({ kind: 'refuse' });
    }
  });

  it('lets session upkeep and the progress post through, nothing similar', () => {
    for (const url of ['/admin/access-token', 'http://localhost:1337/admin/renew-token', '/admin/logout', '/club/onboarding', '/admin/logout?x=1']) {
      expect(decide({ method: 'POST', url }, 'sportiv')).toEqual({ kind: 'pass' });
    }
    for (const url of ['/club/onboarding/extra', '/club/inscrieri', '/admin/users/me', '/x/admin/logout-all']) {
      expect(decide({ method: 'POST', url }, 'sportiv')).toEqual({ kind: 'refuse' });
    }
  });

  it('treats GET, HEAD and OPTIONS as reads', () => {
    for (const method of ['GET', 'head', 'OPTIONS']) {
      expect(decide({ method, url: '/admin/x' }, 'sportiv')).toEqual({ kind: 'pass' });
    }
  });

  it('refuses a stray write even when its url matches a fixture', () => {
    FIXTURES['sportiv'] = [fixture];
    try {
      const url = 'http://localhost:1337/content-manager/collection-types/api::demo.demo?page=1';
      expect(decide({ method: 'POST', url }, 'sportiv')).toEqual({ kind: 'refuse' });
      expect(decide({ method: 'GET', url }, 'sportiv')).toEqual({ kind: 'fixture', body: fixture.body });
      expect(decide({ method: 'GET', url }, 'grupa')).toEqual({ kind: 'pass' });
      expect(decide({ method: 'GET', url: '/admin/unrelated' }, 'sportiv')).toEqual({ kind: 'pass' });
    } finally {
      delete FIXTURES['sportiv'];
    }
  });

  it('refusal response is a 409 with the strip text', () => {
    expect(refusalResponse()).toEqual({ status: 409, body: { error: { message: 'Exemplu: modificările nu se salvează' } } });
  });
});

describe('inscriere fixtures', () => {
  const id = EXAMPLE_REGISTRATION_ID;
  const serve = (url: string) => decide({ method: 'GET', url: `http://localhost:1337${url}` }, 'inscriere');
  const isFixture = (url: string) => serve(url).kind === 'fixture';

  it('answers every GET the Înscrieri page and panel build, with the page urls', () => {
    const urls = [
      '/api/forms/inscrieri?page=1&pageSize=25&sort=newest&archived=false&season=2026-2027',
      '/api/forms/inscrieri?pageSize=1&archived=false',
      `/api/forms/inscrieri?${new URLSearchParams(openListParams(id)).toString()}&page=1`,
      CLUB_URLS.match(id),
      CLUB_URLS.history(id),
      CLUB_URLS.confirmContext(id, null),
      CLUB_URLS.confirmContext(id, 'ex-athlete-maria'),
      CLUB_URLS.athleteSearch('', id),
      CLUB_URLS.athleteSearch('Maria', id),
    ];
    for (const url of urls) expect(isFixture(url), url).toBe(true);
  });

  it('leaves other registrations and the csv export to the real server', () => {
    for (const url of ['/api/forms/inscrieri/export.csv', CLUB_URLS.match('other'), '/api/forms/inscrieri/ex-maria']) {
      expect(serve(url), url).toEqual({ kind: 'pass' });
    }
  });

  it('refuses the confirm and undo posts during the flow', () => {
    for (const url of [CLUB_URLS.confirm(id), CLUB_URLS.undo(id)]) {
      expect(decide({ method: 'POST', url }, 'inscriere')).toEqual({ kind: 'refuse' });
    }
  });

  it('serves a list row the page reads as the example registration', () => {
    const hit = serve('/api/forms/inscrieri?page=1');
    const body = (hit as { body: { data: { documentId: string; childName: string; age: number; schoolName: string }[] } }).body;
    expect(body.data[0]).toMatchObject({ documentId: id, childName: 'Maria Popescu', age: 9, schoolName: 'Școala de Patinaj' });
  });

  it('hands out frozen bodies that share no comparison rows', () => {
    const bodies = (FIXTURES.inscriere ?? []).map((f) => f.body as { data?: { comparison?: object[] } });
    const [match, context] = [bodies[1], bodies[3]];
    expect(Object.isFrozen(match.data)).toBe(true);
    expect(match.data?.comparison?.[0]).not.toBe(context.data?.comparison?.[0]);
    expect(() => { 'use strict'; (match.data as { confirmed: boolean }).confirmed = true; }).toThrow();
  });
});

describe('prezenta fixtures', () => {
  const serve = (url: string) => decide({ method: 'GET', url: `http://localhost:1337${url}` }, 'prezenta');
  const key = encodeURIComponent('ex-event|2026-11-23|18:00');
  const bodyOf = <T>(url: string): T => (serve(url) as { body: T }).body;

  it('answers every GET the Prezență page and the session panel make', () => {
    const urls = [
      '/api/club/attendance/period?from=2026-11-26&to=2026-11-26',
      '/api/club/attendance/period?from=2026-11-23&to=2026-11-29',
      `/api/club/attendance/session?occurrence=${key}`,
      '/api/club/groups/options',
    ];
    for (const url of urls) expect(serve(url).kind, url).toBe('fixture');
  });

  it('leaves other sessions to the real server', () => {
    expect(serve('/api/club/attendance/session?occurrence=real-1%7C2026-11-23%7C18%3A00').kind).toBe('pass');
    expect(serve('/api/club/attendance/session?id=abc').kind).toBe('pass');
  });

  it('serves one undone session with five athletes, each with remaining sessions', () => {
    const period = bodyOf<{ data: { undone: { groupName: string; occurrenceKey: string }[] } }>('/api/club/attendance/period?from=a&to=b');
    expect(period.data.undone).toHaveLength(1);
    expect(period.data.undone[0].groupName).toBe('Începători 1');
    const panel = bodyOf<{ data: { rows: { name: string; abonament: string }[]; occurrenceKey: string } }>(`/api/club/attendance/session?occurrence=${key}`);
    expect(panel.data.occurrenceKey).toBe(period.data.undone[0].occurrenceKey);
    expect(panel.data.rows.map((r) => r.name)).toEqual(['Ana Marin', 'Luca Dobre', 'Sara Ene', 'Tudor Vlad', 'Ilinca Rus']);
    for (const r of panel.data.rows) expect(r.abonament).toMatch(/ședinț[ăe] rămas[ăe]$/);
  });

  it('refuses the attendance save and the new-session check during the flow', () => {
    for (const [method, url] of [['PUT', '/api/club/attendance/session'], ['POST', '/api/club/attendance/session/check'], ['POST', '/api/club/undo']]) {
      expect(decide({ method, url }, 'prezenta')).toEqual({ kind: 'refuse' });
    }
  });

  it('hands out frozen bodies', () => {
    for (const f of FIXTURES.prezenta ?? []) expect(Object.isFrozen(f.body)).toBe(true);
  });
});

describe('anunt fixtures', () => {
  const serve = (url: string) => decide({ method: 'GET', url: `http://localhost:1337${url}` }, 'anunt');
  const bodyOf = <T>(url: string): T => {
    const d = serve(url);
    if (d.kind !== 'fixture') throw new Error(`not served: ${url}`);
    return d.body as T;
  };

  it('serves the list with two example announcements, the first on the portal', () => {
    const b = bodyOf<{ data: { documentId: string; showOnPortal: boolean }[]; list: { id: string }[]; umami: string }>('/api/anunturi');
    expect(b.data).toHaveLength(2);
    expect(b.data.every((a) => isExampleAnunt(a.documentId))).toBe(true);
    expect(b.list.map((r) => r.id)).toEqual(b.data.map((a) => a.documentId));
    expect(b.data[0].showOnPortal).toBe(true);
  });

  it('serves the groups tree and keeps the two reads apart', () => {
    expect(bodyOf<{ data: { sections: { groups: unknown[] }[] } }>('/api/anunturi/groups').data.sections[0].groups).toHaveLength(2);
    expect(Array.isArray(bodyOf<{ data: unknown }>('/api/anunturi').data)).toBe(true);
  });

  it('refuses the create, update, reorder and delete during the flow', () => {
    for (const [method, url] of [['POST', '/api/anunturi'], ['PUT', '/api/anunturi/ex-anunt-1'], ['PUT', '/api/anunturi/reorder'], ['DELETE', '/api/anunturi/ex-anunt-1']]) {
      expect(decide({ method, url }, 'anunt')).toEqual({ kind: 'refuse' });
    }
  });

  it('hands out frozen bodies', () => {
    for (const f of FIXTURES.anunt ?? []) expect(Object.isFrozen(f.body)).toBe(true);
  });
});
