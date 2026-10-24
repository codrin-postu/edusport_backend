import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { CUSTOM_PAGES, PRETURI_TO, SEZOANE_TO } from '../../admin/pages/routes';

it('Sezoane is a custom page; Prețuri keeps its route', () => {
  expect(SEZOANE_TO).toBe('/plugins/edusport-sezoane');
  expect(CUSTOM_PAGES.find((p) => p.to === SEZOANE_TO)).toMatchObject({ uid: 'api::season.season', kind: 'collection', role: 'main', redirect: false });
  expect(CUSTOM_PAGES.find((p) => p.to === PRETURI_TO)).toBeDefined();
});

it('the sidebar pins Sezoane at the top, between Setări site and Meniu site, with a calendar icon', () => {
  const read = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');
  expect(read('admin/dashboard/menu.tsx')).toMatch(
    /\{ to: SETARI_SITE_TO,[^\n]*pinned: true \},\n\s*\{ to: SEZOANE_TO, label: 'Sezoane', icon: Calendar, group: 'system', pinned: true \},\n\s*\{ to: NAVIGATION_TO,/,
  );
  expect(read('admin/dashboard/EdusportShell.tsx')).toContain("[SEZOANE_TO]: 'calendar'");
});
