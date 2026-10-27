import { describe, expect, it } from 'vitest';
import type { ConfirmationRecord } from '../../confirm/plan';
import { athleteRow, fakeClubStore, registrationRow, type FakeFile, type FakeState } from '../../athletes/__tests__/fake-store';
import { ADMIN_ERRORS } from '../../athletes/errors';
import { dismissDuplicate } from '../../athletes/merge';
import { HISTORY_ACTIONS, SUBJECT } from '../../history-text';
import { REGISTRATION_NULLED_KEYS } from '../anonymize-plan';
import { anonymizeAthlete, anonymizeAthletes, type AnonymizeContext } from '../anonymize-service';
import { fakePresenceStore } from '../../presence/__tests__/fake-store';
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

const pathError = (code: string) =>
  Object.assign(new Error(`${code}: permission denied, unlink '/srv/private/registrations/r1/Ilinca_Zamfirescu_Acord_2026-2027.pdf'`), { code });

function setup(state: Partial<FakeState> = seed()) {
  const fake = fakeClubStore(state);
  const removed: string[] = [];
  const logs: string[] = [];
  const ctx: AnonymizeContext = {
    store: fake.store, actor: 'super@example.com', today: { year: 2026, month: 10, day: 27 }, log: (m) => logs.push(m),
    removeFiles: async (id) => { removed.push(id); }, now: () => NOW, presence: fakePresenceStore().store,
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

  it('clears the schedule-change e-mail jobs addressed to the athlete\'s contact e-mails (any case), and only those', async () => {
    const jobs = [
      { id: 's1', registrationId: null, recipient: 'dana@example.com', subject: 'Primii Pași: ședința de sâmbătă, se anulează', status: 'sent', lastError: null, kind: 'schedule-change' as const },
      { id: 's2', registrationId: null, recipient: 'Dana@Example.com', subject: 'Primii Pași: ședința de sâmbătă, se mută', status: 'queued', lastError: null, kind: 'schedule-change' as const },
      { id: 's3', registrationId: null, recipient: 'dana@example.com', subject: 'x', status: 'failed', lastError: 'Brevo 400: invalid dana@example.com', kind: 'schedule-change' as const },
      { id: 's4', registrationId: null, recipient: 'irina@example.com', subject: 'x', status: 'queued', lastError: null, kind: 'schedule-change' as const },
    ];
    const { fake, ctx, logs } = setup({ ...seed(), emailJobs: [...seed().emailJobs!, ...jobs] });
    await anonymizeAthlete(ctx, 'a1');
    expect(fake.state.emailJobs.filter((j) => j.kind === 'schedule-change')).toEqual([
      { ...jobs[0], recipient: null, subject: null },
      { ...jobs[1], recipient: null, subject: null, status: 'cancelled' },
      { ...jobs[2], recipient: null, subject: null, lastError: null },
      jobs[3],
    ]);
    expect(logs.join('\n')).not.toContain('dana@example.com');
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

  it('a folder that cannot be deleted is logged by its error code only; the anonymization stands', async () => {
    const { fake, ctx, logs } = setup();
    ctx.removeFiles = async () => { throw pathError('EACCES'); };
    expect((await anonymizeAthlete(ctx, 'a1')).ok).toBe(true);
    expect(fake.state.athletes.find((a) => a.id === 'a1')?.status).toBe('anonimizat');
    const line = logs.find((l) => l.includes('PDF folder of r1'));
    expect(line).toBe('[personal-data] PDF folder of r1 (the startup sweep retries) failed: EACCES');
    expect(logs.join('\n')).not.toMatch(/Ilinca|Zamfirescu|\/srv\/|\.pdf/);
  });
});

describe('media of the deleted profile (spec 4, DEC 2026-10-27 3C photos)', () => {
  const file = (id: number, usedBy: string[]): FakeFile => ({ id, hash: `img_${id}_4f2a`, url: `/uploads/img_${id}_4f2a.jpg`, usedBy });
  /** Photo 1 and gallery image 3 belong to the profile only; gallery image 2 is also an article's cover; 4 is another profile's. */
  const withFiles = (texts: string[] = []): Partial<FakeState> => ({
    ...seed(),
    files: [file(1, ['sp1']), file(2, ['sp1', 'article:a9']), file(3, ['sp1']), file(4, ['sp2'])],
    texts,
  });

  it('deletes the files only that profile used; a shared file and other files stay', async () => {
    const { fake, ctx } = setup(withFiles());
    expect((await anonymizeAthlete(ctx, 'a1')).ok).toBe(true);
    expect(fake.state.files).toEqual([file(2, ['article:a9']), file(4, ['sp2'])]);
  });

  it('keeps a file an article body (blocks) or a markdown text embeds; deletes the unused one', async () => {
    const blocks = JSON.stringify([{ type: 'image', image: { url: '/uploads/img_1_4f2a.jpg', hash: 'img_1_4f2a' }, children: [{ type: 'text', text: '' }] }]);
    const markdown = 'Poza de la gală: ![](/uploads/img_3_4f2a.jpg)';
    const { fake, ctx } = setup({ ...withFiles([blocks, markdown]), files: [file(1, ['sp1']), file(3, ['sp1']), file(5, ['sp1'])] });
    await anonymizeAthlete(ctx, 'a1');
    expect(fake.state.files.map((f) => f.id)).toEqual([1, 3]);
  });

  it('keeps a file a calendar event shows by url (imageUrl) or a program embeds in its calendarEvents markdown (json)', async () => {
    const calendarEvent = '/uploads/img_1_4f2a.jpg';
    const calendarEvents = JSON.stringify([{ title: 'Gala', description: 'Afiș: ![gala](/uploads/img_3_4f2a.jpg)' }]);
    const { fake, ctx } = setup({ ...withFiles([calendarEvent, calendarEvents]), files: [file(1, ['sp1']), file(3, ['sp1']), file(5, ['sp1'])] });
    await anonymizeAthlete(ctx, 'a1');
    expect(fake.state.files.map((f) => f.id)).toEqual([1, 3]);
  });

  it('a file that cannot be deleted is logged by id and error code only; the others go on and the anonymization stands', async () => {
    const { fake, ctx, logs } = setup(withFiles());
    const deleteMedia = fake.store.deleteMediaIfUnused.bind(fake.store);
    fake.store.deleteMediaIfUnused = async (fileId) => {
      if (fileId === 1) throw Object.assign(new Error("EACCES: permission denied, unlink 'public/uploads/ilinca_zamfirescu_4f2a.jpg'"), { code: 'EACCES' });
      return deleteMedia(fileId);
    };
    expect(await anonymizeAthlete(ctx, 'a1')).toEqual({ ok: true, data: { documentId: 'a1' } });
    expect(fake.state.athletes.find((a) => a.id === 'a1')?.status).toBe('anonimizat');
    expect(fake.state.files.map((f) => f.id)).toEqual([1, 2, 4]);
    expect(logs).toContain('[personal-data] media file 1 of an anonymized profile was not deleted: EACCES');
    expect(logs.join('\n').toLowerCase()).not.toMatch(/ilinca|zamfirescu|uploads/);
  });

  it('a failure in the transaction deletes no file and keeps the profile', async () => {
    const { fake, ctx } = setup(withFiles());
    fake.failOn('updateAthlete');
    expect((await anonymizeAthlete(ctx, 'a1')).ok).toBe(false);
    expect(fake.state.files).toEqual(withFiles().files);
    expect(fake.state.profiles.map((p) => p.id)).toEqual(['sp1']);
  });

  it('an athlete without a public profile touches no file', async () => {
    const { fake, ctx } = setup(withFiles());
    await anonymizeAthlete(ctx, 'a2');
    expect(fake.state.files).toEqual(withFiles().files);
  });
});

describe('"Nu e același copil" lines about the child, on any record (review fix 1)', () => {
  const dismissal = (seq: number, subjectId: string, changes: Record<string, unknown>) => ({
    seq, subjectType: SUBJECT.athlete, subjectId, action: HISTORY_ACTIONS.duplicateDismissed, changes, actor: 'ana@example.com', at: AT,
  });
  const ownLine = (seq: number, action: string, changes: Record<string, unknown>) => ({ seq, subjectType: SUBJECT.athlete, subjectId: 'a1', action, changes, actor: 'ana@example.com', at: AT });

  function withLines(): Partial<FakeState> {
    const base = seed();
    return {
      ...base,
      duplicates: [],
      history: [
        ownLine(11, HISTORY_ACTIONS.updated, { fields: { name: { from: 'Ilinca Zamfiresku', to: 'Ilinca Zamfirescu' } } }),
        ownLine(12, HISTORY_ACTIONS.merged, { name: 'Ilinca Z. Zamfirescu' }),
        dismissal(21, 'a2', { name: 'ZAMFIRESKU Ilincă' }),
        dismissal(22, 'a9deleted', { name: 'Ilinca Zamfirescu' }),
        dismissal(23, 'a2', { name: 'Ilinca Z. Zamfirescu' }),
        dismissal(24, 'a2', { name: 'Ilinca Zamfiresc' }),
        dismissal(25, 'a2', { name: 'Ilinca Zamfirescu', otherAthleteId: 'a7' }),
      ],
    };
  }
  const changesOf = (fake: ReturnType<typeof fakeClubStore>, seq: number) => fake.state.history.find((x) => x.seq === seq)?.changes;

  it('scrubs a line written before a rename and one naming a merged-in spelling', async () => {
    const { fake, ctx } = setup(withLines());
    await anonymizeAthlete(ctx, 'a1');
    expect(changesOf(fake, 21)).toEqual({ name: null });
    expect(changesOf(fake, 23)).toEqual({ name: null });
  });

  it('scrubs a line on a partner whose pair row was deleted', async () => {
    const { fake, ctx } = setup(withLines());
    await anonymizeAthlete(ctx, 'a1');
    expect(changesOf(fake, 22)).toEqual({ name: null });
  });

  it('keeps a line about another child: a similar but not equal name, or a partner id that is not this child', async () => {
    const { fake, ctx } = setup(withLines());
    await anonymizeAthlete(ctx, 'a1');
    expect(changesOf(fake, 24)).toEqual({ name: 'Ilinca Zamfiresc' });
    expect(changesOf(fake, 25)).toEqual({ name: 'Ilinca Zamfirescu', otherAthleteId: 'a7' });
  });

  it('also counts names from its registrations, their confirmation records and Istoric, and the created-from-registrations line', async () => {
    const base = seed();
    const confirmation = { ...CONFIRMATION, fieldsBefore: { ...CONFIRMATION.fieldsBefore, name: 'Ilinca Maria Zamfirescu' } };
    const { fake, ctx } = setup({
      ...base,
      duplicates: [],
      registrations: [
        registrationRow({ id: 'r1', childName: 'Ilinca Zamfirescu', athleteId: 'a1', confirmation }),
        registrationRow({ id: 'r8', number: '2024-0007', childName: 'Ilinca Zamfirescu-Old' }),
      ],
      history: [
        ownLine(31, HISTORY_ACTIONS.createdFromRegistrations, { registrations: [{ documentId: 'r8', season: '2024-2025', number: '2024-0007' }] }),
        { seq: 32, subjectType: SUBJECT.registration, subjectId: 'r1', action: HISTORY_ACTIONS.updated, changes: { fields: { childName: { from: 'Ilinca Zamfirescuu', to: 'Ilinca Zamfirescu' } } }, actor: 'ana@example.com', at: AT },
        dismissal(41, 'a2', { name: 'Ilinca Maria Zamfirescu' }),
        dismissal(42, 'a2', { name: 'Ilinca Zamfirescu-Old' }),
        dismissal(43, 'a2', { name: 'Ilinca Zamfirescuu' }),
      ],
    });
    await anonymizeAthlete(ctx, 'a1');
    for (const seq of [41, 42, 43]) expect(changesOf(fake, seq), String(seq)).toEqual({ name: null });
  });

  it('a new dismiss line carries the partner id and is scrubbed by it', async () => {
    const { fake, ctx } = setup({
      ...seed(),
      athletes: [...(seed().athletes ?? []), athleteRow({ id: 'a3', name: 'Ilinca Pop' })],
      duplicates: [{ id: 'd3', firstId: 'a1', secondId: 'a3', dismissed: false }],
      history: [],
    });
    await dismissDuplicate(ctx, 'd3');
    const line = fake.state.history.find((x) => x.subjectId === 'a3');
    expect(line?.changes).toEqual({ name: 'Ilinca Zamfirescu', otherAthleteId: 'a1' });
    if (line) line.changes.name = 'Nume fără legătură';
    await anonymizeAthlete(ctx, 'a1');
    expect(fake.state.history.find((x) => x.seq === line?.seq)?.changes).toEqual({ name: null, otherAthleteId: 'a1' });
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
      if (id === 'r1') throw pathError('EBUSY');
      removed.push(id);
    };
    expect(await sweepAnonymizedFolders(fake.store, remove, (m) => logs.push(m))).toBe(2);
    expect(removed).toEqual(['r2']);
    expect(logs).toEqual(['[personal-data] sweeping the PDF folder of r1 failed: EBUSY']);
  });
});
