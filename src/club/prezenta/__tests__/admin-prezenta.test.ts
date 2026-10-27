import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const ADMIN = join(__dirname, '..', '..', '..', 'admin');
const ROOT = join(__dirname, '..', '..', '..', '..');
const src = (p: string) => readFileSync(join(ADMIN, p), 'utf8');

it('menu: Grupe, Sportivi, Prezență, Abonamente, Plăți, De încasat in Club și școală (5.1, C40)', () => {
  const menu = src('dashboard/menu.tsx');
  const order = ['GRUPE_TO', 'SPORTIVI_TO', 'PREZENTA_PATH', 'ABONAMENTE_PATH', 'PLATI_PATH', 'DE_INCASAT_PATH'].map((k) => menu.indexOf(`{ to: ${k}`));
  expect(order.every((i, n) => i > 0 && (n === 0 || i > order[n - 1]))).toBe(true);
  for (const page of ['PrezentaPage', 'AbonamentePage', 'PlatiPage', 'DeIncasatPage']) expect(menu).toContain(`import('./${page}')`);
  expect(menu).not.toContain('Prezență joins in phase 5');
});

it('the api reaches every plan 5-2 route', () => {
  const api = src('dashboard/prezenta/api.ts');
  for (const p of ['/attendance/day', '/attendance/session/defaults', '/attendance/session/check', '/attendance/session', '/attendance/coaches', 'coaches.csv',
    '/lessons/new', '/lessons', '/attendance', '/groups/options', '/undo']) expect(api, p).toContain(p);
});

it('undo toasts last 8 s with "Anulează" and no X', () => {
  const undo = src('dashboard/prezenta/undo.ts');
  expect(undo).toContain('UNDO_MS = 8000');
  expect(undo).toMatch(/action: \{ label: 'Anulează'/);
});

it('Setări site has "Prezență și plăți din" with its hint (3.8, 5.16)', () => {
  const page = src('pages/SetariSitePage.tsx');
  expect(page).toContain('SETARI_COPY.attendanceStart');
  expect(page).toContain('SETARI_COPY.attendanceStartHint');
  expect(page).toContain('attendanceStartDate');
});

it('the three shells carry their titles', () => {
  expect(src('dashboard/AbonamentePage.tsx')).toMatch(/SHELL_COPY\.abonamente[\s\S]*SHELL_COPY\.abonamenteSub/);
  expect(src('dashboard/PlatiPage.tsx')).toContain('SHELL_COPY.plati');
  expect(src('dashboard/DeIncasatPage.tsx')).toContain('SHELL_COPY.deIncasat');
});

it('prezenta components are held to the colour rule', () => {
  expect(readFileSync(join(ROOT, 'scripts/admin-ui-check.mjs'), 'utf8')).toContain("'dashboard', 'prezenta'");
});
