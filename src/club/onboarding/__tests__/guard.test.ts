import { describe, expect, it } from 'vitest';
import { decide, refusalResponse } from '../guard';
import { EXAMPLE_REGISTRATION_ID, FIXTURES, isExampleAnunt, isExampleDate, type Fixture } from '../fixtures';
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
      expect(decide({ method, url: '/admin/x' }, 'membru')).toEqual({ kind: 'refuse' });
    }
  });

  it('lets session upkeep and the progress post through, nothing similar', () => {
    for (const url of ['/admin/access-token', 'http://localhost:1337/admin/renew-token', '/admin/logout', '/club/onboarding', '/admin/logout?x=1']) {
      expect(decide({ method: 'POST', url }, 'membru')).toEqual({ kind: 'pass' });
    }
    for (const url of ['/club/onboarding/extra', '/club/inscrieri', '/admin/users/me', '/x/admin/logout-all']) {
      expect(decide({ method: 'POST', url }, 'membru')).toEqual({ kind: 'refuse' });
    }
  });

  it('treats GET, HEAD and OPTIONS as reads', () => {
    for (const method of ['GET', 'head', 'OPTIONS']) {
      expect(decide({ method, url: '/admin/x' }, 'membru')).toEqual({ kind: 'pass' });
    }
  });

  it('refuses a stray write even when its url matches a fixture', () => {
    const fixtures = { membru: [fixture] };
    const url = 'http://localhost:1337/content-manager/collection-types/api::demo.demo?page=1';
    expect(decide({ method: 'POST', url }, 'membru', fixtures)).toEqual({ kind: 'refuse' });
    expect(decide({ method: 'GET', url }, 'membru', fixtures)).toEqual({ kind: 'fixture', body: fixture.body });
    expect(decide({ method: 'GET', url }, 'grupa', fixtures)).toEqual({ kind: 'pass' });
    expect(decide({ method: 'GET', url: '/admin/unrelated' }, 'membru', fixtures)).toEqual({ kind: 'pass' });
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

describe('sportiv and grupa fixtures', () => {
  const bodyOf = <T>(flow: 'sportiv' | 'grupa', url: string): T => {
    const d = decide({ method: 'GET', url: `http://localhost:1337${url}` }, flow);
    if (d.kind !== 'fixture') throw new Error(`not served: ${url}`);
    return d.body as T;
  };
  it('serves the Sportivi list and a search that finds nobody', () => {
    expect(bodyOf<{ data: unknown[] }>('sportiv', '/api/club/athletes?season=x&page=1').data).toHaveLength(2);
    expect(bodyOf<{ data: unknown[] }>('sportiv', '/api/club/athletes/search?q=Ion').data).toEqual([]);
  });
  it('serves the groups list and the form options, price lists of the first section', () => {
    const list = bodyOf<{ data: { tabs: { documentId: string }[]; rows: unknown[] } }>('grupa', '/api/club/groups?season=2026-2027').data;
    expect(list.rows).toHaveLength(2);
    const opts = bodyOf<{ data: { priceLists: { sectionId: string | null }[]; coaches: unknown[] } }>('grupa', '/api/club/groups/options').data;
    expect(opts.priceLists[0].sectionId).toBe(list.tabs[0].documentId);
    expect(opts.coaches).toHaveLength(2);
  });
  it('refuses the create and add POSTs and freezes the bodies', () => {
    expect(decide({ method: 'POST', url: '/api/club/groups' }, 'grupa')).toEqual({ kind: 'refuse' });
    expect(decide({ method: 'POST', url: '/api/club/athletes' }, 'sportiv')).toEqual({ kind: 'refuse' });
    for (const f of [...(FIXTURES.sportiv ?? []), ...(FIXTURES.grupa ?? [])]) {
      expect(Object.isFrozen(f.body)).toBe(true);
      expect(f.match.flags).toBe('');
      expect(f.match.source.startsWith('^')).toBe(true);
    }
  });
});

describe('parinte and functii fixtures', () => {
  const bodyOf = <T>(flow: 'parinte' | 'functii', url: string): T => {
    const d = decide({ method: 'GET', url: `http://localhost:1337${url}` }, flow);
    if (d.kind !== 'fixture') throw new Error(`not served: ${url}`);
    return d.body as T;
  };
  it('serves the list with Andrei Stan, his record and his access block', () => {
    const list = bodyOf<{ data: { name: string; documentId: string }[] }>('parinte', '/api/club/athletes?page=1&pageSize=50').data;
    expect(list[0].name).toBe('Andrei Stan');
    expect(bodyOf<{ data: { fields: { email: string } } }>('parinte', `/api/club/athletes/${list[0].documentId}?season=2026-2027`).data.fields.email).toBeTruthy();
    expect(bodyOf<{ data: { state: string; canInvite: boolean } }>('parinte', `/api/club/athletes/${list[0].documentId}/access`).data).toMatchObject({ state: 'none', canInvite: true });
    expect(decide({ method: 'GET', url: '/api/club/athletes/other/access' }, 'parinte').kind).toBe('pass');
  });
  it('serves all switches on to the functii flow only', () => {
    const f = bodyOf<{ data: { features: Record<string, boolean> } }>('functii', '/api/club/features').data.features;
    expect(Object.values(f).every(Boolean)).toBe(true);
    for (const flow of ['inscriere', 'sportiv', 'grupa', 'prezenta', 'plata', 'sedinta', 'anunt', 'parinte'] as const) {
      expect(decide({ method: 'GET', url: '/api/club/features' }, flow).kind).toBe('pass');
    }
  });
  it('refuses the invite and the switch save, and freezes and anchors every body', () => {
    expect(decide({ method: 'POST', url: '/api/club/athletes/ex-sportiv-andrei/access/invite' }, 'parinte')).toEqual({ kind: 'refuse' });
    expect(decide({ method: 'PUT', url: '/api/club/features' }, 'functii')).toEqual({ kind: 'refuse' });
    for (const f of [...(FIXTURES.parinte ?? []), ...(FIXTURES.functii ?? [])]) {
      expect(Object.isFrozen(f.body)).toBe(true);
      expect(f.match.flags).toBe('');
      expect(f.match.source.startsWith('^')).toBe(true);
    }
  });
});

describe('plata and sedinta fixtures', () => {
  const bodyOf = <T>(flow: 'plata' | 'sedinta', url: string): T => {
    const d = decide({ method: 'GET', url: `http://localhost:1337${url}` }, flow);
    if (d.kind !== 'fixture') throw new Error(`not served: ${url}`);
    return d.body as T;
  };
  it('serves the Contabilitate Plăți tab and the payment form of the example athlete', () => {
    expect(bodyOf<{ data: { cards: unknown } }>('plata', '/api/club/money/overview?month=2026-11').data.cards).toBeTruthy();
    expect(bodyOf<{ data: { rows: unknown[] } }>('plata', '/api/club/payments?month=2026-11').data.rows).toHaveLength(2);
    expect(bodyOf<{ data: { documentId: string }[] }>('plata', '/api/club/athletes/search?q=Ana').data).toHaveLength(1);
    const options = bodyOf<{ data: { amount: number | null; isDefault: boolean }[] }>('plata', '/api/club/athletes/ex-sportiv-1/payments/options').data;
    expect(options[0]).toMatchObject({ amount: 200, isDefault: true });
    expect(bodyOf<{ data: { hasEmail: boolean } }>('plata', '/api/club/athletes/ex-sportiv-1/payments').data.hasEmail).toBe(true);
  });
  it('serves the example group page, its program and a Thursday in every month of the season', () => {
    expect(bodyOf<{ data: { documentId: string } }>('sedinta', '/api/club/groups/ex-grupa-1?season=2026-2027').data.documentId).toBe('ex-grupa-1');
    expect(bodyOf<{ data: { series: unknown[] } }>('sedinta', '/api/club/groups/ex-grupa-1/program?season=2026-2027').data.series).toHaveLength(1);
    const dates = bodyOf<{ data: { date: string; documentId: string; status: string }[] }>('sedinta', '/api/club/calendar/occurrences?from=2026-11-01&to=2026-11-30&group=ex-grupa-1').data;
    expect(dates.every((d) => new Date(`${d.date}T12:00:00Z`).getUTCDay() === 4 && d.status === 'scheduled' && isExampleDate(d.documentId))).toBe(true);
    for (const month of ['2026-10', '2026-12', '2027-03', '2027-06']) expect(dates.some((d) => d.date.startsWith(month))).toBe(true);
  });
  it('refuses the payment and the date save, and freezes and anchors every body', () => {
    expect(decide({ method: 'POST', url: '/api/club/payments' }, 'plata')).toEqual({ kind: 'refuse' });
    expect(decide({ method: 'PUT', url: '/api/club/program/ex-event-1/dates/2026-12-03' }, 'sedinta')).toEqual({ kind: 'refuse' });
    for (const f of [...(FIXTURES.plata ?? []), ...(FIXTURES.sedinta ?? [])]) {
      expect(Object.isFrozen(f.body)).toBe(true);
      expect(f.match.flags).toBe('');
      expect(f.match.source.startsWith('^')).toBe(true);
    }
  });
});

describe('editor flow fixtures', () => {
  const get = (url: string, flow: 'pagina' | 'preturi' | 'membru') => decide({ method: 'GET', url: `http://localhost:1337${url}` }, flow);

  it('serves the Cursuri editor, the prices and the members list', () => {
    expect(get('/content-manager/single-types/api::cursuri-page.cursuri-page', 'pagina').kind).toBe('fixture');
    expect(get('/api/club/prices', 'preturi').kind).toBe('fixture');
    expect(get('/content-manager/collection-types/api::team-member.team-member?page=1&pageSize=200&sort=order:ASC', 'membru').kind).toBe('fixture');
  });

  it('keeps each fixture to its own flow and to other endpoints passing', () => {
    expect(get('/api/club/prices', 'pagina')).toEqual({ kind: 'pass' });
    expect(get('/content-manager/single-types/api::program.program', 'membru')).toEqual({ kind: 'pass' });
  });

  it('refuses every save write of the three flows', () => {
    const writes: Array<[string, string, 'pagina' | 'preturi' | 'membru']> = [
      ['PUT', '/content-manager/single-types/api::cursuri-page.cursuri-page', 'pagina'],
      ['POST', '/content-manager/single-types/api::cursuri-page.cursuri-page/actions/publish', 'pagina'],
      ['PUT', '/api/club/price-lists/ex-lista-1/items/0', 'preturi'],
      ['POST', '/api/club/price-lists/ex-lista-1/items', 'preturi'],
      ['DELETE', '/api/club/price-lists/ex-lista-1/items/0', 'preturi'],
      ['POST', '/content-manager/collection-types/api::team-member.team-member', 'membru'],
      ['PUT', '/content-manager/collection-types/api::team-member.team-member/ex-membru-1', 'membru'],
    ];
    for (const [method, url, flow] of writes) expect(decide({ method, url }, flow), `${method} ${url}`).toEqual({ kind: 'refuse' });
  });
});
