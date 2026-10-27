import { describe, expect, it } from 'vitest';
import type { ConfirmationRecord } from '../../confirm/plan';
import { athleteRow, fakeClubStore, registrationRow, type FakeState } from '../../athletes/__tests__/fake-store';
import { ADMIN_ERRORS } from '../../athletes/errors';
import { HISTORY_ACTIONS, SUBJECT } from '../../history-text';
import { REGISTRATION_NULLED_KEYS } from '../anonymize-plan';
import { anonymizeAthlete, anonymizeAthletes, type AnonymizeContext } from '../anonymize-service';
import { sweepAnonymizedFolders } from '../sweep';

const NOW = new Date('2026-10-27T09:00:00.000Z');
const AT = '2026-10-20T10:00:00.000Z';
const CONFIRMATION: ConfirmationRecord = {
  athleteId: 'a1', createdAthlete: false, previousStatus: 'Contactat', athleteStatusBefore: 'activ', fieldsBefore: { phone: '0722000000', email: 'old@example.com' },
  fieldsAfter: { phone: '0799123456' }, membershipId: 'gm1', demotedMainId: null, promotedMainId: null, acs: null, seasonId: 's26', at: AT,
};

function seed(): Partial<FakeState> {
  return {
    athletes: [
      athleteRow({ id: 'a1', name: 'Ilinca Zamfirescu', birthDate: '2013-04-27', contactName: 'Dana Zamfirescu', phone: '0799123456', email: 'dana@example.com', notes: 'Alergie', profileId: 'sp1' }),
      athleteRow({ id: 'a2', name: 'Irina Pereche', birthDate: '2016-03-14' }),
    ],
    profiles: [{ id: 'sp1', name: 'Ilinca Zamfirescu', slug: 'ilinca-zamfirescu', previousSlugs: [], showPublicPage: true, published: true }],
    registrations: [
      registrationRow({ id: 'r1', childName: 'Ilinca Zamfirescu', parentName: 'Dana Zamfirescu', phone: '0799123456', email: 'dana@example.com', childBirthDate: '27.04.2013', status: 'Confirmat', athleteId: 'a1', lastSeason: 'Începători', confirmation: CONFIRMATION }),
      registrationRow({ id: 'r2', number: '2026-0150', childName: 'Irina Pereche', status: 'Confirmat', athleteId: 'a2', childBirthDateParsed: '2016-03-14' }),
      registrationRow({ id: 'r3', number: '2026-0151', childName: 'Ilinca Zamfirescu', matchAthleteId: 'a1', matchLevel: 'sigur' }),
    ],
    registrationRecords: { r1: { shirtSize: 'S', childHeight: 142, priorExperience: 'Nu', expectations: 'Să sară', internalNote: 'Sună seara', extra: { q: 'x' }, submissionKey: 'k1', gdprConsent: true } },
    memberships: [{ id: 'gm1', athleteId: 'a1', groupId: 'g-pp', seasonId: 's26', isMain: true, from: '2026-10-05' }],
    acs: [{ id: 'acs1', athleteId: 'a1', seasonId: 's26', state: 'da' }],
    duplicates: [{ id: 'd1', firstId: 'a1', secondId: 'a2', dismissed: true }],
    history: [
      { seq: 1, subjectType: SUBJECT.athlete, subjectId: 'a1', action: HISTORY_ACTIONS.updated, changes: { fields: { phone: { from: '0722000000', to: '0799123456' } } }, actor: 'ana@example.com', at: AT },
      { seq: 2, subjectType: SUBJECT.registration, subjectId: 'r1', action: 'email-resent', changes: { recipient: 'dana@example.com', documents: ['Ilinca-Zamfirescu_Acord_2026-2027.pdf'] }, actor: 'ana@example.com', at: AT },
      { seq: 3, subjectType: SUBJECT.athlete, subjectId: 'a2', action: HISTORY_ACTIONS.duplicateDismissed, changes: { name: 'Ilinca Zamfirescu' }, actor: 'ana@example.com', at: AT },
      { seq: 4, subjectType: SUBJECT.athlete, subjectId: 'a2', action: HISTORY_ACTIONS.updated, changes: { fields: { phone: { from: '1', to: '2' } } }, actor: 'ana@example.com', at: AT },
      { seq: 5, subjectType: SUBJECT.registration, subjectId: 'r2', action: HISTORY_ACTIONS.updated, changes: { fields: { email: { from: 'x@y.ro', to: 'z@y.ro' } } }, actor: 'ana@example.com', at: AT },
    ],
    emailJobs: [
      { id: 'j1', registrationId: 'r1', recipient: 'dana@example.com', subject: 'Înscriere Ilinca Zamfirescu', status: 'sent', lastError: null },
      { id: 'j2', registrationId: 'r1', recipient: 'dana@example.com', subject: 'Înscriere Ilinca Zamfirescu', status: 'queued', lastError: null },
      { id: 'j3', registrationId: 'r1', recipient: 'dana@example.com', subject: 'Înscriere Ilinca Zamfirescu', status: 'failed', lastError: 'Brevo 400: invalid dana@example.com' },
      { id: 'j4', registrationId: 'r2', recipient: 'irina@example.com', subject: 'Înscriere Irina Pereche', status: 'queued', lastError: null },
    ],
  };
}

function setup(state: Partial<FakeState> = seed()) {
  const fake = fakeClubStore(state);
  const removed: string[] = [];
  const logs: string[] = [];
  const ctx: AnonymizeContext = {
    store: fake.store, actor: 'super@example.com', today: { year: 2026, month: 10, day: 27 }, log: (m) => logs.push(m),
    removeFiles: async (id) => { removed.push(id); }, now: () => NOW,
  };
  return { fake, ctx, removed, logs };
}

describe('anonymize one athlete (spec 4)', () => {
  it('empties the athlete and keeps groups, A.C.S. and counts', async () => {
    const { fake, ctx } = setup();
    expect(await anonymizeAthlete(ctx, 'a1')).toEqual({ ok: true, data: { documentId: 'a1' } });
    expect(fake.state.athletes.find((a) => a.id === 'a1')).toMatchObject({
      name: 'Sportiv anonimizat', birthDate: null, contactName: null, phone: null, email: null, notes: null,
      status: 'anonimizat', dataIncomplete: false, profileId: null, anonymizedAt: NOW.toISOString(),
    });
    expect(fake.state.memberships).toHaveLength(1);
    expect(fake.state.acs).toHaveLength(1);
    expect(fake.state.registrations).toHaveLength(3);
  });

  it('scrubs its registrations and nothing of another athlete', async () => {
    const { fake, ctx } = setup();
    const other = structuredClone(fake.state.registrations.find((r) => r.id === 'r2'));
    await anonymizeAthlete(ctx, 'a1');
    expect(fake.state.registrations.find((r) => r.id === 'r1')).toMatchObject({
      childName: 'Anonimizat', parentName: '', phone: '', email: '', childBirthDate: '', lastSeason: null, number: '2026-0142', status: 'Confirmat', athleteId: 'a1', season: '2026-2027',
    });
    const raw = (await fake.store.registrationRecords('a1'))[0];
    for (const key of REGISTRATION_NULLED_KEYS) expect(raw[key], key).toBeNull();
    expect(raw.gdprConsent).toBe(true);
    const confirmation = fake.state.registrations.find((r) => r.id === 'r1')?.confirmation;
    expect(confirmation).toMatchObject({ fieldsBefore: { phone: null, email: null }, fieldsAfter: { phone: null }, membershipId: 'gm1' });
    expect(fake.state.registrations.find((r) => r.id === 'r2')).toEqual(other);
  });

  it('blanks old values in Istoric, keeps action, actor and time, and adds "Date anonimizate"', async () => {
    const { fake, ctx } = setup();
    await anonymizeAthlete(ctx, 'a1');
    const h = (seq: number) => fake.state.history.find((x) => x.seq === seq);
    expect(h(1)).toMatchObject({ action: HISTORY_ACTIONS.updated, actor: 'ana@example.com', at: AT, changes: { fields: { phone: { from: null, to: null } } } });
    expect(h(2)?.changes).toEqual({ recipient: null, documents: null });
    expect(h(3)?.changes).toEqual({ name: null });
    expect(h(4)?.changes).toEqual({ fields: { phone: { from: '1', to: '2' } } });
    expect(h(5)?.changes).toEqual({ fields: { email: { from: 'x@y.ro', to: 'z@y.ro' } } });
    expect(fake.state.history.filter((x) => x.action === HISTORY_ACTIONS.dataAnonymized)).toEqual([
      expect.objectContaining({ subjectType: SUBJECT.athlete, subjectId: 'a1', actor: 'super@example.com', changes: {} }),
    ]);
  });

  it('deletes the public profile and the duplicate pairs; clears the e-mail queue of its registrations only', async () => {
    const { fake, ctx } = setup();
    await anonymizeAthlete(ctx, 'a1');
    expect(fake.state.profiles).toEqual([]);
    expect(fake.state.removedParticipations).toEqual(['sp1']);
    expect(fake.state.duplicates).toEqual([]);
    expect(fake.state.emailJobs).toEqual([
      { id: 'j1', registrationId: 'r1', recipient: null, subject: null, status: 'sent', lastError: null },
      { id: 'j2', registrationId: 'r1', recipient: null, subject: null, status: 'cancelled', lastError: null },
      { id: 'j3', registrationId: 'r1', recipient: null, subject: null, status: 'failed', lastError: null },
      { id: 'j4', registrationId: 'r2', recipient: 'irina@example.com', subject: 'Înscriere Irina Pereche', status: 'queued', lastError: null },
    ]);
  });

  it('locks registrations (linked and matched) before the athlete, then removes the PDF folders after the commit', async () => {
    const { fake, ctx, removed } = setup();
    await anonymizeAthlete(ctx, 'a1');
    expect(fake.state.locks).toEqual(['r1', 'r3', 'athlete:a1']);
    expect(removed).toEqual(['r1']);
  });

  it('unknown is 404; a second run is 409 and writes nothing twice', async () => {
    const { fake, ctx } = setup();
    expect(await anonymizeAthlete(ctx, 'nobody')).toEqual({ ok: false, status: 404, error: ADMIN_ERRORS.notFound });
    await anonymizeAthlete(ctx, 'a1');
    expect(await anonymizeAthlete(ctx, 'a1')).toEqual({ ok: false, status: 409, error: ADMIN_ERRORS.stale });
    expect(fake.state.history.filter((x) => x.action === HISTORY_ACTIONS.dataAnonymized)).toHaveLength(1);
  });

  it('a failure halfway saves nothing and deletes no file', async () => {
    const { fake, ctx, removed, logs } = setup();
    fake.failOn('scrubRegistration');
    expect(await anonymizeAthlete(ctx, 'a1')).toEqual({ ok: false, status: 500, error: ADMIN_ERRORS.failed });
    expect(fake.state.athletes.find((a) => a.id === 'a1')?.name).toBe('Ilinca Zamfirescu');
    expect(fake.state.emailJobs.find((j) => j.id === 'j2')?.status).toBe('queued');
    expect(fake.state.history.find((x) => x.seq === 1)?.changes).toEqual({ fields: { phone: { from: '0722000000', to: '0799123456' } } });
    expect(removed).toEqual([]);
    expect(logs.join('\n')).toContain('[personal-data] anonymizing a1 failed');
  });

  it('a folder that cannot be deleted is logged; the anonymization stands', async () => {
    const { fake, ctx, logs } = setup();
    ctx.removeFiles = async () => { throw new Error('EACCES'); };
    expect((await anonymizeAthlete(ctx, 'a1')).ok).toBe(true);
    expect(fake.state.athletes.find((a) => a.id === 'a1')?.status).toBe('anonimizat');
    expect(logs.join('\n')).toContain('PDF folder of r1');
  });
});

describe('bulk (spec 5)', () => {
  it('each athlete on its own: anonymized, skipped (unknown or already done), failed', async () => {
    const { fake, ctx } = setup();
    const scrubJobs = fake.store.scrubEmailJobs.bind(fake.store);
    fake.store.scrubEmailJobs = async (ids) => {
      if (ids.includes('r2')) throw new Error('boom');
      return scrubJobs(ids);
    };
    expect(await anonymizeAthletes(ctx, ['a1', 'ghost', 'a2'])).toEqual({ ok: true, data: { anonymized: 1, skipped: 1, failed: 1 } });
    expect(fake.state.athletes.find((a) => a.id === 'a2')?.name).toBe('Irina Pereche');
    expect(await anonymizeAthletes(ctx, ['a1'])).toEqual({ ok: true, data: { anonymized: 0, skipped: 1, failed: 0 } });
  });
});

describe('startup sweep (spec 4)', () => {
  it('removes the folders of every registration of an anonymized athlete; a failure is logged and the rest go on', async () => {
    const fake = fakeClubStore({
      athletes: [athleteRow({ id: 'a1', status: 'anonimizat' }), athleteRow({ id: 'a2' })],
      registrations: [registrationRow({ id: 'r1', athleteId: 'a1' }), registrationRow({ id: 'r2', athleteId: 'a1' }), registrationRow({ id: 'r3', athleteId: 'a2' })],
    });
    const removed: string[] = [];
    const logs: string[] = [];
    const remove = async (id: string) => {
      if (id === 'r1') throw new Error('EBUSY');
      removed.push(id);
    };
    expect(await sweepAnonymizedFolders(fake.store, remove, (m) => logs.push(m))).toBe(2);
    expect(removed).toEqual(['r2']);
    expect(logs.join('\n')).toContain('r1');
  });
});
