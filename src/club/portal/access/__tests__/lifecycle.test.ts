import { describe, expect, it, vi } from 'vitest';
import { athleteRow, fakeClubStore, registrationRow } from '../../../athletes/__tests__/fake-store';
import { deleteAthlete } from '../../../athletes/delete';
import { ADMIN_ERRORS } from '../../../athletes/errors';
import { mergeAthletes } from '../../../athletes/merge';
import { updateAthlete } from '../../../athletes/record';
import type { ServiceContext } from '../../../athletes/store';
import { historyTexts } from '../../../history-text';
import { anonymizeAthlete } from '../../../personal-data/anonymize-service';
import { attendanceRow, fakePresenceStore, paymentRow, sessionRow } from '../../../presence/__tests__/fake-store';
import { SUBJECT } from '../../../subjects';
import { harness, NOW, type Harness } from '../../accounts/__tests__/harness';
import type { AthleteForAccess } from '../types';

const ana = (over: Partial<AthleteForAccess> = {}): AthleteForAccess => ({ id: 'a1', name: 'Ana Ionescu', email: 'a@example.invalid', status: 'activ', birthDate: '2015-04-03', contactName: 'Ioana Ionescu', ...over });

type World = { h: Harness; fake: ReturnType<typeof fakeClubStore>; ctx: ServiceContext };

/** The club side (a1 with e-mail a@) and the access side of the same athletes, one holder account A with a live access to a1. */
async function world(extra: { club?: Parameters<typeof athleteRow>[0][]; access?: AthleteForAccess[]; live?: boolean } = {}): Promise<World & { accountA: string }> {
  const h = harness({ actor: 'ana@club.ro' });
  h.access.state.athletes.push(ana(), ...(extra.access ?? []));
  const fake = fakeClubStore({
    athletes: [athleteRow({ id: 'a1', name: 'Ana Ionescu', birthDate: '2015-04-03', contactName: 'Ioana Ionescu', phone: '0722', email: 'a@example.invalid' }), ...(extra.club ?? []).map((a) => athleteRow(a))],
    registrations: [registrationRow({ id: 'r1', athleteId: 'a1', status: 'Confirmat' })],
  });
  const accountA = await account(h, 'a@example.invalid', 'active');
  if (extra.live !== false) await h.access.store.createAccess({ athleteId: 'a1', accountId: accountA, email: 'a@example.invalid', invitedAt: NOW.toISOString(), invitedBy: 'x' });
  const ctx: ServiceContext = { store: fake.store, actor: 'ana@club.ro', today: { year: 2026, month: 10, day: 26 }, log: vi.fn(), access: h.c };
  return { h, fake, ctx, accountA };
}

async function account(h: Harness, email: string, status: 'invited' | 'active' | 'disabled'): Promise<string> {
  const userId = await h.fake.store.createUser(email, null);
  return h.fake.store.createAccount({ userId, email, status, name: 'Parinte', invitedAt: NOW.toISOString(), ...(status !== 'invited' ? { activatedAt: NOW.toISOString() } : {}) });
}

const edit = (ctx: ServiceContext, email: string) => updateAthlete(ctx, 'a1', { name: 'Ana Ionescu', birthDate: '03.04.2015', contactName: 'Ioana Ionescu', phone: '0722', email });
const live = (h: Harness) => h.access.state.rows.filter((r) => r.revokedAt === null);
const lines = (h: Harness) => h.access.state.history.map((l) => historyTexts(l.action, l.changes, SUBJECT.athlete)[0]);

describe('the access moves with the athlete e-mail', () => {
  it('to an active account: the old row is revoked, the new one live, one access mail, a "mutat" line', async () => {
    const w = await world();
    const b = await account(w.h, 'b@example.invalid', 'active');
    expect(await edit(w.ctx, 'b@example.invalid')).toMatchObject({ ok: true });
    expect(w.h.access.state.rows.find((r) => r.accountId === w.accountA)).toMatchObject({ revokeReason: 'email_schimbat' });
    expect(live(w.h)).toMatchObject([{ athleteId: 'a1', accountId: b, email: 'b@example.invalid' }]);
    expect(w.h.accessJobs).toHaveLength(1);
    expect(w.h.accessJobs[0].recipient).toBe('b@example.invalid');
    expect(w.h.after).toEqual(['access1']);
    expect(lines(w.h)).toEqual(['Acces portal mutat la b@example.invalid']);
    expect(w.fake.state.athletes[0].email).toBe('b@example.invalid');
  });
  it('to an address without an account: an invited account and one invite, nothing queued twice', async () => {
    const w = await world();
    expect(await edit(w.ctx, 'nou@example.invalid')).toMatchObject({ ok: true });
    expect(w.h.fake.state.accounts.find((a) => a.email === 'nou@example.invalid')).toMatchObject({ status: 'invited', name: 'Ioana Ionescu' });
    expect(w.h.jobs).toHaveLength(1);
    expect(w.h.jobs[0].recipient).toBe('nou@example.invalid');
    expect(live(w.h)).toHaveLength(1);
  });
  it('to an empty address: the access ends, no job, a "scos" line', async () => {
    const w = await world();
    expect(await edit(w.ctx, '')).toMatchObject({ ok: true });
    expect(live(w.h)).toHaveLength(0);
    expect(w.h.access.state.rows[0].revokeReason).toBe('email_schimbat');
    expect(w.h.jobs).toHaveLength(0);
    expect(w.h.accessJobs).toHaveLength(0);
    expect(lines(w.h)).toEqual(['Acces portal scos: a@example.invalid']);
  });
  it('the same address in other letters changes nothing', async () => {
    const w = await world();
    expect(await edit(w.ctx, 'A@Example.Invalid')).toMatchObject({ ok: true });
    expect(live(w.h)).toHaveLength(1);
    expect(w.h.access.state.rows).toHaveLength(1);
    expect(w.h.jobs.length + w.h.accessJobs.length).toBe(0);
  });
  it('an athlete without a live access gets no invite from an e-mail edit', async () => {
    const w = await world({ live: false });
    expect(await edit(w.ctx, 'b@example.invalid')).toMatchObject({ ok: true });
    expect(w.h.access.state.rows).toHaveLength(0);
    expect(w.h.fake.state.accounts.filter((a) => a.email === 'b@example.invalid')).toHaveLength(0);
    expect(w.h.jobs.length + w.h.accessJobs.length).toBe(0);
  });
  it('an address of a disabled account refuses the edit whole: e-mail unchanged, old access still live', async () => {
    const w = await world();
    await account(w.h, 'b@example.invalid', 'disabled');
    expect(await edit(w.ctx, 'b@example.invalid')).toEqual({ ok: false, status: 409, error: 'Contul acestei adrese este dezactivat.' });
    expect(w.fake.state.athletes[0].email).toBe('a@example.invalid');
    expect(live(w.h)).toMatchObject([{ accountId: w.accountA }]);
    expect(w.h.after).toHaveLength(0);
  });
  it('a failure while writing the athlete releases no mail (the rollback itself is pinned on Postgres)', async () => {
    const w = await world();
    await account(w.h, 'b@example.invalid', 'active');
    w.fake.failOn('updateAthlete');
    expect(await edit(w.ctx, 'b@example.invalid')).toEqual({ ok: false, status: 500, error: ADMIN_ERRORS.failed });
    expect(w.h.after).toHaveLength(0);
  });
  it('another edit (the phone) never touches the access', async () => {
    const w = await world();
    expect(await updateAthlete(w.ctx, 'a1', { name: 'Ana Ionescu', birthDate: '03.04.2015', contactName: 'Ioana Ionescu', phone: '0799', email: 'a@example.invalid' })).toMatchObject({ ok: true });
    expect(w.h.access.state.rows).toHaveLength(1);
    expect(w.h.access.state.history).toHaveLength(0);
  });
});

describe('what ends access', () => {
  it('anonymize revokes with anonimizat and notes it on the record', async () => {
    const w = await world();
    const result = await anonymizeAthlete({ ...w.ctx, removeFiles: async () => undefined, now: () => NOW, presence: fakePresenceStore().store }, 'a1');
    expect(result.ok).toBe(true);
    expect(w.h.access.state.rows[0]).toMatchObject({ revokeReason: 'anonimizat', revokedBy: 'ana@club.ro' });
    expect(lines(w.h)).toEqual(['Acces portal oprit (anonimizat)']);
  });
  it('anonymize of an athlete without access writes nothing on the access side', async () => {
    const w = await world({ live: false });
    await anonymizeAthlete({ ...w.ctx, removeFiles: async () => undefined, now: () => NOW, presence: fakePresenceStore().store }, 'a1');
    expect(w.h.access.state.rows).toHaveLength(0);
    expect(w.h.access.state.history).toHaveLength(0);
  });
  it('delete revokes with sters before the athlete goes', async () => {
    const w = await world();
    expect(await deleteAthlete(w.ctx, 'a1', fakePresenceStore().store)).toEqual({ ok: true, data: { deleted: true, documentId: 'a1' } });
    expect(w.h.access.state.rows[0]).toMatchObject({ revokeReason: 'sters' });
    expect(w.fake.state.athletes).toHaveLength(0);
  });
  it('a delete refused for a payment keeps the access', async () => {
    const w = await world();
    const presence = fakePresenceStore({ payments: [paymentRow({ id: 'p1', athleteId: 'a1' })], sessions: [sessionRow({ id: 's1' })], attendances: [attendanceRow({ id: 't1', sessionId: 's1', athleteId: 'a1', uniqueKey: 's1|a1' })] });
    expect(await deleteAthlete(w.ctx, 'a1', presence.store)).toMatchObject({ ok: true, data: { deleted: false } });
    expect(live(w.h)).toHaveLength(1);
  });
});

describe('merge', () => {
  const merge = (w: World) => mergeAthletes(w.ctx, { keptId: 'k', removedId: 'a1', take: [] }, fakePresenceStore().store);
  const kept = (email: string | null) => ({ id: 'k', name: 'Ana I.', email, birthDate: '2015-04-03' });

  it('the access moves to the kept athlete when it has none and its e-mail equals the access e-mail', async () => {
    const w = await world({ club: [kept('a@example.invalid')], access: [ana({ id: 'k', name: 'Ana I.' })] });
    expect(await merge(w)).toMatchObject({ ok: true });
    expect(live(w.h)).toMatchObject([{ athleteId: 'k', accountId: w.accountA }]);
    expect(w.h.access.state.rows).toHaveLength(1);
  });
  it('another e-mail on the kept athlete ends the access with unit', async () => {
    const w = await world({ club: [kept('other@example.invalid')], access: [ana({ id: 'k', name: 'Ana I.', email: 'other@example.invalid' })] });
    expect(await merge(w)).toMatchObject({ ok: true });
    expect(w.h.access.state.rows[0]).toMatchObject({ athleteId: 'a1', revokeReason: 'unit' });
    expect(live(w.h)).toHaveLength(0);
  });
  it('a kept athlete that already has access keeps its own; the removed one ends with unit', async () => {
    const w = await world({ club: [kept('a@example.invalid')], access: [ana({ id: 'k', name: 'Ana I.' })] });
    const other = await account(w.h, 'a@example.invalid2', 'active');
    await w.h.access.store.createAccess({ athleteId: 'k', accountId: other, email: 'a@example.invalid', invitedAt: NOW.toISOString(), invitedBy: 'x' });
    expect(await merge(w)).toMatchObject({ ok: true });
    expect(live(w.h)).toMatchObject([{ athleteId: 'k', accountId: other }]);
    expect(w.h.access.state.rows.find((r) => r.athleteId === 'a1')).toMatchObject({ revokeReason: 'unit' });
  });
  it('a removed athlete without access leaves the kept one alone', async () => {
    const w = await world({ live: false, club: [kept('a@example.invalid')], access: [ana({ id: 'k', name: 'Ana I.' })] });
    expect(await merge(w)).toMatchObject({ ok: true });
    expect(w.h.access.state.rows).toHaveLength(0);
  });
});
