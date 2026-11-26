import { describe, expect, it } from 'vitest';
import { decide, refusalResponse } from '../guard';
import { FIXTURES, type Fixture } from '../fixtures';

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
