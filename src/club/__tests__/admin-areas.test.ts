import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

// menu.tsx reaches the admin fetch client through AreaGate; the Strapi admin bundle does not load in vitest.
vi.mock('@strapi/admin/strapi-admin', () => ({ getFetchClient: () => ({}) }));

import { ADMIN_AREAS, type AdminArea } from '../admin-area';
import { areasFor, areasOfMe, ROLE_CODES } from '../roles/map';
import { dashboardParts } from '../dashboard-parts';
import { EDUSPORT_LINKS, visibleLinks } from '../../admin/dashboard/menu';
import { CUSTOM_PAGES } from '../../admin/pages/routes';

const ADMIN = join(__dirname, '../../admin');
const read = (p: string) => readFileSync(join(ADMIN, p), 'utf8');
const hasOf = (codes: string[]) => {
  const areas = areasFor(codes);
  return (a: AdminArea) => areas.has(a);
};
const labels = (codes: string[]) => visibleLinks(EDUSPORT_LINKS, hasOf(codes)).map((l) => l.label);

const SITE_EDITOR_LABELS = [
  'Membri echipă', 'Competiții', 'Discipline',
  'Pagina principală', 'Cursuri', 'Prețuri', 'Regulament', 'Pagina Program', 'Pagina Echipă', 'Istoric', 'Realizări', 'Parteneri', 'Voluntariat',
  'Articole', 'Anunțuri', 'Sponsori', 'Evenimente colaborare', 'Momente istoric',
  'Media', 'Meniu site', 'Securitate',
];

describe('menu entries per role', () => {
  it('Super Admin sees every entry', () => {
    expect(labels([ROLE_CODES.superAdmin])).toEqual(EDUSPORT_LINKS.map((l) => l.label));
  });
  it('Administrator club sees every entry (Securitate Administratori is inside the page)', () => {
    expect(labels([ROLE_CODES.clubAdmin])).toEqual(EDUSPORT_LINKS.map((l) => l.label));
  });
  it('Editor site sees the website entries and Securitate', () => {
    expect(labels([ROLE_CODES.siteEditor]).sort()).toEqual([...SITE_EDITOR_LABELS].sort());
  });
  it('Tabele needs money, Setări site and Sezoane need settings', () => {
    const area = (label: string) => EDUSPORT_LINKS.find((l) => l.label === label)?.area;
    expect(area('Tabele')).toBe('money');
    expect(area('Setări site')).toBe('settings');
    expect(area('Sezoane')).toBe('settings');
  });
  it('before the read answers only area any shows', () => {
    expect(visibleLinks(EDUSPORT_LINKS, (a) => a === 'any').map((l) => l.label)).toEqual(['Securitate']);
  });
});

describe('areas on every entry and gate', () => {
  it('every link and custom page has a known area', () => {
    for (const l of EDUSPORT_LINKS) expect(ADMIN_AREAS, l.label).toContain(l.area);
    for (const p of CUSTOM_PAGES) expect(ADMIN_AREAS, p.to).toContain(p.area);
  });
  it('every addMenuLink and addRoute in menu.tsx goes through AreaGate', () => {
    const src = read('dashboard/menu.tsx');
    expect(src).not.toMatch(/Component: \(\) =>/);
    expect(src).not.toMatch(/lazy: async/);
    const menuLinks = src.match(/app\.addMenuLink\(/g)?.length ?? 0;
    const components = src.match(/Component: gated\(/g)?.length ?? 0;
    expect(components).toBe(menuLinks);
    const routes = src.match(/app\.router\.addRoute\(/g)?.length ?? 0;
    expect(src.match(/lazy: gatedLazy\(/g)?.length).toBe(routes);
    expect(src).not.toContain('ignores it until 6b');
  });
  it('the sidebar and the phone menu filter through visibleLinks', () => {
    expect(read('dashboard/EdusportShell.tsx')).toContain('visibleLinks(EDUSPORT_LINKS, has)');
    expect(read('MobileNav.tsx')).toContain('visibleLinks(EDUSPORT_LINKS, has)');
  });
  it('a page opened by URL shows NoAccess when not allowed and nothing before ready', () => {
    const gate = read('lib/AreaGate.tsx');
    const body = gate.slice(gate.indexOf('export function AreaGate'), gate.indexOf('export function gated'));
    expect(body.indexOf('if (!ready) return null')).toBeGreaterThan(-1);
    expect(body.indexOf('if (!ready)')).toBeLessThan(body.indexOf('<NoAccess />'));
    expect(body.indexOf('<NoAccess />')).toBeLessThan(body.indexOf('{children}'));
    expect(body).toContain('!has(area)');
    expect(read('ui/NoAccess.tsx')).toContain('SECURITY_ERRORS.noAccess');
  });
  it('useAreas shares one /admin/users/me read and drops a failed one', () => {
    const src = read('lib/useAreas.ts');
    expect(src.match(/\.get\('\/admin\/users\/me'\)/g)).toHaveLength(1);
    expect(src).toContain('pending = null');
    expect(src).toContain('areas?.has(area) ?? false');
  });
});

describe('areasOfMe', () => {
  it('reads the roles of the answer of /admin/users/me', () => {
    expect(areasOfMe({ data: { roles: [{ code: ROLE_CODES.siteEditor }] } })).toEqual(new Set(['any', 'website']));
    expect(areasOfMe({ data: { roles: [{ code: ROLE_CODES.superAdmin }] } }).has('superAdmin')).toBe(true);
    expect(areasOfMe(null)).toEqual(new Set(['any']));
  });
});

describe('dashboard parts', () => {
  it('a site editor gets no club feed, season switch or athlete figure', () => {
    expect(dashboardParts(hasOf([ROLE_CODES.siteEditor]))).toEqual({ athletes: false, feed: false, season: false, program: false });
    expect(dashboardParts(hasOf([ROLE_CODES.clubAdmin]))).toEqual({ athletes: true, feed: true, season: true, program: true });
  });
  it('DashboardPage reads club and settings routes only for those parts', () => {
    const src = read('dashboard/DashboardPage.tsx');
    for (const part of ['if (!parts.feed) return undefined', 'if (!parts.season) return undefined', 'if (!parts.athletes) return null', '{parts.feed && <Section', '{parts.season && <Section', '.filter((a) => has(a.area))', 'if (!ready) return undefined']) {
      expect(src, part).toContain(part);
    }
  });
});

describe('Contabilitate parts by area', () => {
  it('ContabilitatePage loads the overview and accounting only with money and hides the glance', () => {
    const src = read('dashboard/ContabilitatePage.tsx');
    expect(src).toContain("const money = has(GLANCE_AREA)");
    expect(src).toContain('api.overview, month, money)');
    expect(src).toContain("api.accounting, month, money && tab === 'pe-grupe')");
    expect(src).toContain('{money && <header');
    expect(src).toContain('readContabQuery(search.toString(), today, tabs.map((t) => t.id))');
  });
});

describe('super admin and coach accounts', () => {
  const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
  it('no file under src/admin uses useSuperAdmin or useIsSuperAdmin', () => {
    for (const f of files(ADMIN).filter((p) => /\.tsx?$/.test(p))) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/useSuperAdmin|useIsSuperAdmin/);
    }
  });
  it('AccountBlock renders only with coachAccounts', () => {
    expect(read('dashboard/portal/AccountBlock.tsx')).toContain("useAreas().has('coachAccounts') ? <AccountBlockBody");
  });
});
