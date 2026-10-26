import { describe, expect, it } from 'vitest';
import type { ConfirmationRecord } from '../plan';
import { planUndo, undoAllowed, type UndoFacts } from '../undo-plan';

const record = (over: Partial<ConfirmationRecord> = {}): ConfirmationRecord => ({
  athleteId: 'a1',
  createdAthlete: false,
  previousStatus: 'Contactat',
  athleteStatusBefore: 'inactiv',
  fieldsBefore: { phone: '0711000000' },
  fieldsAfter: { phone: '0722111222' },
  membershipId: 'm9',
  demotedMainId: 'm0',
  acs: { id: 'c9', previous: null },
  at: '2026-10-26T10:00:00.000Z',
  ...over,
});
const facts = (over: Partial<UndoFacts> = {}): UndoFacts => ({
  record: record(),
  linkedAthleteId: 'a1',
  athlete: { id: 'a1', status: 'activ', profileId: null, name: 'Maria Pop', birthDate: '2016-03-14', contactName: 'Ana Pop', phone: '0722111222', email: null },
  membershipIds: ['m0', 'm9'],
  acsRows: [{ id: 'c9', state: 'in_asteptare' }],
  otherRegistrations: 0,
  ...over,
});

describe('undo reverts what the confirmation wrote (spec 4.6, gaps #32)', () => {
  it('link, status, group, main group, A.C.S., fields and reactivation', () => {
    expect(planUndo(facts())).toEqual({
      registration: { status: 'Contactat' },
      deleteMembershipId: 'm9',
      restoreMainId: 'm0',
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
    const plan = planUndo(facts({ record: record({ membershipId: null, demotedMainId: 'm0' }) }));
    expect(plan.deleteMembershipId).toBeNull();
    expect(plan.restoreMainId).toBe('m0');
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
