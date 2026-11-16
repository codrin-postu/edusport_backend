import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GRUPE_COPY, GROUP_ERRORS, SCHEDULE_ERRORS, PAUZE_COPY } from '../groups/copy';
import { NEW_SEASON_COPY, step1Rows } from '../groups/copy/new-season';
import { SEASON_ERRORS } from '../season-admin';
import { PRICE_ERRORS } from '../price-admin';
import { ADMIN_ERRORS } from '../athletes/errors';
import { PRESENCE_ERRORS, noPriceListNotice } from '../presence/copy/core';
import { PREZENTA_COPY, MATRIX_COPY, PERIOD_COPY, COACH_COPY, SETARI_COPY } from '../presence/copy/prezenta-ui';
import { PAYMENT_COPY, REACTIVATE_DIALOG, SUBSCRIPTION_COPY } from '../presence/copy';
import { BANI_COPY, CONTABILITATE_COPY, MONEY_UI_COPY } from '../presence/copy/money-ui';

const src = (file: string): string => readFileSync(join(__dirname, '../../', file), 'utf8');

describe('admin copy 2: Grupe, Sezoane, Prezență, Bani, Prețuri, Program', () => {
  it('uses the short repeated forms', () => {
    expect(GRUPE_COPY.removeConfirm('Avansați')).toBe('Ștergi grupa "Avansați"? Nu se poate anula.');
    expect(GRUPE_COPY.nothingThisMonth).toBe('Nimic programat.');
    expect(GRUPE_COPY.emptyHistory).toBe('Niciun eveniment.');
    expect(PERIOD_COPY.emptyGroups).toBe('Nicio ședință.');
    expect(PERIOD_COPY.emptyLessons).toBe('Nicio lecție.');
    expect(COACH_COPY.emptyHours).toBe('Nicio oră.');
    expect(MONEY_UI_COPY.due.empty).toBe('Nimic de încasat.');
    expect(PAYMENT_COPY.dueNothing).toBe('Nimic de încasat.');
    for (const s of [PRESENCE_ERRORS.stale, ADMIN_ERRORS.stale, PRICE_ERRORS.stale, SUBSCRIPTION_COPY.extendStale]) expect(s).toBe('Datele s-au schimbat. Reîncarcă.');
    expect(NEW_SEASON_COPY.seasonChanged).toBe('Sezonul curent s-a schimbat. Reîncarcă.');
  });

  it('shortens Grupe and Prezență lines', () => {
    expect(SCHEDULE_ERRORS.groupEvent('Mici')).toBe('Eveniment al grupei Mici.');
    expect(SCHEDULE_ERRORS.groupKey).toBe('Se schimbă din pagina grupei.');
    expect(SCHEDULE_ERRORS.endBeforeStart).toBe('Sfârșitul trebuie să fie după început.');
    expect(GROUP_ERRORS.datePresence).toBe('Prezență salvată, se poate doar anula.');
    expect(PREZENTA_COPY.startNotice).toBe('Setează data de început în Setări site.');
    expect(noPriceListNotice(2)).toBe('2 grupe fără listă de prețuri, fără sume calculate.');
    expect(REACTIVATE_DIALOG.text('Ana')).toBe('Ana este inactiv. Reactivezi?');
    expect(PAYMENT_COPY.noEmail).toBe('Fără e-mail.');
    expect(PAYMENT_COPY.errors.amount).toBe('Suma trebuie să fie peste 0.');
    expect(PAYMENT_COPY.cancelConfirm(10, '1 nov')).toContain('Rămâne marcată anulată.');
    expect(SUBSCRIPTION_COPY.extendText(12, 2)).toBe('Se prelungesc 12 abonamente active cu 2 săptămâni.');
    expect(MONEY_UI_COPY.plati).not.toHaveProperty('sub');
    expect(CONTABILITATE_COPY.restante).not.toHaveProperty('schoolSub');
    expect(CONTABILITATE_COPY).not.toHaveProperty('peGrupe');
    expect(PREZENTA_COPY).not.toHaveProperty('sub');
    expect(SETARI_COPY).not.toHaveProperty('attendanceStartHint');
    expect(GRUPE_COPY).not.toHaveProperty('publicHint');
    expect(GRUPE_COPY).not.toHaveProperty('optional');
    expect(PAUZE_COPY).not.toHaveProperty('rest');
    expect(PAYMENT_COPY).not.toHaveProperty('hintAny');
    expect(PAYMENT_COPY).not.toHaveProperty('noteHint');
  });

  it('Sezon nou wizard says it once', () => {
    expect(NEW_SEASON_COPY.lead1('2027-2028')).toBe('2027-2028 devine sezonul curent la ultimul pas.');
    expect(NEW_SEASON_COPY.lead2('2027-2028', '2026-2027')).toBe('Grupele trec în 2027-2028. Alege ce copiezi din 2026-2027.');
    expect(NEW_SEASON_COPY).not.toHaveProperty('mainRule');
    expect(NEW_SEASON_COPY).not.toHaveProperty('tileGroupsHint');
    expect(NEW_SEASON_COPY).not.toHaveProperty('tileUnassignedHint');
    expect(src('admin/pages/sezoane/NewSeasonSteps.tsx')).not.toContain('mainRule');
    const rows = step1Rows('2026-2027', '2027-2028', null);
    expect(rows.find((r) => r.label === 'Calendar')?.value).toBe('Nu se schimbă.');
    expect(rows.find((r) => r.label === '2026-2027')?.value).toBe('Doar citire.');
    expect(rows.find((r) => r.label === 'Membru A.C.S.')?.value).toBe('Toți pornesc de la Nu.');
    expect(NEW_SEASON_COPY.acsBold + NEW_SEASON_COPY.acsRest()).toBe('Membru A.C.S. nu se copiază, toți pornesc de la Nu.');
    expect(NEW_SEASON_COPY.programRest('1 sep', '30 iun')).toContain('Pauzele nu se copiază.');
    expect(NEW_SEASON_COPY.programRest('1 sep', '30 iun')).not.toContain('vacanțele');
    expect(NEW_SEASON_COPY.schoolWarning('2027-2028')).toBe('Grupele Școlii nu au program în 2027-2028. Pagina Program arată textul vechi.');
  });

  it('keeps placeholders', () => {
    expect(GRUPE_COPY.removeConfirm('X"Y')).toContain('X"Y');
    expect(SCHEDULE_ERRORS.groupEvent('Grupa A')).toContain('Grupa A');
    expect(REACTIVATE_DIALOG.text('Ana Pop')).toContain('Ana Pop');
    expect(NEW_SEASON_COPY.lead1('2027-2028')).toContain('2027-2028');
  });

  it('has no banned characters', () => {
    const banned = /[–—·‘’“”]|\p{Extended_Pictographic}/u;
    const all = [GRUPE_COPY, GROUP_ERRORS, SCHEDULE_ERRORS, NEW_SEASON_COPY, SEASON_ERRORS, PRICE_ERRORS, PREZENTA_COPY, MATRIX_COPY, PERIOD_COPY, COACH_COPY, PAYMENT_COPY, REACTIVATE_DIALOG, SUBSCRIPTION_COPY, BANI_COPY, CONTABILITATE_COPY, MONEY_UI_COPY];
    for (const copy of all) expect(JSON.stringify(copy)).not.toMatch(banned);
  });

  it('Sezoane, Prețuri, Program and Bani screens', () => {
    for (const f of ['admin/dashboard/grupe/GroupDialog.tsx', 'admin/dashboard/grupe/ProgramDrawer.tsx', 'admin/dashboard/grupe/DatePanel.tsx']) expect(src(f)).not.toContain('Opțional');
    expect(src('admin/dashboard/grupe/GroupDialog.tsx')).not.toContain('publicHint');
    const season = src('admin/pages/sezoane/SeasonDrawer.tsx');
    expect(season).toContain('HelpTip icon="lock"');
    expect(SEASON_ERRORS.locked).toBe('Are înscrieri, nu se mai schimbă.');
    const list = src('admin/pages/preturi/PriceListCard.tsx');
    expect(list).not.toContain('Preț incomplet');
    expect(list).not.toContain('are tooltip');
    expect(list).toContain('HelpTip');
    expect(src('admin/pages/preturi/PriceItemDrawer.tsx')).not.toContain('Opțional');
    expect(BANI_COPY.paidTip).toBe('Plătit din ce s-a datorat în luna asta.');
    expect(src('admin/dashboard/bani/BaniBreakdown.tsx')).toMatch(/cols\.paid\} <HelpTip label=\{BANI_COPY\.paidTip\}/);
    expect(src('admin/pages/PaginaProgramPage.tsx')).toContain('body="Se editează în pagina Program."');
    expect(src('admin/pages/PaginaProgramPage.tsx')).not.toContain('Aici poți edita');
    expect(src('admin/pages/PaginaProgramPage.tsx')).toContain('Se setează în Setări site.');
  });
});
