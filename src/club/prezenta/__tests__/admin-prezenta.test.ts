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

it('Prezență: three tabs, notices, the day switcher (5.2, C41)', () => {
  const s = src('dashboard/prezenta/PrezentaScreen.tsx');
  for (const k of ['tabSessions', 'tabLessons', 'tabCoaches', 'startNotice']) expect(s, k).toContain(`PREZENTA_COPY.${k}`);
  expect(s).toContain('noPriceListNotice(');
});
it('Ședințe: undone section above the day, columns, empty text, phone cards (5.2)', () => {
  const d = src('dashboard/prezenta/DayTab.tsx');
  expect(d.indexOf('undoneTitle(')).toBeLessThan(d.indexOf('dayTitle('));
  for (const k of ['colDate', 'colTime', 'colGroup', 'colCoach', 'colState', 'colPresent', 'emptyDay', 'newSession', 'today', 'prevDay', 'nextDay'])
    expect(d, k).toContain(`PREZENTA_COPY.${k}`);
  expect(d).toContain('sessionCard(');
  expect(d).toContain('PRESENCE_WORDS.outsideSchedule');
  expect(d).toMatch(/undone\.length > 0/);
});
it('Ședință nouă: fields, check and the warning (5.4, 4.5)', () => {
  const w = src('dashboard/prezenta/NewSessionWindow.tsx');
  for (const k of ['newSessionTitle', 'colGroup', 'colDate', 'colTime', 'colDuration', 'coach', 'cancel', 'continue']) expect(w, k).toContain(`PREZENTA_COPY.${k}`);
  expect(w).toContain('api.check(');
  expect(w).toContain('durationOptions()');
  const e = src('dashboard/prezenta/ExistingDialog.tsx');
  for (const k of ['title', 'open', 'addAnother']) expect(e, k).toContain(`EXISTING_SESSION.${k}`);
  expect(e).toMatch(/!check\.sameTime/);
});
