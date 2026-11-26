import { describe, expect, it, vi } from 'vitest';

// menu.tsx reaches the admin fetch client through AreaGate; the Strapi admin bundle does not load in vitest.
vi.mock('@strapi/admin/strapi-admin', () => ({ getFetchClient: () => ({}) }));
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { menuKeyTarget } from '../ui-menu';
import { EDUSPORT_LINKS, GROUP_ORDER, PRIMII_PASI_TO } from '../../admin/dashboard/menu';
import { SECURITY_COPY } from '../security/copy';

describe('menuKeyTarget (menu button pattern)', () => {
  it('ArrowDown and ArrowUp move between items and wrap', () => {
    expect(menuKeyTarget('ArrowDown', 0, 3)).toBe(1);
    expect(menuKeyTarget('ArrowDown', 2, 3)).toBe(0);
    expect(menuKeyTarget('ArrowUp', 1, 3)).toBe(0);
    expect(menuKeyTarget('ArrowUp', 0, 3)).toBe(2);
  });

  it('from outside the items: ArrowDown goes to the first, ArrowUp to the last', () => {
    expect(menuKeyTarget('ArrowDown', -1, 3)).toBe(0);
    expect(menuKeyTarget('ArrowUp', -1, 3)).toBe(2);
  });

  it('Home and End go to the first and the last item', () => {
    expect(menuKeyTarget('Home', 2, 3)).toBe(0);
    expect(menuKeyTarget('End', 0, 3)).toBe(2);
  });

  it('other keys and an empty menu do nothing', () => {
    expect(menuKeyTarget('Enter', 0, 3)).toBeNull();
    expect(menuKeyTarget('Escape', 0, 3)).toBeNull();
    expect(menuKeyTarget('ArrowDown', -1, 0)).toBeNull();
  });
});

describe('menu order and wording', () => {
  const ADMIN = join(__dirname, '../../admin');
  const read = (p: string) => readFileSync(join(ADMIN, p), 'utf8');
  const labelsOf = (group: string) => EDUSPORT_LINKS.filter((l) => l.group === group).map((l) => l.label);

  it('groups run news, forms, club, pages, settings', () => {
    expect(GROUP_ORDER).toEqual(['news', 'forms', 'club', 'pages', 'settings']);
  });
  it('club rows keep the decided order', () => {
    expect(labelsOf('club')).toEqual([
      'Sportivi', 'Grupe', 'Prețuri', 'Prezență', 'Contabilitate', 'Calendar și serii', 'Tabele', 'Membri echipă', 'Competiții',
    ]);
  });
  it('the forms hub is the last row, renamed', () => {
    expect(labelsOf('forms').at(-1)).toBe('Întrebările formularelor');
    expect(labelsOf('forms')).not.toContain('Formulare');
  });
  it('Setări has Meniul Strapi for the Super Admin and Primii pași for everyone', () => {
    const find = (label: string) => EDUSPORT_LINKS.find((l) => l.label === label);
    expect(find('Meniul Strapi')).toMatchObject({ group: 'settings', area: 'superAdmin', action: 'strapiMenu' });
    expect(find('Primii pași')).toMatchObject({ group: 'settings', area: 'any', to: PRIMII_PASI_TO });
  });
  it('both footers carry the guide link, the shell shows the Strapi switch only to the Super Admin', () => {
    expect(read('dashboard/EdusportShell.tsx')).toContain('Ghid EduSport');
    expect(read('MobileNav.tsx')).toContain('Ghid EduSport');
    expect(read('dashboard/EdusportShell.tsx')).toMatch(/has\('superAdmin'\) \? \([\s\S]*Comută la meniul Strapi/);
  });
  it('the security copy says Passkey, never Chei de acces', () => {
    expect(JSON.stringify(SECURITY_COPY)).toContain('Passkey');
    expect(JSON.stringify(SECURITY_COPY)).not.toMatch(/chei de acces|cheie de acces/i);
  });
});
