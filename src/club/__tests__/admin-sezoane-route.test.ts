import { expect, it, vi } from 'vitest';

vi.mock('@strapi/admin/strapi-admin', () => ({ getFetchClient: () => ({}) }));

import { EDUSPORT_LINKS } from '../../admin/dashboard/menu';
import { CUSTOM_PAGES, PRETURI_TO, SEZOANE_TO } from '../../admin/pages/routes';

it('Sezoane is a custom page; Prețuri keeps its route', () => {
  expect(SEZOANE_TO).toBe('/plugins/edusport-sezoane');
  expect(CUSTOM_PAGES.find((p) => p.to === SEZOANE_TO)).toMatchObject({ uid: 'api::season.season', kind: 'collection', role: 'main', redirect: false });
  expect(CUSTOM_PAGES.find((p) => p.to === PRETURI_TO)).toBeDefined();
});

it('Sezoane sits in the Setări group, no row is pinned, Imagini replaces Media', () => {
  const find = (label: string) => EDUSPORT_LINKS.find((l) => l.label === label);
  expect(find('Sezoane')).toMatchObject({ to: SEZOANE_TO, group: 'settings', area: 'settings' });
  expect(find('Setări site')?.group).toBe('settings');
  expect(find('Media')).toBeUndefined();
  expect(find('Imagini')).toMatchObject({ to: '/plugins/upload', group: 'settings' });
  expect(EDUSPORT_LINKS.some((l) => 'pinned' in l)).toBe(false);
});
