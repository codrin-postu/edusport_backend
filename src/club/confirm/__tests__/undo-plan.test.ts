import { describe, expect, it } from 'vitest';
import type { ConfirmationRecord } from '../plan';
import { planUndo, undoAllowed, undoSeasonId, type UndoFacts } from '../undo-plan';

const record = (over: Partial<ConfirmationRecord> = {}): ConfirmationRecord => ({
  athleteId: 'a1',
  createdAthlete: false,
  previousStatus: 'Contactat',
  athleteStatusBefore: 'inactiv',
  fieldsBefore: { phone: '0711000000' },
  fieldsAfter: { phone: '0722111222' },
  membershipId: 'm9',
  demotedMainId: 'm0',
  promotedMainId: null,
  acs: { id: 'c9', previous: null },
  at: '2026-10-26T10:00:00.000Z',
  ...over,
});
const facts = (over: Partial<UndoFacts> = {}): UndoFacts => ({
  currentRows: (over.membershipIds ?? ['m0', 'm9']).map((id) => ({ id, athleteId: 'a1', groupId: `g-${id}`, seasonId: 's26', isMain: false, from: '2026-10-01' })),
  seasonId: 's26',
  record: record(),
  linkedAthleteId: 'a1',
  athlete: { id: 'a1', status: 'activ', profileId: null, name: 'Maria Pop', birthDate: '2016-03-14', contactName: 'Ana Pop', phone: '0722111222', email: null },
  membershipIds: ['m0', 'm9'],
  mainMembershipId: 'm9',
  acsRows: [{ id: 'c9', state: 'in_asteptare' }],
  otherRegistrations: 0,
  ...over,
});

describe('the season keeps one main (spec 2 rule 2)', () => {
  const row = (id: string, from: string | null) => ({ id, athleteId: 'a1', groupId: `g-${id}`, seasonId: 's26', isMain: false, from });
  const ended = (over: Partial<UndoFacts> = {}) => facts({ record: record({ demotedMainId: 'm0' }), membershipIds: ['m0', 'm9', 'x1', 'x2'], ...over });

  it('the demoted row ended: the earliest remaining current row becomes main', () => {
    const plan = planUndo(ended({ currentRows: [row('m9', '2026-10-26'), row('x1', '2026-11-05'), row('x2', '2026-11-01')] }));
    expect([plan.restoreMainId, plan.promoteMainId]).toEqual([null, 'x2']);
  });

  it('no current row left: no main', () => {
    const plan = planUndo(ended({ currentRows: [row('m9', '2026-10-26')] }));
    expect([plan.restoreMainId, plan.promoteMainId]).toEqual([null, null]);
  });
});

describe('undo reverts what the confirmation wrote (spec 4.6, gaps #32)', () => {
  it('link, status, group, main group, A.C.S., fields and reactivation', () => {
    expect(planUndo(facts())).toEqual({
      registration: { status: 'Contactat' },
      deleteMembershipId: 'm9',
      restoreMainId: 'm0',
      promoteMainId: null,
      demoteMembershipId: null,
      acs: { op: 'delete', id: 'c9' },
      athleteUpdate: { phone: '0711000000', status: 'inactiv', dataIncomplete: true },
      revertedFields: { phone: { from: '0722111222', to: '0711000000' } },
      renameProfile: null,
      deleteAthlete: false,
    });
  });

  it('keeps a field the admin changed after the confirmation', () => {
    const plan = planUndo(facts({ athlete: { ...facts().athlete, phone: '0799999999' } }));
    expect(plan.revertedFields).toEqual({});
    expect(plan.athleteUpdate).toEqual({ status: 'inactiv', dataIncomplete: true });
  });

  it('sets a raised A.C.S. back, but never lowers one paid in between', () => {
    expect(planUndo(facts({ record: record({ acs: { id: 'c9', previous: 'nu' } }) })).acs).toEqual({ op: 'set', id: 'c9', state: 'nu' });
    expect(planUndo(facts({ acsRows: [{ id: 'c9', state: 'da' }] })).acs).toBeNull();
  });

  it('renames the profile back when the name is reverted', () => {
    const plan = planUndo(facts({
      record: record({ fieldsBefore: { name: 'Maria Popa' }, fieldsAfter: { name: 'Maria Pop' } }),
      athlete: { ...facts().athlete, profileId: 'sp1' },
    }));
    expect(plan.renameProfile).toBe('Maria Popa');
  });

  it('restores the previous main when the picked group was already present (fix/p3-2-g3: no membership created, so nothing to delete)', () => {
    const plan = planUndo(facts({ record: record({ membershipId: null, demotedMainId: 'm0' }), mainMembershipId: null }));
    expect(plan.deleteMembershipId).toBeNull();
    expect(plan.restoreMainId).toBe('m0');
  });

  it('does not restore the old main when a later admin action already made a different one main (Minor 3)', () => {
    const plan = planUndo(facts({ mainMembershipId: 'm3', membershipIds: ['m0', 'm9', 'm3'] }));
    expect(plan.restoreMainId).toBeNull();
  });

  it('restores the old main once the demotion leaves the season with none (Minor 3)', () => {
    const plan = planUndo(facts({ mainMembershipId: null }));
    expect(plan.restoreMainId).toBe('m0');
  });

  it('demotes a promoted existing group and restores the previous main (fix/p3-2-g3, with a previous main)', () => {
    const plan = planUndo(facts({
      record: record({ membershipId: null, demotedMainId: 'm0', promotedMainId: 'm9' }),
      membershipIds: ['m0', 'm9'],
      mainMembershipId: 'm9',
    }));
    expect(plan.deleteMembershipId).toBeNull();
    expect(plan.demoteMembershipId).toBe('m9');
    expect(plan.restoreMainId).toBe('m0');
  });

  it('demotes a promoted existing group with no previous main to restore (fix/p3-2-g3, without a previous main)', () => {
    const plan = planUndo(facts({
      record: record({ membershipId: null, demotedMainId: null, promotedMainId: 'm9' }),
      membershipIds: ['m9'],
      mainMembershipId: 'm9',
    }));
    expect(plan.deleteMembershipId).toBeNull();
    expect(plan.demoteMembershipId).toBe('m9');
    expect(plan.restoreMainId).toBeNull();
  });

  it('never demotes a group that a later admin action already changed', () => {
    const stillMain = planUndo(facts({ record: record({ membershipId: null, promotedMainId: 'm9' }), mainMembershipId: 'm0' }));
    expect(stillMain.demoteMembershipId).toBeNull();

    const gone = planUndo(facts({ record: record({ membershipId: null, promotedMainId: 'm9' }), membershipIds: ['m0'], mainMembershipId: null }));
    expect(gone.demoteMembershipId).toBeNull();
  });
});

describe('a "Sportiv nou" record', () => {
  const created = record({ createdAthlete: true, athleteStatusBefore: null, fieldsBefore: {}, fieldsAfter: {}, demotedMainId: null });

  it('is removed when it has nothing else', () => {
    const plan = planUndo(facts({ record: created, membershipIds: ['m9'] }));
    expect([plan.deleteAthlete, plan.athleteUpdate, plan.deleteMembershipId]).toEqual([true, null, 'm9']);
  });

  it('stays when it has another registration, group, A.C.S. status or a public profile (N9)', () => {
    expect(planUndo(facts({ record: created, membershipIds: ['m9'], otherRegistrations: 1 })).deleteAthlete).toBe(false);
    expect(planUndo(facts({ record: created, membershipIds: ['m9', 'm3'] })).deleteAthlete).toBe(false);
    expect(planUndo(facts({ record: created, membershipIds: ['m9'], acsRows: [{ id: 'c9', state: 'da' }] })).deleteAthlete).toBe(false);
    expect(planUndo(facts({ record: created, membershipIds: ['m9'], athlete: { ...facts().athlete, profileId: 'sp1' } })).deleteAthlete).toBe(false);
  });
});

describe('undoAllowed', () => {
  it('only while the registration is still linked to the athlete the confirmation wrote', () => {
    expect(undoAllowed(record(), 'a1', 'a1')).toBe(true);
    expect(undoAllowed(record(), 'a2', 'a2')).toBe(false);
    expect(undoAllowed(record(), 'a1', null)).toBe(false);
  });
});

describe('undoSeasonId (final review I1)', () => {
  const rows = [{ id: 'm0', seasonId: 's25' }, { id: 'm9', seasonId: 's26' }];

  it('uses the season stored at confirm time, also when it is null', () => {
    expect(undoSeasonId(record({ seasonId: 's26' }), rows, 's27')).toBe('s26');
    expect(undoSeasonId(record({ seasonId: null }), rows, 's27')).toBeNull();
  });

  it('an older record without it: the season of a membership it names, else the registration season', () => {
    expect(undoSeasonId(record({ membershipId: null, demotedMainId: 'm0' }), rows, 's27')).toBe('s25');
    expect(undoSeasonId(record({ membershipId: 'gone', demotedMainId: null }), rows, 's27')).toBe('s27');
  });
});
