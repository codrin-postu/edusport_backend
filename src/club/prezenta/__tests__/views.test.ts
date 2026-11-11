import { describe, expect, it } from 'vitest';
import type { AthleteCard } from '../../athletes/api-types';
import type { DayRow, LessonListRow, PanelRow, SessionPanel } from '../../presence/attendance/api-types';
import { addVisitor, addCoachField, answerInactive, coachIdsOf, footerCounts, isDirty, readInactive, saveBody, setCoach, toggleTick } from '../panel-view';
import { ABONAMENTE_PATH, DE_INCASAT_PATH, PLATI_PATH, PREZENTA_PATH, prezentaTo, readPrezentaQuery } from '../routes';

const dayRow = (p: Partial<DayRow> = {}): DayRow => ({
  sessionId: null, occurrenceKey: null, groupId: 'g1', groupName: 'Intermediari Bronze', date: '2026-10-27', startTime: '17:00',
  coachNames: [], present: 0, listed: 0, visitors: 0, state: null, outsideSchedule: false, ...p,
});
const lessonListRow = (p: Partial<LessonListRow> = {}): LessonListRow => ({
  lessonId: 'l1', date: '2026-10-27', startTime: '18:00', athleteId: 'a1', athleteName: 'Ana Ionescu', coachNames: [], durationMin: 50,
  state: 'salvata', present: true, ...p,
});
const panel = (p: Partial<SessionPanel> = {}): SessionPanel => ({
  sessionId: null, occurrenceKey: null, added: null, groupId: 'g1', groupName: 'Intermediari Bronze', kind: 'club', date: '2026-10-27',
  startTime: '17:00', durationMin: 90, outsideSchedule: false, coachIds: [], rows: [], savedLine: null, history: [], ...p,
});
const row = (id: string, p: Partial<PanelRow> = {}): PanelRow => ({
  athleteId: id, name: id, visitor: false, inactive: false, mainGroup: null, abonament: null, grup: false, uscat: false, noSubscription: false, ...p,
});

describe('address (decided 2)', () => {
  it('reads and writes the Prezență query and the module paths', () => {
    expect(readPrezentaQuery('?tab=lectii&month=2026-10', '2026-10-27')).toEqual({ view: 'luna', date: '2026-10-01', show: 'lectii', layout: 'lista' });
    expect(prezentaTo({ view: 'zi', date: '2026-10-26' })).toBe('/plugins/edusport-prezenta?view=zi&date=2026-10-26');
    expect([PREZENTA_PATH, ABONAMENTE_PATH, PLATI_PATH, DE_INCASAT_PATH]).toEqual(['/plugins/edusport-prezenta', '/plugins/edusport-abonamente', '/plugins/edusport-plati', '/plugins/edusport-de-incasat']);
  });
});

describe('panel columns, ticks and footer (5.3, p5 Q3, 4.1)', () => {

  it('counts a visitor in neither x nor y', () => {
    const rows = [row('a1'), row('a2'), row('a7', { visitor: true })];
    expect(footerCounts(rows, { a1: { grup: true, uscat: false }, a7: { grup: true, uscat: false } })).toEqual({ present: 1, listed: 2 });
    expect(footerCounts(rows, toggleTick({}, 'a2', 'uscat'))).toEqual({ present: 1, listed: 2 });
    expect(footerCounts([row('a7', { visitor: true })], { a7: { grup: true, uscat: false } })).toEqual({ present: 0, listed: 0 });
  });
});

describe('dirty state and coaches (5.3, 4.2, decided 7)', () => {
  it('drives the close question from the dirty state', () => {
    const a = { ticks: {}, coaches: ['tm-virgil'], visitors: [] };
    expect(isDirty(a, a)).toBe(false);
    expect(isDirty(a, { ...a, ticks: { a1: { grup: true, uscat: false } } })).toBe(true);
    expect(isDirty({ ...a, ticks: { a1: { grup: true, uscat: false } } }, { ...a, ticks: { a1: { grup: false, uscat: false } } })).toBe(true);
    expect(isDirty(a, { ...a, coaches: ['tm-virgil', 'tm-andreea'] })).toBe(true);
  });

  it('adds, sets and clears coach fields; an extra cleared field is removed', () => {
    expect(addCoachField(['tm-virgil'])).toEqual(['tm-virgil', null]);
    expect(setCoach(['tm-virgil', 'tm-andreea'], 1, null)).toEqual(['tm-virgil']);
    expect(setCoach(['tm-virgil'], 0, null)).toEqual([null]);
    expect(coachIdsOf(['tm-virgil', null, 'tm-virgil', 'tm-andreea'])).toEqual(['tm-virgil', 'tm-andreea']);
  });
});

describe('visitors and the save body (4.7, C45, plan 5-2 decided 2)', () => {
  it('adds a visitor to the table and builds the save body', () => {
    const rows = addVisitor([row('a1')], { documentId: 'a7', name: 'Irina Neagu', lastGroup: { name: 'Avansați Gold', season: '2026-2027' } } as AthleteCard);
    expect(rows[1]).toMatchObject({ athleteId: 'a7', name: 'Irina Neagu', visitor: true, mainGroup: 'Avansați Gold', grup: false });
    const p = panel({ sessionId: null, occurrenceKey: 'ev-ib|2026-11-14|11:00', kind: 'school', rows });
    expect(saveBody(p, { a7: { grup: true, uscat: true }, a1: { grup: false, uscat: false } }, ['tm-virgil', null], { reactivate: [], keepInactive: ['a3'] }))
      .toEqual({ occurrence: 'ev-ib|2026-11-14|11:00', coachIds: ['tm-virgil'], ticks: [{ athleteId: 'a7', grup: true, uscat: false }], reactivate: [], keepInactive: ['a3'] });
    expect(saveBody(panel({ sessionId: 's1' }), {}, ['tm-virgil'], { reactivate: [], keepInactive: [] })).toMatchObject({ id: 's1' });
  });
});

describe('inactive 409 (4.22, decided 4)', () => {
  it('reads the inactive list and collects the answers', () => {
    // The Strapi admin FetchError: status at the top level, response = { data } only.
    const err = { name: 'FetchError', status: 409, response: { data: { error: { details: { inactive: [{ id: 'a3', name: 'Ioana Dinu' }] } } } } };
    expect(readInactive(err)).toEqual([{ id: 'a3', name: 'Ioana Dinu' }]);
    expect(readInactive({ status: 409, response: { data: { error: { message: 'Prezența s-a schimbat între timp. Reîncarcă.' } } } })).toBeNull();
    expect(readInactive({ status: 500, response: { data: { error: { details: { inactive: [{ id: 'a3', name: 'x' }] } } } } })).toBeNull();
    expect(readInactive({ status: 409 })).toBeNull();
    expect(answerInactive(answerInactive({ reactivate: [], keepInactive: [] }, 'a3', true), 'a4', false)).toEqual({ reactivate: ['a3'], keepInactive: ['a4'] });
  });
});
