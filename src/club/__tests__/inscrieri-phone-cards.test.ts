import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { cardDate, cardFacts, PHONE_BACK } from '../inscrieri-card';

const dash = (...p: string[]) => readFileSync(join(__dirname, '..', '..', 'admin', 'dashboard', ...p), 'utf8');
const page = dash('InscrieriPage.tsx');
const table = dash('SubmissionTable.tsx');
const phone = dash('inscrieri', 'PhoneList.tsx');

it('the card date has no year and a bad date is empty', () => {
  expect(cardDate('2026-10-03T10:00:00')).toBe('3 oct');
  expect(cardDate(null)).toBe('');
  expect(cardDate('nope')).toBe('');
});

it('card facts keep the order and drop the school on a school tab and empty parts', () => {
  const base = { nr: '2026-0006', age: '9 ani', school: 'Școala de Patinaj - AFI Cotroceni', showSchool: true, submittedAt: '2026-10-03T10:00:00' };
  expect(cardFacts(base)).toEqual(['2026-0006', '9 ani', 'AFI Cotroceni', '3 oct']);
  expect(cardFacts({ ...base, showSchool: false, age: '' })).toEqual(['2026-0006', '3 oct']);
});

it('Înscrieri opts into phone cards and the table gates them behind the phone query', () => {
  expect(PHONE_BACK).toBe('‹ Înscrieri');
  expect(page).toContain('phoneCards: true');
  expect(page).toContain('phoneCard:');
  expect(table).toContain('cfg.phoneCards');
  expect(table).toContain('useIsPhone()');
});

it('the phone detail is a full-screen layer with a back link that closes it, the list stays mounted', () => {
  expect(phone).toContain('PHONE_BACK');
  expect(phone).toContain('sbt-pdetail');
  expect(table).toContain('<PhoneDetail onBack={phoneBack}>');
  expect(table).toContain('if (view !== \'compact\' || phoneCards) return;');
});

it('selection and bulk actions are not offered on phone cards', () => {
  expect(table).toContain('cfg.bulk && !phoneCards && selectedIds.size > 0');
});

it('the phone detail opens by ?open= and owns one history entry', () => {
  const back = dash('inscrieri', 'usePhoneBack.ts');
  expect(page).toContain('openId: open');
  expect(page).toContain("onOpenClosed: () => navigate({ search: '' })");
  expect(table).toContain('usePhoneBack(phoneCards && selected !== null, closePhoneDetail)');
  expect(back).toContain('window.history.pushState');
  expect(back).toContain("addEventListener('popstate'");
  expect(back).toContain('window.history.back()');
});
