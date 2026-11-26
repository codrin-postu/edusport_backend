import { describe, expect, it } from 'vitest';
import { decide, refusalResponse } from '../guard';
import { EXAMPLE_REGISTRATION_ID, FIXTURES, type Fixture } from '../fixtures';
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
});
