import { describe, expect, it, vi } from 'vitest';
import { athleteRow, fakeClubStore, registrationRow } from '../../../athletes/__tests__/fake-store';
import { deleteAthlete } from '../../../athletes/delete';
import { ADMIN_ERRORS } from '../../../athletes/errors';
import { confirmRegistration } from '../../../athletes/confirm-service';
import { moveOnMerge } from '../lifecycle';
import { mergeAthletes } from '../../../athletes/merge';
import { undoConfirmation } from '../../../athletes/undo-service';
import { updateAthlete } from '../../../athletes/record';
import type { ServiceContext } from '../../../athletes/store';
import { historyTexts } from '../../../history-text';
import { anonymizeAthlete } from '../../../personal-data/anonymize-service';
import { attendanceRow, fakePresenceStore, paymentRow, sessionRow } from '../../../presence/__tests__/fake-store';
import { SUBJECT } from '../../../subjects';
import { fakeNoticeStore } from '../../notices/__tests__/fake-store';
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
  it('an edit to the holder\'s own address (the access already belongs to it) changes nothing and is not refused', async () => {
    const w = await world();
    await w.fake.store.updateAthlete('a1', { email: 'x@example.invalid' });
    expect(await edit(w.ctx, 'a@example.invalid')).toMatchObject({ ok: true });
    expect(live(w.h)).toMatchObject([{ accountId: w.accountA }]);
    expect(w.h.access.state.rows).toHaveLength(1);
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
  it('anonymize blanks the e-mail of the access rows, live or revoked', async () => {
    const w = await world();
    await anonymizeAthlete({ ...w.ctx, removeFiles: async () => undefined, now: () => NOW, presence: fakePresenceStore().store }, 'a1');
    expect(w.h.access.state.rows.map((r) => r.email)).toEqual(['']);
  });
  it('anonymize of an athlete without access writes nothing on the access side', async () => {
    const w = await world({ live: false });
    await anonymizeAthlete({ ...w.ctx, removeFiles: async () => undefined, now: () => NOW, presence: fakePresenceStore().store }, 'a1');
    expect(w.h.access.state.rows).toHaveLength(0);
    expect(w.h.access.state.history).toHaveLength(0);
  });
  it('delete purges every access row of the athlete with it', async () => {
    const w = await world();
    const old = await w.h.access.store.createAccess({ athleteId: 'a1', accountId: 'older', email: 'old@example.invalid', invitedAt: NOW.toISOString(), invitedBy: 'x' }).catch(() => null);
    expect(old).toBeNull();
    expect(await deleteAthlete(w.ctx, 'a1', fakePresenceStore().store)).toEqual({ ok: true, data: { deleted: true, documentId: 'a1' } });
    expect(w.h.access.state.rows).toEqual([]);
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
    expect(live(w.h)).toHaveLength(0);
    expect(w.h.access.state.rows).toEqual([]);
    expect(lines(w.h)).toEqual(['Acces portal scos: a@example.invalid']);
    expect(w.h.access.state.history.map((l) => [l.athleteId, l.action])).toEqual([['k', 'access-removed']]);
  });
  it('a kept athlete that already has access keeps its own; the removed one ends with unit', async () => {
    const w = await world({ club: [kept('a@example.invalid')], access: [ana({ id: 'k', name: 'Ana I.' })] });
    const other = await account(w.h, 'a@example.invalid2', 'active');
    await w.h.access.store.createAccess({ athleteId: 'k', accountId: other, email: 'a@example.invalid', invitedAt: NOW.toISOString(), invitedBy: 'x' });
    expect(await merge(w)).toMatchObject({ ok: true });
    expect(live(w.h)).toMatchObject([{ athleteId: 'k', accountId: other }]);
    expect(w.h.access.state.rows.filter((r) => r.athleteId === 'a1')).toEqual([]);
  });
  it('a picked e-mail changes the kept athlete e-mail: its access moves to the new holder with one mail after commit', async () => {
    const w = await world({ club: [kept('k@example.invalid')], access: [ana({ id: 'k', name: 'Ana I.', email: 'k@example.invalid' })], live: false });
    const holderK = await account(w.h, 'k@example.invalid', 'active');
    await w.h.access.store.createAccess({ athleteId: 'k', accountId: holderK, email: 'k@example.invalid', invitedAt: NOW.toISOString(), invitedBy: 'x' });
    const newHolder = w.accountA;
    expect(await mergeAthletes(w.ctx, { keptId: 'k', removedId: 'a1', take: ['email'] }, fakePresenceStore().store)).toMatchObject({ ok: true });
    expect(w.fake.state.athletes.find((a) => a.id === 'k')?.email).toBe('a@example.invalid');
    expect(live(w.h)).toMatchObject([{ athleteId: 'k', accountId: newHolder, email: 'a@example.invalid' }]);
    expect(w.h.access.state.rows.find((r) => r.accountId === holderK)).toMatchObject({ revokeReason: 'email_schimbat' });
    expect(w.h.accessJobs).toHaveLength(1);
    expect(w.h.after).toEqual(['access1']);
  });
  it('a removed athlete without access leaves the kept one alone', async () => {
    const w = await world({ live: false, club: [kept('a@example.invalid')], access: [ana({ id: 'k', name: 'Ana I.' })] });
    expect(await merge(w)).toMatchObject({ ok: true });
    expect(w.h.access.state.rows).toHaveLength(0);
  });
});

describe('confirm and undo move the access like an edit', () => {
  const REG = { id: 'r9', status: 'Contactat' as const, athleteId: null, email: 'b@example.invalid', childName: 'Ana Ionescu', parentName: 'Radu Ionescu', phone: '0799' };
  const request = { choice: 'existing' as const, athleteId: 'a1', groupId: 'g-pp', makeMain: false, updateFields: null };

  async function reregistration(): Promise<World & { accountA: string; accountB: string }> {
    const w = await world();
    w.fake.state.registrations.push(registrationRow(REG));
    const accountB = await account(w.h, 'b@example.invalid', 'active');
    return { ...w, accountB };
  }

  it('confirming a re-registration with another e-mail: the old holder loses the athlete, the new one gets it and one mail after commit', async () => {
    const w = await reregistration();
    expect(await confirmRegistration(w.ctx, 'r9', request)).toMatchObject({ ok: true });
    expect(w.fake.state.athletes[0].email).toBe('b@example.invalid');
    expect(live(w.h)).toMatchObject([{ accountId: w.accountB, email: 'b@example.invalid' }]);
    expect(w.h.access.state.rows.find((r) => r.accountId === w.accountA)).toMatchObject({ revokeReason: 'email_schimbat' });
    expect(w.h.accessJobs).toHaveLength(1);
    expect(w.h.after).toEqual(['access1']);
  });

  it('a confirmation that leaves the e-mail ticked off keeps the access and sends nothing', async () => {
    const w = await reregistration();
    expect(await confirmRegistration(w.ctx, 'r9', { ...request, updateFields: ['phone'] })).toMatchObject({ ok: true });
    expect(live(w.h)).toMatchObject([{ accountId: w.accountA }]);
    expect(w.h.after).toHaveLength(0);
  });

  it('an address of a disabled account refuses the confirmation whole', async () => {
    const w = await reregistration();
    await w.h.fake.store.updateAccount(w.accountB, { status: 'disabled' });
    expect(await confirmRegistration(w.ctx, 'r9', request)).toEqual({ ok: false, status: 409, error: 'Contul acestei adrese este dezactivat.' });
    expect(w.fake.state.athletes[0].email).toBe('a@example.invalid');
    expect(w.fake.state.registrations.find((r) => r.id === 'r9')?.status).toBe('Contactat');
    expect(live(w.h)).toMatchObject([{ accountId: w.accountA }]);
  });

  it('undo restoring the old e-mail moves the access back and mails the old holder', async () => {
    const w = await reregistration();
    await confirmRegistration(w.ctx, 'r9', request);
    w.h.accessJobs.length = 0;
    w.h.after.length = 0;
    expect(await undoConfirmation(w.ctx, 'r9', fakePresenceStore().store)).toMatchObject({ ok: true });
    expect(w.fake.state.athletes[0].email).toBe('a@example.invalid');
    expect(live(w.h)).toMatchObject([{ accountId: w.accountA, email: 'a@example.invalid' }]);
    expect(w.h.access.state.rows.find((r) => r.accountId === w.accountB && r.revokedAt !== null)).toMatchObject({ revokeReason: 'email_schimbat' });
    expect(w.h.accessJobs).toHaveLength(1);
    expect(w.h.after).toHaveLength(1);
  });

  it('undo that deletes the athlete the confirmation created leaves no access row', async () => {
    const w = await world({ live: false });
    w.fake.state.registrations.push(registrationRow({ ...REG, id: 'r8' }));
    await confirmRegistration(w.ctx, 'r8', { choice: 'new', athleteId: null, groupId: null, makeMain: false, updateFields: null });
    const created = w.fake.state.athletes.find((a) => a.id !== 'a1')!.id;
    const acc = await account(w.h, 'b@example.invalid', 'active');
    await w.h.access.store.createAccess({ athleteId: created, accountId: acc, email: 'b@example.invalid', invitedAt: NOW.toISOString(), invitedBy: 'x' });
    expect(await undoConfirmation(w.ctx, 'r8', fakePresenceStore().store)).toMatchObject({ ok: true, data: { athleteDeleted: true } });
    expect(w.fake.state.athletes.map((a) => a.id)).toEqual(['a1']);
    expect(w.h.access.state.rows.filter((r) => r.athleteId === created)).toEqual([]);
  });
});

describe('notices follow the athlete', () => {
  const notice = (accountId: string, athleteIds: string[]) => ({ kind: 'auto' as const, accountId, announcementId: null, key: 'k', title: 't', rows: [], athleteIds, groupIds: [], lastDate: null });
  async function seeded(w: World & { accountA: string }) {
    const { store } = fakeNoticeStore(w.h.access.state.notices);
    const named = await store.createNotice(notice(w.accountA, ['a1']), NOW.toISOString());
    const other = await store.createNotice(notice('accB', ['zz']), NOW.toISOString());
    await store.deliver(named, [w.accountA], NOW.toISOString());
    await store.deliver(other, ['accB'], NOW.toISOString());
    return { named, other, state: w.h.access.state.notices };
  }
  const left = (s: { state: { notices: { id: string }[]; deliveries: { noticeId: string }[] } }) => [s.state.notices.map((n) => n.id), s.state.deliveries.map((d) => d.noticeId)];

  it('delete removes the notices that name him with their deliveries and keeps the others', async () => {
    const w = await world();
    const s = await seeded(w);
    await deleteAthlete(w.ctx, 'a1', fakePresenceStore().store);
    expect(left(s)).toEqual([[s.other], [s.other]]);
  });
  it('anonymize does the same', async () => {
    const w = await world();
    const s = await seeded(w);
    await anonymizeAthlete({ ...w.ctx, removeFiles: async () => undefined, now: () => NOW, presence: fakePresenceStore().store }, 'a1');
    expect(left(s)).toEqual([[s.other], [s.other]]);
  });
  it('merge removes the notices of the athlete merged away', async () => {
    const w = await world({ club: [{ id: 'k', name: 'Ana I.', email: null, birthDate: '2015-04-03' }], access: [ana({ id: 'k', name: 'Ana I.' })] });
    const s = await seeded(w);
    expect(await mergeAthletes(w.ctx, { keptId: 'k', removedId: 'a1', take: [] }, fakePresenceStore().store)).toMatchObject({ ok: true });
    expect(left(s)).toEqual([[s.other], [s.other]]);
  });
});

describe('moveOnMerge takes the athlete locks itself', () => {
  it('locks both athletes in id order before it reads or moves the access', async () => {
    const w = await world();
    const taken: string[] = [];
    const base = w.h.c.access.lockAthlete.bind(w.h.c.access);
    w.h.c.access.lockAthlete = async (id: string) => { taken.push(id); await base(id); };
    await moveOnMerge(w.h.c, 'a9', 'a1', 'a@example.invalid');
    expect(taken).toEqual(['a1', 'a9']);
    expect(live(w.h).map((r) => r.athleteId)).toEqual(['a9']);
  });
});
