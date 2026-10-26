import { describe, expect, it } from 'vitest';
import type { AthleteValues } from '../../athlete-data';
import { CONFIRM_ERRORS } from '../../athletes/errors';
import { confirmationHistory } from '../history';
import {
  canConfirm,
  canUndo,
  confirmRefusal,
  confirmationRecord,
  planConfirmation,
  readConfirmRequest,
  type ConfirmFacts,
  type ConfirmRequest,
} from '../plan';

const values = (over: Partial<AthleteValues> = {}): AthleteValues => ({
  name: 'Maria Pop', birthDate: '2016-03-14', contactName: 'Ana Pop', phone: '0722111222', email: 'ana@example.com', ...over,
});
const SEASON = { id: 's26', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31' };
const facts = (over: Partial<ConfirmFacts> = {}): ConfirmFacts => ({
  registration: { id: 'r1', number: '2026-0142', status: 'Nou', membershipAnswer: 'da', values: values() },
  athlete: null,
  season: SEASON,
  running: true,
  today: { year: 2026, month: 10, day: 26 },
  seasonMemberships: [],
  seasonAcs: null,
  group: { id: 'g-pp', name: 'Primii Pași' },
  makeMain: false,
  updateFields: [],
  ...over,
});
const existing = (over: Partial<AthleteValues & { status: 'nou' | 'activ' | 'inactiv' }> = {}) => ({ id: 'a1', status: 'activ' as const, ...values({ phone: '0711000000' }), ...over });

describe('Sportiv nou (spec 4.5)', () => {
  it('creates the athlete activ from the registration, adds the group as main, sets A.C.S. În așteptare', () => {
    const plan = planConfirmation(facts());
    expect(plan.newAthlete).toEqual({ ...values(), status: 'activ', dataIncomplete: false });
    expect(plan.membership).toEqual({ groupId: 'g-pp', seasonId: 's26', isMain: true, from: '2026-10-26' });
    expect(plan.acs).toEqual({ existingId: null, seasonId: 's26', seasonLabel: '2026-2027', from: null, to: 'in_asteptare' });
    expect(plan.groupName).toBe('Primii Pași');
  });

  it('marks "Date incomplete" when the registration lacks a field', () => {
    expect(planConfirmation(facts({ registration: { ...facts().registration, values: values({ email: null }) } })).newAthlete?.dataIncomplete).toBe(true);
  });

  it('season ended: links only, no group, no A.C.S. (r3b c9)', () => {
    const plan = planConfirmation(facts({ running: false }));
    expect([plan.membership, plan.acs, plan.groupName]).toEqual([null, null, null]);
    expect(plan.newAthlete).not.toBeNull();
  });

  it('no group picked: "Fără grupă deocamdată"', () => {
    expect(planConfirmation(facts({ group: null })).membership).toBeNull();
  });
});

describe('Sportiv existent (spec 4.5)', () => {
  it('applies only the ticked fields and recomputes "Date incomplete"', () => {
    const plan = planConfirmation(facts({ athlete: existing({ email: null }), updateFields: ['phone'] }));
    expect(plan.athleteUpdate).toEqual({ phone: '0722111222', dataIncomplete: true });
    expect(plan.fieldChanges).toEqual({ phone: { from: '0711000000', to: '0722111222' } });
    expect([plan.newAthlete, plan.statusChange, plan.renameProfile]).toEqual([null, null, null]);
  });

  it('reactivates an inactive athlete and makes a "nou" one activ (r4 e7)', () => {
    expect(planConfirmation(facts({ athlete: existing({ status: 'inactiv' }) })).statusChange).toEqual({ from: 'inactiv', to: 'activ' });
    const plan = planConfirmation(facts({ athlete: existing({ status: 'nou' }) }));
    expect([plan.statusChange, plan.athleteUpdate?.status]).toEqual([{ from: 'nou', to: 'activ' }, 'activ']);
  });

  it('a ticked name renames the public profile (spec 4.2)', () => {
    expect(planConfirmation(facts({ athlete: existing({ name: 'Maria Popa' }), updateFields: ['name'] })).renameProfile).toBe('Maria Pop');
  });

  it('keeps the current main group unless "Grupă principală" is ticked (r3b c8)', () => {
    const own = [{ id: 'm1', groupId: 'g-pro', isMain: true }];
    expect(planConfirmation(facts({ athlete: existing(), seasonMemberships: own }))).toMatchObject({ membership: { isMain: false }, demoteMainId: null });
    expect(planConfirmation(facts({ athlete: existing(), seasonMemberships: own, makeMain: true }))).toMatchObject({ membership: { isMain: true }, demoteMainId: 'm1' });
  });

  it('writes nothing twice: a group or A.C.S. already there stays (r4 e5)', () => {
    const plan = planConfirmation(facts({ athlete: existing(), seasonMemberships: [{ id: 'm1', groupId: 'g-pp', isMain: true }], seasonAcs: { id: 'x', state: 'in_asteptare' } }));
    expect([plan.membership, plan.demoteMainId, plan.acs, plan.groupName]).toEqual([null, null, null, 'Primii Pași']);
  });

  it('a new group becomes main when the athlete has groups this season but none is main (invariant)', () => {
    const plan = planConfirmation(facts({ athlete: existing(), seasonMemberships: [{ id: 'm1', groupId: 'g-pro', isMain: false }] }));
    expect(plan.membership).toMatchObject({ groupId: 'g-pp', isMain: true });
    expect(plan.demoteMainId).toBeNull();
  });

  it('promotes an already-present group to main when "Grupă principală" is ticked', () => {
    const plan = planConfirmation(
      facts({
        athlete: existing(),
        seasonMemberships: [
          { id: 'm1', groupId: 'g-pro', isMain: true },
          { id: 'm2', groupId: 'g-pp', isMain: false },
        ],
        makeMain: true,
      }),
    );
    expect(plan.membership).toBeNull();
    expect(plan.promoteMembershipId).toBe('m2');
    expect(plan.demoteMainId).toBe('m1');
  });

  it('leaves an already-present non-main group alone when the tick is off', () => {
    const plan = planConfirmation(
      facts({
        athlete: existing(),
        seasonMemberships: [
          { id: 'm1', groupId: 'g-pro', isMain: true },
          { id: 'm2', groupId: 'g-pp', isMain: false },
        ],
      }),
    );
    expect([plan.membership, plan.demoteMainId, plan.promoteMembershipId]).toEqual([null, null, null]);
  });

  it('a hand-ticked field that only differs from the athlete in format is not written or logged', () => {
    const plan = planConfirmation(
      facts({
        athlete: existing({ phone: '0722111222', email: 'Ana@Example.com ' }),
        updateFields: ['phone', 'email'],
        registration: { ...facts().registration, values: values({ phone: '0722 111 222', email: 'ana@example.com' }) },
      }),
    );
    expect(plan.fieldChanges).toEqual({});
    expect(plan.athleteUpdate).not.toHaveProperty('phone');
    expect(plan.athleteUpdate).not.toHaveProperty('email');
  });
});

describe('A.C.S. (spec 1.4, gaps #30, N8)', () => {
  it('never lowers Da; raises Nu to În așteptare', () => {
    expect(planConfirmation(facts({ athlete: existing(), seasonAcs: { id: 'x', state: 'da' } })).acs).toBeNull();
    expect(planConfirmation(facts({ athlete: existing(), seasonAcs: { id: 'x', state: 'nu' } })).acs).toMatchObject({ existingId: 'x', from: 'nu', to: 'in_asteptare' });
  });

  it('wish Nu, or no wish on an old registration, writes nothing', () => {
    expect(planConfirmation(facts({ registration: { ...facts().registration, membershipAnswer: 'nu' } })).acs).toBeNull();
    expect(planConfirmation(facts({ registration: { ...facts().registration, membershipAnswer: null } })).acs).toBeNull();
  });
});

describe('what the undo needs', () => {
  it('records the old and new values, the rows written and the status before', () => {
    const f = facts({ athlete: existing({ status: 'inactiv' }), updateFields: ['phone'], seasonMemberships: [{ id: 'm0', groupId: 'g-pro', isMain: true }], makeMain: true });
    const plan = planConfirmation(f);
    expect(confirmationRecord({ plan, facts: f, athleteId: 'a1', membershipId: 'm9', acsId: 'c9', at: '2026-10-26T10:00:00.000Z' })).toEqual({
      athleteId: 'a1',
      createdAthlete: false,
      previousStatus: 'Nou',
      athleteStatusBefore: 'inactiv',
      fieldsBefore: { phone: '0711000000' },
      fieldsAfter: { phone: '0722111222' },
      membershipId: 'm9',
      demotedMainId: 'm0',
      promotedMainId: null,
      acs: { id: 'c9', previous: null },
      at: '2026-10-26T10:00:00.000Z',
    });
  });

  it('records which membership was promoted to main, for the undo to demote it back', () => {
    const f = facts({
      athlete: existing(),
      seasonMemberships: [
        { id: 'm1', groupId: 'g-pro', isMain: true },
        { id: 'm2', groupId: 'g-pp', isMain: false },
      ],
      makeMain: true,
    });
    const plan = planConfirmation(f);
    const record = confirmationRecord({ plan, facts: f, athleteId: 'a1', membershipId: null, acsId: null, at: '2026-10-26T10:00:00.000Z' });
    expect(record.promotedMainId).toBe('m2');
    expect(record.demotedMainId).toBe('m1');
  });
});

describe('history on both records (spec 1.6)', () => {
  it('writes the confirmation, the field updates, the group, A.C.S. and the reactivation', () => {
    const plan = planConfirmation(facts({ athlete: existing({ status: 'inactiv' }), updateFields: ['phone'] }));
    const entries = confirmationHistory({ plan, registrationId: 'r1', registrationNumber: '2026-0142', athleteId: 'a1', athleteName: 'Maria Pop', actor: 'ana@club.ro' });
    expect(entries.map((e) => [e.subjectType, e.action])).toEqual([
      ['registration-submission', 'confirmed'],
      ['athlete', 'registration-confirmed'],
      ['athlete', 'updated'],
      ['athlete', 'group-added'],
      ['athlete', 'acs-changed'],
      ['athlete', 'reactivated'],
    ]);
    expect(entries[0].changes).toEqual({ athleteName: 'Maria Pop', createdAthlete: false, groupName: 'Primii Pași' });
    expect(entries[2].changes).toEqual({ fields: { phone: { from: '0711000000', to: '0722111222' } }, registrationNumber: '2026-0142' });
  });

  it('a "nou" athlete gets a status line instead of "Reactivat"', () => {
    const plan = planConfirmation(facts({ athlete: existing({ status: 'nou' }), running: false }));
    const entries = confirmationHistory({ plan, registrationId: 'r1', registrationNumber: '2026-0142', athleteId: 'a1', athleteName: 'Maria Pop', actor: 'a' });
    expect(entries.map((e) => e.action)).toEqual(['confirmed', 'registration-confirmed', 'status-changed']);
  });
});

describe('request and refusals (spec 4.7, 3.5)', () => {
  const request: ConfirmRequest = { choice: 'existing', athleteId: 'a1', groupId: null, makeMain: false, updateFields: null };
  const reg = { status: 'Nou' as const, archived: false, athleteId: null, childBirthDate: '14.03.2016' };

  it('reads the body', () => {
    expect(readConfirmRequest({ choice: 'existing', athleteId: ' a1 ', groupId: '', updateFields: ['phone', 'x'], makeMain: true })).toEqual({
      choice: 'existing', athleteId: 'a1', groupId: null, makeMain: true, updateFields: ['phone'],
    });
    expect(readConfirmRequest({ choice: 'new', athleteId: 'a1' })).toMatchObject({ athleteId: null, updateFields: null });
    expect(readConfirmRequest({ choice: 'maybe' })).toBeNull();
  });

  it('refuses a second confirmation, Respins, archived, an unreadable date, a missing athlete', () => {
    expect(confirmRefusal({ ...reg, athleteId: 'a9' }, request)).toEqual({ status: 409, error: CONFIRM_ERRORS.taken });
    expect(confirmRefusal({ ...reg, status: 'Respins' }, request)).toEqual({ status: 400, error: CONFIRM_ERRORS.failed });
    expect(confirmRefusal({ ...reg, archived: true }, request)).toEqual({ status: 400, error: CONFIRM_ERRORS.failed });
    expect(confirmRefusal({ ...reg, childBirthDate: 'martie' }, request)).toEqual({ status: 400, error: CONFIRM_ERRORS.birthDate });
    expect(confirmRefusal(reg, { ...request, athleteId: null })).toEqual({ status: 400, error: CONFIRM_ERRORS.failed });
    expect(confirmRefusal({ ...reg, status: 'Confirmat' }, request)).toBeNull();
  });

  it('offers the undo only on a registration confirmed through the window', () => {
    const record = { athleteId: 'a1' } as Parameters<typeof canUndo>[0]['confirmation'];
    expect(canUndo({ athleteId: 'a1', confirmation: record })).toBe(true);
    expect(canUndo({ athleteId: 'a1', confirmation: null })).toBe(false);
    expect(canConfirm({ ...reg })).toBe(true);
  });
});
