import { describe, expect, it } from 'vitest';
import { checkNewSession, sessionDefaults } from '../attendance/check';
import { readPanelQuery, readSessionPanel } from '../attendance/panel';
import { attendanceSeed, ok, withSaved14, withSavedClub } from './attendance-seed';
import { attendanceRow, sessionRow } from './fake-store';

describe('session panel, new session check and defaults', () => {
  it('an unsaved Școala occurrence: list by name, empty ticks, abonament status, group coaches (5.3, 4.10)', async () => {
    const f = attendanceSeed();
    f.state.sessions.push(sessionRow({ id: 's7', groupId: 'g-ib', date: '2026-11-07', startTime: '11:00', occurrenceKey: 'ev-ib|2026-11-07|11:00' }));
    f.state.attendances.push(attendanceRow({ id: 't0', sessionId: 's7', athleteId: 'a1', subscriptionId: 'sub-a1', billing: 'slot' }));
    const p = ok(await readSessionPanel(f.store, { occurrence: 'ev-ib|2026-11-15|11:00' }, '2026-11-20'));
    expect([p.groupName, p.kind, p.durationMin, p.coachIds, p.sessionId, p.savedLine]).toEqual(['Intermediari Bronze', 'school', 50, ['tm-virgil'], null, null]);
    expect(p.rows.map((r) => [r.name, r.grup, r.abonament, r.inactive])).toEqual([
      ['Ana Ionescu', false, '7 ședințe rămase', false], ['Ioana Dinu', false, 'Fără abonament', true], ['Mihai Pop', false, 'Fără abonament', false]]);
  });

  it('a saved Club session: ticks, visitor with main group last, saved line, Istoric (5.3, 4.7, C69)', async () => {
    const f = withSavedClub(attendanceSeed());
    const p = ok(await readSessionPanel(f.store, { id: 's13' }, '2026-11-20'));
    expect(p.rows.map((r) => [r.name, r.grup, r.uscat, r.visitor, r.mainGroup, r.abonament])).toEqual([
      ['David Stan', true, true, false, null, null], ['Luca Marin', false, false, false, null, null], ['Irina Neagu', true, false, true, 'Avansați Gold', null]]);
    expect(p.savedLine).toBe('Salvată de Ana Admin, 13 noi 2026 18:05');
    expect(p.history).toEqual(['Prezență salvată: 2 din 2, antrenor Andreea Pascu.']);
  });

  it('an added session not saved yet; unknown targets answer 404', async () => {
    const f = attendanceSeed();
    const p = ok(await readSessionPanel(f.store, { added: { groupId: 'g-ib', date: '2026-11-17', startTime: '18:00', durationMin: 60 } }, '2026-11-20'));
    expect([p.outsideSchedule, p.durationMin, p.rows.length]).toEqual([true, 60, 3]);
    expect((await readSessionPanel(f.store, { occurrence: 'ev-ib|2026-11-17|11:00' }, '2026-11-20')).ok).toBe(false);
    expect(await readSessionPanel(f.store, { id: 'nope' }, '2026-11-20')).toEqual({ ok: false, status: 404, error: 'Nu a fost găsit.' });
  });

  it('"+ Ședință nouă" check (4.5, C21, p5 Q5)', async () => {
    const f = withSaved14(attendanceSeed());
    expect(ok(await checkNewSession(f.store, { groupId: 'g-ib', date: '2026-11-15', startTime: '11:00' }))).toEqual({ kind: 'occurrence', occurrenceKey: 'ev-ib|2026-11-15|11:00' });
    expect(ok(await checkNewSession(f.store, { groupId: 'g-ib', date: '2026-11-14', startTime: '15:00' })))
      .toEqual({ kind: 'existing', sameTime: false, saved: [{ sessionId: 's14', startTime: '11:00', present: 1, listed: 3, savedBy: 'Ana Admin' }] });
    expect(ok(await checkNewSession(f.store, { groupId: 'g-ib', date: '2026-11-14', startTime: '11:00' }))).toMatchObject({ kind: 'existing', sameTime: true });
    expect(ok(await checkNewSession(f.store, { groupId: 'g-ib', date: '2026-11-17', startTime: '18:00' }))).toEqual({ kind: 'free', outsideSchedule: true });
    expect(ok(await checkNewSession(f.store, { groupId: 'g-ib', date: '2026-11-21', startTime: '15:00' }))).toEqual({ kind: 'free', outsideSchedule: false });
    expect((await checkNewSession(f.store, { date: '2026-11-17', startTime: '18:00' })).ok).toBe(false);
  });

  it('defaults for the new session window (C17, C20)', async () => {
    const f = attendanceSeed();
    expect(ok(await sessionDefaults(f.store, { group: 'g-club', date: '2026-11-20' }))).toEqual({ durationMin: 90, coachIds: ['tm-andreea', 'tm-virgil'] });
    expect(ok(await sessionDefaults(f.store, { group: 'g-club', date: '2026-11-17' }))).toEqual({ durationMin: 50, coachIds: ['tm-andreea', 'tm-virgil'] });
  });

  it('reads the panel query', () => {
    expect(readPanelQuery({ occurrence: 'ev-ib|2026-11-15|11:00' })).toEqual({ occurrence: 'ev-ib|2026-11-15|11:00' });
    expect(readPanelQuery({ group: 'g-ib', date: '2026-11-17', time: '18:00', duration: '60' })).toEqual({ added: { groupId: 'g-ib', date: '2026-11-17', startTime: '18:00', durationMin: 60 } });
    expect(readPanelQuery({ group: 'g-ib', date: '2026-11-17', time: '18:00', duration: '52' })).toBeNull();
    expect(readPanelQuery({})).toBeNull();
  });

  it('marks the athlete to highlight only when on the session (4.4)', async () => {
    const f = withSaved14(attendanceSeed());
    expect(ok(await readSessionPanel(f.store, { id: 's14', athlete: 'a1' }, '2026-11-20')).highlightAthleteId).toBe('a1');
    expect(ok(await readSessionPanel(f.store, { id: 's14', athlete: 'other' }, '2026-11-20')).highlightAthleteId).toBeNull();
    expect(ok(await readSessionPanel(f.store, { id: 's14' }, '2026-11-20')).highlightAthleteId).toBeNull();
    expect(readPanelQuery({ id: 's14', athlete: 'a1' })).toEqual({ id: 's14', athlete: 'a1' });
  });
});
