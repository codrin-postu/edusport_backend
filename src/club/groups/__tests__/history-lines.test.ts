import { describe, expect, it } from 'vitest';
import { historyTexts } from '../../history-text';
import { P4_ACTIONS, athleteIdsOf, groupHistoryTexts, phase4Lines } from '../history-lines';

const NAMES = { a1: 'Ana Ionescu', a2: 'Elisa Georgescu' };
const series = { freq: 'weekly', days: ['sat', 'sun'], startTime: '11:00', durationMin: 50, from: '2026-10-04' };
const lines = (action: string, changes: Record<string, unknown>) => phase4Lines(action, changes, NAMES);

describe('group roster lines (3.7, W1, decided 1 and 2)', () => {
  it('names the athlete from the current name, never a stored one', () => {
    expect(lines(P4_ACTIONS.memberAllocated, { athleteId: 'a2' })).toEqual(['Sportiv alocat: Elisa Georgescu.']);
    expect(lines(P4_ACTIONS.memberAdded, { athleteId: 'a2' })).toEqual(['Sportiv adăugat: Elisa Georgescu.']);
    expect(lines(P4_ACTIONS.memberRemoved, { athleteId: 'a1' })).toEqual(['Sportiv scos: Ana Ionescu.']);
  });

  it('writes the move on both groups, the main sentence on the group left', () => {
    expect(lines(P4_ACTIONS.memberMovedOut, { athleteId: 'a1', toGroup: 'Intermediari Silver', main: { from: 'Intermediari Bronze', to: 'Intermediari Silver' } }))
      .toEqual(['Mutat în Intermediari Silver: Ana Ionescu. Grupa principală schimbată: Intermediari Bronze → Intermediari Silver']);
    expect(lines(P4_ACTIONS.memberMovedOut, { athleteId: 'a1', toGroup: 'Avansați', main: null })).toEqual(['Mutat în Avansați: Ana Ionescu.']);
    expect(lines(P4_ACTIONS.memberMovedIn, { athleteId: 'a1', fromGroup: 'Intermediari Bronze' })).toEqual(['Mutat din Intermediari Bronze: Ana Ionescu.']);
  });

  it('writes the group settings one line per field', () => {
    expect(lines(P4_ACTIONS.groupCreated, {})).toEqual(['Grupă creată.']);
    expect(lines(P4_ACTIONS.groupUpdated, { fields: { name: { from: 'Grupa A', to: 'Grupa B' }, programPublic: { from: true, to: false } } }))
      .toEqual(['Nume: "Grupa A" → "Grupa B"', 'Program public: "Da" → "Nu"']);
  });
});

describe('athlete lines', () => {
  it('reads like the P3 lines', () => {
    expect(lines(P4_ACTIONS.athleteMoved, { from: 'Intermediari Bronze', to: 'Intermediari Silver' })).toEqual(['Mutat din Intermediari Bronze în Intermediari Silver']);
    expect(lines(P4_ACTIONS.athleteRemoved, { groupName: 'Avansați' })).toEqual(['Scos din grupa Avansați']);
    expect(lines(P4_ACTIONS.athleteCopied, { season: '2027-2028', groups: [{ name: 'Avansați', main: true }, { name: 'Profesioniști', main: false }] }))
      .toEqual(['Copiat în 2027-2028: Avansați (principală), Profesioniști.']);
  });
});

describe('program lines (3.7, decided 10 to 12)', () => {
  it('adds, changes and ends a series', () => {
    expect(lines(P4_ACTIONS.programAdded, { series })).toEqual(['Program adăugat: Sâ și Du, 11:00, 50 min, din 4 oct 2026.']);
    expect(lines(P4_ACTIONS.programChanged, { from: '2026-11-21', before: series, after: { ...series, startTime: '12:00' } }))
      .toEqual(['Program schimbat din 21 nov 2026: Sâ și Du, 11:00, 50 min → Sâ și Du, 12:00, 50 min.']);
    expect(lines(P4_ACTIONS.programEnded, { from: '2026-12-01', series })).toEqual(['Program șters din 1 dec 2026: Sâ și Du, 11:00, 50 min.']);
  });

  it('adds and deletes a single class', () => {
    expect(lines(P4_ACTIONS.classAdded, { date: '2026-11-20', startTime: '18:00', durationMin: 60 })).toEqual(['Ședință unică adăugată: vineri, 20 noiembrie, 18:00, 60 min.']);
    expect(lines(P4_ACTIONS.classDeleted, { date: '2026-11-20', startTime: '18:00' })).toEqual(['Ședință unică ștearsă: vineri, 20 noiembrie, 18:00.']);
  });

  it('cancels, moves and keeps a date', () => {
    expect(lines(P4_ACTIONS.dateCancelled, { date: '2026-11-14', reason: 'Competiție la Brașov', emails: 9 }))
      .toEqual(['Ședința din 14 noiembrie anulată: Competiție la Brașov. Părinții anunțați pe e-mail.']);
    expect(lines(P4_ACTIONS.dateCancelled, { date: '2026-11-14', reason: 'Gheață topită!', emails: 0 })).toEqual(['Ședința din 14 noiembrie anulată: Gheață topită!']);
    expect(lines(P4_ACTIONS.dateCancelled, { date: '2026-11-14', reason: null, emails: 0 })).toEqual(['Ședința din 14 noiembrie anulată.']);
    expect(lines(P4_ACTIONS.dateMoved, { date: '2026-11-21', newDate: '2026-11-22', newStartTime: '12:00', emails: 3 }))
      .toEqual(['Ședința din 21 noiembrie mutată: 22 noiembrie, 12:00. Părinții anunțați pe e-mail.']);
    expect(lines(P4_ACTIONS.dateKept, { date: '2026-11-14' })).toEqual(['Ședința din 14 noiembrie se ține.']);
  });
});

describe('break and season lines', () => {
  it('writes the Pauze lines', () => {
    expect(lines(P4_ACTIONS.breakAdded, { label: 'Vacanța de iarnă', startDate: '2026-12-20', endDate: '2027-01-06' }))
      .toEqual(['Pauză adăugată: Vacanța de iarnă, 20 dec 2026 - 6 ian 2027.']);
    expect(lines(P4_ACTIONS.breakUpdated, { fields: { endDate: { from: '2027-01-06', to: '2027-01-08' } } })).toEqual(['Până la: "6 ian 2027" → "8 ian 2027"']);
    expect(lines(P4_ACTIONS.breakDeleted, { label: 'Vacanța de iarnă' })).toEqual(['Pauză ștearsă: Vacanța de iarnă.']);
  });

  it('writes the new season lines, parts with 0 left out (decided 9)', () => {
    expect(lines(P4_ACTIONS.currentChanged, { from: false, to: true })).toEqual(['Curent: "Nu" → "Da"']);
    expect(lines(P4_ACTIONS.seasonCopied, { from: '2026-2027', athletes: 14, groups: 2, series: 10 })).toEqual(['Copiat din 2026-2027: 14 sportivi în 2 grupe, 10 programe.']);
    expect(lines(P4_ACTIONS.seasonCopied, { from: '2026-2027', athletes: 0, groups: 0, series: 1 })).toEqual(['Copiat din 2026-2027: 1 program.']);
    expect(lines(P4_ACTIONS.seasonCopied, { from: '2026-2027', athletes: 0, groups: 0, series: 0 })).toEqual([]);
    expect(lines(P4_ACTIONS.membersCopied, { from: '2026-2027', count: 11 })).toEqual(['Sportivi copiați din 2026-2027: 11.']);
    expect(lines(P4_ACTIONS.programCopied, { from: '2026-2027', series: { ...series, from: '2027-10-01' } })).toEqual(['Program copiat din 2026-2027: Sâ și Du, 11:00, 50 min, din 1 oct 2027.']);
  });
});

describe('undo lines (3.7, W15)', () => {
  it('prefixes the undone line on a group', () => {
    expect(groupHistoryTexts(P4_ACTIONS.undone, { undoneAction: P4_ACTIONS.memberAllocated, undoneChanges: { athleteId: 'a2' } }, NAMES))
      .toEqual(['Anulat: Sportiv alocat: Elisa Georgescu.']);
  });

  it('renders on an athlete through the P3 Istoric, P3 lines included', () => {
    expect(historyTexts(P4_ACTIONS.undone, { undoneAction: 'group-added', undoneChanges: { groupName: 'Avansați' } }, 'athlete')).toEqual(['Anulat: Adăugat în grupa Avansați']);
    expect(historyTexts(P4_ACTIONS.athleteRemoved, { groupName: 'Avansați' }, 'athlete')).toEqual(['Scos din grupa Avansați']);
  });

  it('collects the athlete ids a group line names, inner undo lines included', () => {
    expect(athleteIdsOf({ undoneAction: P4_ACTIONS.memberAdded, undoneChanges: { athleteId: 'a1' } })).toEqual(['a1']);
    expect(athleteIdsOf({ athleteId: 'a2' })).toEqual(['a2']);
  });

  it('reads a deleted or merged-away athlete as Sportiv șters', () => {
    expect(lines(P4_ACTIONS.memberRemoved, { athleteId: 'gone' })).toEqual(['Sportiv scos: Sportiv șters.']);
    expect(lines(P4_ACTIONS.memberAllocated, {})).toEqual(['Sportiv alocat: Sportiv șters.']);
  });

  it('is null for an action that is not phase 4, and tolerates bad stored values', () => {
    expect(phase4Lines('confirmed', {}, NAMES)).toBeNull();
    expect(lines(P4_ACTIONS.programAdded, { series: 'broken' })).toEqual([]);
  });
});
