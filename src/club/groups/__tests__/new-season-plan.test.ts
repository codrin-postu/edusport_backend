import { describe, expect, it } from 'vitest';
import { mainFor, planStart, readStartRequest, type StartRequest } from '../new-season/plan';
import { startPreview, startResult } from '../new-season/preview';
import { member } from './fake-group-store';
import { facts } from './new-season-facts';

const tick = (groupId: string, copyMembers: boolean, copyProgram = true, excludeAthleteIds: string[] = []) => ({ groupId, copyMembers, copyProgram, excludeAthleteIds });
const CLUB_ONLY: StartRequest = { groups: [tick('g-ib', false), tick('g-pro', true)] };

describe('reading the request', () => {
  it('needs a group id per row; booleans default to false', () => {
    expect(readStartRequest({ groups: [{ groupId: 'g-ib', copyMembers: true }] })).toEqual({ groups: [{ groupId: 'g-ib', copyMembers: true, copyProgram: false, excludeAthleteIds: [] }] });
    expect(readStartRequest({ groups: [{ copyMembers: true }] })).toBeNull();
  });
});

describe('who is copied (10.3)', () => {
  it('copies Nou and Activ members of ticked groups from the later of the season start and today; Inactiv and anonymized never', () => {
    const plan = planStart(facts(), CLUB_ONLY);
    expect(plan.members).toEqual([
      { athleteId: 'a1', groupId: 'g-pro', isMain: true, from: '2027-10-01' }, { athleteId: 'a2', groupId: 'g-pro', isMain: true, from: '2027-10-01' },
    ]);
    expect(plan.inactive).toEqual([{ athleteId: 'a3', name: 'Tudor Matei' }]);
    expect(plan.unassignedAfter).toBe(1);
  });

  it('an unticked child is not copied into that group only (W26)', () => {
    const plan = planStart(facts(), { groups: [tick('g-ib', true), tick('g-pro', true, true, ['a1'])] });
    expect(plan.members.filter((m) => m.athleteId === 'a1')).toEqual([{ athleteId: 'a1', groupId: 'g-ib', isMain: true, from: '2027-10-01' }]);
  });

  it('never writes a group twice; an existing main in the new season stays (W25, Review Focus)', () => {
    const f = facts({ memberships: [...facts().memberships, member({ id: 'm9', athleteId: 'a2', groupId: 'g-pro', seasonId: 's27', from: '2027-09-01' }), member({ id: 'm10', athleteId: 'a1', groupId: 'g-av', seasonId: 's27', from: '2027-09-01' })] });
    const plan = planStart(f, CLUB_ONLY);
    expect(plan.members).toEqual([{ athleteId: 'a1', groupId: 'g-pro', isMain: false, from: '2027-10-01' }]);
  });
});

describe('the main group (W25)', () => {
  it('last season\'s main when it is copied; else the copied group joined earliest, then the group order', () => {
    const f = facts();
    expect(mainFor(f, 'a1', ['g-pro', 'g-ib'])).toBe('g-ib');
    expect(mainFor(f, 'a1', ['g-pro'])).toBe('g-pro');
    expect(mainFor(facts({ memberships: [member({ id: 'x1', athleteId: 'a9', groupId: 'g-pp', isMain: true }), member({ id: 'x2', athleteId: 'a9', groupId: 'g-av', isMain: false, from: '2026-10-01' }), member({ id: 'x3', athleteId: 'a9', groupId: 'g-pro', isMain: false, from: '2026-10-01' })] }), 'a9', ['g-av', 'g-pro'])).toBe('g-pro');
  });

  it('keeps exactly one main per athlete in the new season, whatever is ticked', () => {
    const f = facts();
    const variants: StartRequest[] = [
      CLUB_ONLY, { groups: [tick('g-ib', true), tick('g-pro', true)] }, { groups: [tick('g-ib', true), tick('g-pro', true, true, ['a1'])] }, { groups: [tick('g-pro', true), tick('g-ib', true, false, ['a1'])] },
    ];
    for (const req of variants) {
      const plan = planStart(f, req);
      for (const id of new Set(plan.members.map((m) => m.athleteId))) {
        expect(plan.members.filter((m) => m.athleteId === id && m.isMain), JSON.stringify(req)).toHaveLength(1);
      }
    }
    // an athlete who already has a main in the new season gets no second one
    const withMain = facts({ memberships: [...f.memberships, member({ id: 'm9', athleteId: 'a1', groupId: 'g-av', seasonId: 's27', from: '2027-09-01' })] });
    expect(planStart(withMain, { groups: [tick('g-ib', true), tick('g-pro', true)] }).members.filter((m) => m.athleteId === 'a1' && m.isMain)).toHaveLength(0);
  });
});

describe('programs copied (10.3, W27)', () => {
  it('copies the series running on the old season\'s last day into the new window, title = current name, no exceptions', () => {
    const plan = planStart(facts(), CLUB_ONLY);
    expect(plan.series.map((s) => [s.groupId, s.write.title, s.write.recurrence.seasonStart, s.write.recurrence.seasonEnd, s.write.exceptions.length])).toEqual([
      ['g-ib', 'Intermediari Bronze', '2027-10-01', '2028-05-31', 0], ['g-pro', 'Profesioniști', '2027-10-01', '2028-05-31', 0],
    ]);
    expect(plan.series[1].write.recurrence).toMatchObject({ freq: 'weekly', days: ['tue', 'thu'], startTime: '18:00', endTime: '19:30' });
  });

  it('a season started mid-way copies from today (Review Focus)', () => {
    const plan = planStart(facts({ today: '2027-11-03' }), CLUB_ONLY);
    expect([plan.seriesFrom, plan.members[0].from, plan.series[0].write.recurrence.seasonStart]).toEqual(['2027-11-03', '2027-11-03', '2027-11-03']);
  });

  it('does not copy into a group that already has a series in the new season', () => {
    const f = facts({ events: [...facts().events, { ...facts().events[0], id: 'e9', recurrence: { ...facts().events[0].recurrence, seasonStart: '2027-10-04', seasonEnd: '2028-05-31' } }] });
    expect(planStart(f, CLUB_ONLY).series.map((s) => s.groupId)).toEqual(['g-pro']);
  });
});

describe('preview (10.2 step 3, decided 5)', () => {
  it('tiles, lines with bold parts, the always-present A.C.S. line, child mains', () => {
    const f = facts();
    const preview = startPreview(f, planStart(f, CLUB_ONLY));
    expect(preview.tiles).toEqual([
      { label: 'Grupe', value: '5', hint: 'toate trec în 2027-2028' }, { label: 'Sportivi copiați', value: '2', hint: 'în 1 grupă Club' },
      { label: 'Programe copiate', value: '2', hint: 'din 1 oct 2027' }, { label: 'Fără grupă', value: '1', hint: 'grupa din 2026-2027 propusă' },
    ]);
    expect(preview.lines).toEqual([
      { bold: 'Grupa principală se schimbă pentru 1 sportiv.', rest: ' Filip Radu: Intermediari Bronze → Profesioniști.' },
      { bold: 'Rămâne aceeași pentru 1 sportiv', rest: ', de exemplu Ioana Marin: Profesioniști.' },
      { bold: '1 sportiv inactiv nu se copiază:', rest: ' Tudor Matei.' },
      { bold: '1 sportiv intră la Fără grupă', rest: ' în 2027-2028, cu grupa principală din 2026-2027 propusă.' },
      { bold: 'Programul se repetă', rest: ' din 1 oct 2027 până pe 31 mai 2028. Pauzele nu se copiază: adaugă vacanțele în Calendar și serii.' },
      { bold: 'Membru A.C.S. nu se copiază.', rest: ' În 2027-2028 toți pornesc de la Nu.' },
    ]);
    expect(preview.summary).toBe('Se copiază 2 sportivi în 1 grupă și programul a 2 grupe. 1 sportiv rămâne fără grupă, 1 inactiv nu se copiază.');
    expect(preview.mains.a1).toEqual({ groupId: 'g-pro', groupName: 'Profesioniști', previousName: 'Intermediari Bronze', kept: false });
    expect(preview.warning).toBeNull();
  });

  it('warns when no school group gets a program, and leaves out lines whose count is 0', () => {
    const f = facts();
    const preview = startPreview(f, planStart(f, { groups: [tick('g-ib', false, false), tick('g-pro', false, false)] }));
    expect(preview.warning).toBe('Grupele Școlii nu au program în 2027-2028: pagina Program arată textul vechi până îl adaugi.');
    expect(preview.lines.map((l) => l.bold)).toEqual(['1 sportiv inactiv nu se copiază:', '3 sportivi intră la Fără grupă', 'Membru A.C.S. nu se copiază.']);
  });

  it('the result carries the toast', () => {
    const f = facts();
    expect(startResult(f, planStart(f, CLUB_ONLY))).toEqual({ season: '2027-2028', copied: { athletes: 2, groups: 1, series: 2 }, unassigned: 1, toast: '2027-2028 este sezonul curent. 2 sportivi și 2 programe copiate.' });
  });
});
