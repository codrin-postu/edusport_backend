import { describe, expect, it } from 'vitest';
import { portalHistoryText } from '../../copy';
import { hashSecret } from '../../tokens';
import { changeEmail } from '../email';
import { disableAccount, enableAccount } from '../status';
import { inviteAccount, resendInvite } from '../invite';
import { disableForTeamMembers } from '../team-member-hook';
import { readAccount } from '../read';
import { harness, seedAccount } from './harness';
import { uniqueViolation } from '../invite';

const ok = <T>(r: { ok: boolean; data?: T }): T => {
  expect(r.ok).toBe(true);
  return (r as { data: T }).data;
};

describe('inviteAccount', () => {
  it('creates the user with a null hash, an invited account, a token, a job and a history line', async () => {
    const h = harness();
    const a = ok(await inviteAccount(h.c, 'tm1', { email: ' Andreea@Example.com ' }));
    expect(a.toast).toBe('Invitație trimisă.');
    expect(a.account).toMatchObject({ teamMemberId: 'tm1', state: 'invited', email: 'andreea@example.com', since: '2026-11-06', google: false });
    expect(h.fake.state.users).toHaveLength(1);
    expect(h.fake.state.users[0].passwordHash).toBeNull();
    expect(h.fake.state.accounts[0]).toMatchObject({ status: 'invited', invitedBy: 'admin@edusport.ro', teamMemberId: 'tm1' });
    expect(h.fake.state.tokens).toHaveLength(1);
    expect(h.jobs).toHaveLength(1);
    expect(h.jobs[0]).toMatchObject({ recipient: 'andreea@example.com', payload: { name: 'Andreea Pascu', host: 'antrenor.scoaladepatinaj.com' } });
    const secret = h.jobs[0].payload.link.split('/invite/')[1];
    expect(h.fake.state.tokens[0].secretHash).toBe(hashSecret(secret));
    expect(h.after).toEqual(['job1']);
    const line = h.fake.state.history[0];
    expect(line).toMatchObject({ action: 'portal-invite-sent', changes: { email: 'andreea@example.com' }, actor: 'admin@edusport.ro' });
    expect(portalHistoryText(line.action, line.changes)).toBe('Invitație trimisă la andreea@example.com.');
  });
  it('404 for an unknown team member, 409 stale when it has an account, 400 for a bad e-mail, 409 for a taken one', async () => {
    const h = harness();
    expect(await inviteAccount(h.c, 'nope', { email: 'a@b.ro' })).toMatchObject({ ok: false, status: 404 });
    expect(await inviteAccount(h.c, 'tm1', { email: 'nu-e-email' })).toMatchObject({ ok: false, status: 400, error: 'Cerere invalidă.' });
    expect(await inviteAccount(h.c, 'tm1', null)).toMatchObject({ ok: false, status: 400 });
    await seedAccount(h, 'active', 'taken@example.com');
    expect(await inviteAccount(h.c, 'tm1', { email: 'other@example.com' })).toMatchObject({ ok: false, status: 409, error: 'Datele s-au schimbat. Reîncarcă pagina.' });
    expect(await inviteAccount(h.c, 'tm2', { email: 'TAKEN@example.com' })).toMatchObject({ ok: false, status: 409, error: 'Adresa are deja un cont.' });
    expect(h.jobs).toHaveLength(0);
  });
  it('a unique violation on the team member link answers stale', async () => {
    const h = harness();
    h.fake.failOn('createAccount');
    const original = h.fake.store.createAccount;
    h.fake.store.createAccount = async (a) => {
      try {
        return await original(a);
      } catch {
        throw Object.assign(new Error('duplicate key value violates unique constraint "portal_accounts_team_member_lnk_uq" (team_member_id)'), { code: '23505', constraint: 'portal_accounts_team_member_lnk_uq' });
      }
    };
    expect(await inviteAccount(h.c, 'tm1', { email: 'a@b.ro' })).toMatchObject({ ok: false, status: 409, error: 'Datele s-au schimbat. Reîncarcă pagina.' });
    expect(h.after).toEqual([]);
  });
  it('a failure inside the transaction leaves nothing and queues nothing after commit', async () => {
    const h = harness({ queueInvite: async () => { throw new Error('boom'); } });
    expect(await inviteAccount(h.c, 'tm1', { email: 'a@b.ro' })).toMatchObject({ ok: false, status: 500 });
    expect(h.fake.state.accounts).toHaveLength(0);
    expect(h.fake.state.users).toHaveLength(0);
    expect(h.after).toEqual([]);
  });
});

describe('resendInvite', () => {
  it('uses the older invite, issues a new one, queues a new job, logs the resend', async () => {
    const h = harness();
    const { id } = await seedAccount(h, 'invited');
    const a = ok(await resendInvite(h.c, id));
    expect(a.account.state).toBe('invited');
    const invites = h.fake.state.tokens.filter((t) => t.kind === 'invite');
    expect(invites.filter((t) => t.usedAt === null)).toHaveLength(1);
    expect(invites.find((t) => t.secretHash === 'inv')?.usedAt).not.toBeNull();
    expect(h.jobs).toHaveLength(1);
    expect(h.after).toEqual(['job1']);
    expect(h.fake.state.history[0]).toMatchObject({ action: 'portal-invite-resent' });
    expect(portalHistoryText('portal-invite-resent', {})).toBe('Invitație retrimisă.');
  });
  it('resend refuses an active account, queues nothing', async () => {
    const h = harness();
    const { id } = await seedAccount(h, 'active');
    expect(await resendInvite(h.c, id)).toMatchObject({ ok: false, status: 409 });
    expect(h.jobs).toHaveLength(0);
    expect(h.after).toEqual([]);
  });
});

describe('disableAccount', () => {
  it('disable revokes every session and device, blocks the user, uses up tokens', async () => {
    const h = harness();
    const { id, userId } = await seedAccount(h, 'active');
    const a = ok(await disableAccount(h.c, id));
    expect(a).toMatchObject({ toast: 'Cont dezactivat.', account: { state: 'disabled', since: '2026-11-06' } });
    expect(h.fake.state.accounts[0]).toMatchObject({ status: 'disabled', disabledBy: 'admin@edusport.ro' });
    expect((await h.fake.store.user(userId))?.blocked).toBe(true);
    expect(h.fake.state.sessions.every((s) => s.revokedAt !== null)).toBe(true);
    expect(h.fake.state.devices.every((d) => d.revokedAt !== null)).toBe(true);
    expect(h.fake.state.tokens.every((t) => t.usedAt !== null)).toBe(true);
    expect(h.fake.state.history[0]).toMatchObject({ action: 'portal-disabled', actor: 'admin@edusport.ro' });
    expect(portalHistoryText('portal-disabled', {})).toBe('Cont dezactivat.');
  });
  it('revokeAll runs inside the disable transaction: a revokeAll that throws rolls the disable back', async () => {
    const h = harness();
    const { id, userId } = await seedAccount(h, 'active');
    let sawLock = false;
    h.c.sessions = { ...h.c.sessions, revokeAll: async (u) => {
      sawLock = h.fake.state.locks.includes(`account:${id}`);
      expect(u).toBe(userId);
      throw new Error('revoke failed');
    } };
    expect(await disableAccount(h.c, id)).toMatchObject({ ok: false, status: 500 });
    expect(sawLock).toBe(true);
    expect(h.fake.state.accounts[0].status).toBe('active');
    expect((await h.fake.store.user(userId))?.blocked).toBe(false);
    expect(h.fake.state.devices.every((d) => d.revokedAt === null)).toBe(true);
    expect(h.fake.state.history).toHaveLength(0);
  });
  it('an already disabled account is left as it is, same answer', async () => {
    const h = harness();
    const { id } = await seedAccount(h, 'disabled');
    const a = ok(await disableAccount(h.c, id));
    expect(a.account.state).toBe('disabled');
    expect(h.fake.state.history).toHaveLength(0);
  });
  it('unknown account is 404', async () => {
    expect(await disableAccount(harness().c, 'nope')).toMatchObject({ ok: false, status: 404 });
  });
});

describe('enableAccount', () => {
  it('back to active when it had been activated, else to invited; user unblocked', async () => {
    const h = harness();
    const { id, userId } = await seedAccount(h, 'disabled');
    await h.fake.store.updateUser(userId, { blocked: true });
    const a = ok(await enableAccount(h.c, id));
    expect(a).toMatchObject({ toast: 'Cont activat.', account: { state: 'active' } });
    expect((await h.fake.store.user(userId))?.blocked).toBe(false);
    expect(h.fake.state.history[0]).toMatchObject({ action: 'portal-enabled' });
    const h2 = harness();
    const s = await seedAccount(h2, 'disabled');
    await h2.fake.store.updateAccount(s.id, { activatedAt: null });
    expect(ok(await enableAccount(h2.c, s.id)).account.state).toBe('invited');
  });
  it('refuses an account that is not disabled', async () => {
    const h = harness();
    const { id } = await seedAccount(h, 'active');
    expect(await enableAccount(h.c, id)).toMatchObject({ ok: false, status: 409 });
  });
});

describe('changeEmail', () => {
  it('updates account and user, uses up an open reset token, logs old -> new, mails both addresses after commit', async () => {
    const h = harness();
    const { id, userId } = await seedAccount(h, 'active');
    const a = ok(await changeEmail(h.c, id, { email: 'Nou@Example.com' }));
    expect(a).toMatchObject({ toast: 'E-mail schimbat.', account: { email: 'nou@example.com' } });
    expect((await h.fake.store.user(userId))?.email).toBe('nou@example.com');
    expect(h.fake.state.tokens.find((t) => t.kind === 'reset')?.usedAt).not.toBeNull();
    expect(h.fake.state.tokens.find((t) => t.kind === 'invite')?.usedAt).toBeNull();
    const line = h.fake.state.history[0];
    expect(line).toMatchObject({ action: 'portal-email-changed', changes: { from: 'andreea@example.com', to: 'nou@example.com' } });
    expect(portalHistoryText(line.action, line.changes)).toBe('E-mail schimbat din andreea@example.com în nou@example.com.');
    expect(h.mails.map((m) => m.to)).toEqual(['andreea@example.com', 'nou@example.com']);
    expect(h.mails[0].mail).toEqual({ kind: 'email-changed', newEmail: 'nou@example.com' });
    expect(h.jobs).toHaveLength(0);
  });
  it('email change uses up an open reset token (a code sent to the old address stops working)', async () => {
    const h = harness();
    const { id } = await seedAccount(h, 'active');
    await changeEmail(h.c, id, { email: 'nou@example.com' });
    expect((await h.fake.store.tokens(id, 'reset')).every((t) => t.usedAt !== null)).toBe(true);
  });
  it('an invited account gets its older invites used and a new invite queued to the new address', async () => {
    const h = harness();
    const { id } = await seedAccount(h, 'invited');
    ok(await changeEmail(h.c, id, { email: 'nou@example.com' }));
    expect(h.fake.state.tokens.find((t) => t.secretHash === 'inv')?.usedAt).not.toBeNull();
    expect(h.jobs[0]).toMatchObject({ recipient: 'nou@example.com', accountId: id });
    expect(h.after).toEqual(['job1']);
  });
  it('email change refuses a taken address', async () => {
    const h = harness();
    const { id } = await seedAccount(h, 'active');
    const other = await h.fake.store.createUser('other@example.com', null);
    await h.fake.store.createAccount({ userId: other, email: 'other@example.com', status: 'active', teamMemberId: 'tm2' });
    expect(await changeEmail(h.c, id, { email: 'Other@example.com' })).toMatchObject({ ok: false, status: 409, error: 'Adresa are deja un cont.' });
    expect(h.mails).toHaveLength(0);
  });
  it('email change ignores case: the same address changes nothing', async () => {
    const h = harness();
    const { id } = await seedAccount(h, 'active');
    const a = ok(await changeEmail(h.c, id, { email: 'ANDREEA@example.com' }));
    expect(a.toast).toBe('E-mail schimbat.');
    expect(h.fake.state.history).toHaveLength(0);
    expect(h.mails).toHaveLength(0);
    expect(h.fake.state.tokens.every((t) => t.usedAt === null)).toBe(true);
  });
  it('a mail failure is logged without the address and does not fail the change', async () => {
    const h = harness({}, false);
    const { id } = await seedAccount(h, 'active');
    expect(ok(await changeEmail(h.c, id, { email: 'nou@example.com' })).account.email).toBe('nou@example.com');
    expect(h.logs.length).toBeGreaterThan(0);
    expect(h.logs.join(' ')).not.toContain('example.com');
  });
  it('400 for a bad e-mail, 404 for an unknown account', async () => {
    const h = harness();
    const { id } = await seedAccount(h, 'active');
    expect(await changeEmail(h.c, id, { email: 'x' })).toMatchObject({ ok: false, status: 400 });
    expect(await changeEmail(h.c, 'nope', { email: 'a@b.ro' })).toMatchObject({ ok: false, status: 404 });
  });
});

describe('readAccount', () => {
  it('none, invited, active, disabled', async () => {
    const h = harness();
    expect(ok(await readAccount(h.c, 'tm1'))).toEqual({ teamMemberId: 'tm1', accountId: null, state: 'none', email: null, since: null, google: false, twoFactor: false });
    expect(await readAccount(h.c, 'nope')).toMatchObject({ ok: false, status: 404 });
    for (const status of ['invited', 'active', 'disabled'] as const) {
      const g = harness();
      const { id } = await seedAccount(g, status);
      await g.fake.store.updateAccount(id, { googleSub: status === 'active' ? 'g1' : null });
      expect(ok(await readAccount(g.c, 'tm1'))).toEqual({ teamMemberId: 'tm1', accountId: id, state: status, email: 'andreea@example.com', since: '2026-11-06', google: status === 'active', twoFactor: false });
      expect(ok(await readAccount({ ...g.c, twoFactorOn: async () => true }, 'tm1'))).toMatchObject({ twoFactor: true });
    }
  });
});

describe('stale invite jobs and the Google identity', () => {
  it('resend, e-mail change of an invited account and disable cancel the queued invite jobs', async () => {
    const a = harness();
    const ia = await seedAccount(a, 'invited');
    ok(await resendInvite(a.c, ia.id));
    expect(a.cancelled).toEqual([ia.id]);
    const b = harness();
    const ib = await seedAccount(b, 'invited');
    ok(await changeEmail(b.c, ib.id, { email: 'nou@example.com' }));
    expect(b.cancelled).toEqual([ib.id]);
    const c = harness();
    const ic = await seedAccount(c, 'active');
    ok(await disableAccount(c.c, ic.id));
    expect(c.cancelled).toEqual([ic.id]);
  });
  it('an e-mail change of an active account leaves no invite job alone and cancels none', async () => {
    const h = harness();
    const { id } = await seedAccount(h, 'active');
    ok(await changeEmail(h.c, id, { email: 'nou@example.com' }));
    expect(h.cancelled).toEqual([]);
  });
  it('an e-mail change clears googleSub, and the answer says google false', async () => {
    const h = harness();
    const { id } = await seedAccount(h, 'active');
    await h.fake.store.updateAccount(id, { googleSub: 'g-1' });
    const a = ok(await changeEmail(h.c, id, { email: 'nou@example.com' }));
    expect(a.account.google).toBe(false);
    expect((await h.fake.store.account(id))?.googleSub).toBeNull();
  });
  it('an e-mail change marks the link as removed (no relink by e-mail) and ends a pending first-link login; no sub, no mark', async () => {
    const h = harness();
    const { id } = await seedAccount(h, 'active');
    const ended: string[] = [];
    const c = { ...h.c, endPendingGoogle: async (accountId: string) => void ended.push(accountId) };
    await h.fake.store.updateAccount(id, { googleSub: 'g-1' });
    ok(await changeEmail(c, id, { email: 'nou@example.com' }));
    expect((await h.fake.store.account(id))?.googleUnlinkedAt).toEqual(expect.any(String));
    expect(ended).toEqual([id]);
    const g = harness();
    const plain = await seedAccount(g, 'active');
    ok(await changeEmail(g.c, plain.id, { email: 'nou@example.com' }));
    expect((await g.fake.store.account(plain.id))?.googleUnlinkedAt).toBeNull();
  });
  it('only a Postgres unique violation or Strapi unique check counts as a unique violation', () => {
    expect(uniqueViolation(Object.assign(new Error('x'), { code: '23505' }))).toMatchObject({ status: 409 });
    expect(uniqueViolation(Object.assign(new Error('This attribute must be unique'), { name: 'ValidationError' }))).toMatchObject({ status: 409 });
    expect(uniqueViolation(new Error('something duplicate or unique in the text'))).toBeNull();
    expect(uniqueViolation(Object.assign(new Error('insert into team_member_x'), { code: '23505', constraint: 'portal_accounts_email_uq' }))).toMatchObject({ error: 'Adresa are deja un cont.' });
    expect(uniqueViolation(Object.assign(new Error('x'), { code: '23505', constraint: 'portal_accounts_team_member_lnk_team_member_uq' }))).toMatchObject({ status: 409 });
  });
});

describe('q26: a deleted team member leaves a disabled account that a new invite reuses', () => {
  /** The account of tm1 is disabled by the delete hook, then the team member link goes with the team member. */
  async function orphan(h: ReturnType<typeof harness>) {
    const seeded = await seedAccount(h, 'active');
    expect((await disableForTeamMembers(h.c, ['tm1'])) as number).toBe(1);
    await h.fake.store.updateAccount(seeded.id, { teamMemberId: null, googleSub: 'g-sub' });
    return seeded;
  }
  it('the delete keeps the account disabled with its sessions and devices revoked', async () => {
    const h = harness();
    const { id } = await seedAccount(h, 'active');
    await disableForTeamMembers(h.c, ['tm1']);
    expect(h.fake.state.accounts.find((a) => a.id === id)).toMatchObject({ status: 'disabled' });
    expect(h.fake.state.sessions.every((s) => s.revokedAt !== null)).toBe(true);
    expect(h.fake.state.devices.every((d) => d.revokedAt !== null)).toBe(true);
  });
  it('an invite with the same e-mail reuses and re-links it: invited, new token and job, old access cleared, hash null, history line', async () => {
    const h = harness();
    const { id, userId } = await orphan(h);
    h.fake.state.history.length = 0;
    const a = ok(await inviteAccount(h.c, 'tm2', { email: 'Andreea@example.com' }));
    expect(a.account).toMatchObject({ teamMemberId: 'tm2', accountId: id, state: 'invited', google: false });
    expect(h.fake.state.accounts).toHaveLength(1);
    expect(h.fake.state.accounts[0]).toMatchObject({ status: 'invited', teamMemberId: 'tm2', googleSub: null, activatedAt: null, disabledAt: null, disabledBy: null, invitedBy: 'admin@edusport.ro' });
    expect(h.fake.state.users).toHaveLength(1);
    expect(h.fake.state.users.find((u) => u.id === userId)).toMatchObject({ passwordHash: null, blocked: false });
    expect(h.fake.state.devices.every((d) => d.revokedAt !== null)).toBe(true);
    expect(h.fake.state.sessions.every((s) => s.revokedAt !== null)).toBe(true);
    const live = h.fake.state.tokens.filter((t) => t.kind === 'invite' && t.usedAt === null);
    expect(live).toHaveLength(1);
    expect(live[0].secretHash).toBe(hashSecret(h.jobs[0].payload.link.split('/invite/')[1]));
    expect(h.jobs[0]).toMatchObject({ recipient: 'andreea@example.com', accountId: id, payload: { name: 'Virgil Ion' } });
    expect(h.after).toEqual(['job1']);
    expect(h.cancelled).toContain(id);
    expect(h.fake.state.history).toHaveLength(1);
    const line = h.fake.state.history[0];
    expect(line).toMatchObject({ action: 'portal-relinked', actor: 'admin@edusport.ro' });
    expect(line.changes).toMatchObject({ email: 'andreea@example.com', name: 'Virgil Ion' });
    expect(portalHistoryText(line.action, line.changes)).toBe('Cont refolosit pentru Virgil Ion');
  });
  it('an account linked to another existing team member, or not disabled, still answers "Adresa are deja un cont."', async () => {
    const h = harness();
    await seedAccount(h, 'disabled');
    expect(await inviteAccount(h.c, 'tm2', { email: 'andreea@example.com' })).toMatchObject({ ok: false, status: 409, error: 'Adresa are deja un cont.' });
    expect(h.jobs).toHaveLength(0);
  });
  it('M3: an orphan with no team member is re-linked whatever its status', async () => {
    for (const status of ['invited', 'active'] as const) {
      const g = harness();
      const { id } = await orphan(g);
      await g.fake.store.updateAccount(id, { status });
      const a = ok(await inviteAccount(g.c, 'tm2', { email: 'andreea@example.com' }));
      expect(a.account).toMatchObject({ teamMemberId: 'tm2', accountId: id, state: 'invited' });
      expect(g.fake.state.accounts).toHaveLength(1);
      expect(g.jobs).toHaveLength(1);
    }
  });
  it('M2: re-link and delete hook take the team member lock before the account lock', async () => {
    const h = harness();
    await orphan(h);
    h.fake.state.locks.length = 0;
    ok(await inviteAccount(h.c, 'tm2', { email: 'andreea@example.com' }));
    expect(h.fake.state.locks[0]).toBe('teamMember:tm2');
    expect(h.fake.state.locks.findIndex((l) => l.startsWith('account:'))).toBeGreaterThan(0);
    const g = harness();
    await seedAccount(g, 'active');
    g.fake.state.locks.length = 0;
    await disableForTeamMembers(g.c, ['tm1']);
    expect(g.fake.state.locks[0]).toBe('teamMember:tm1');
    expect(g.fake.state.locks.findIndex((l) => l.startsWith('account:'))).toBeGreaterThan(0);
  });
  it('M1: a new invite locks the team member and answers stale when an account links it meanwhile', async () => {
    const h = harness();
    const real = h.fake.store.lockTeamMember;
    h.c.store.lockTeamMember = async (id) => {
      await real(id);
      await seedAccount(h, 'invited', 'other@example.com');
    };
    expect(await inviteAccount(h.c, 'tm1', { email: 'nou@example.com' })).toMatchObject({ ok: false, status: 409 });
    expect(h.fake.state.accounts).toHaveLength(1);
    expect(h.jobs).toHaveLength(0);
  });
  it('a failure inside the re-link leaves the account disabled and queues nothing after commit', async () => {
    const h = harness({ queueInvite: async () => { throw new Error('boom'); } });
    const { id } = await orphan(h);
    await expect(inviteAccount(h.c, 'tm2', { email: 'andreea@example.com' })).resolves.toMatchObject({ ok: false });
    expect(h.fake.state.accounts.find((a) => a.id === id)).toMatchObject({ status: 'disabled', teamMemberId: null });
    expect(h.after).toEqual([]);
  });
});

describe('q27: an e-mail change ends every session', () => {
  it('revokes every session and device, clears googleSub, in the same transaction', async () => {
    const h = harness();
    const { id } = await seedAccount(h, 'active');
    await h.fake.store.updateAccount(id, { googleSub: 'g-sub' });
    const a = ok(await changeEmail(h.c, id, { email: 'nou@example.com' }));
    expect(a.account.google).toBe(false);
    expect(h.fake.state.sessions.length).toBeGreaterThan(0);
    expect(h.fake.state.sessions.every((s) => s.revokedAt !== null)).toBe(true);
    expect(h.fake.state.devices.every((d) => d.revokedAt !== null)).toBe(true);
  });
  it('a revokeAll that throws rolls the e-mail change back', async () => {
    const h = harness();
    const { id, userId } = await seedAccount(h, 'active');
    h.c.sessions.revokeAll = async () => { throw new Error('boom'); };
    await expect(changeEmail(h.c, id, { email: 'nou@example.com' })).resolves.toMatchObject({ ok: false });
    expect((await h.fake.store.account(id))?.email).toBe('andreea@example.com');
    expect((await h.fake.store.user(userId))?.email).toBe('andreea@example.com');
  });
  it('the same address changes no session', async () => {
    const h = harness();
    const { id } = await seedAccount(h, 'active');
    await changeEmail(h.c, id, { email: 'ANDREEA@example.com' });
    expect(h.fake.state.sessions.every((s) => s.revokedAt === null)).toBe(true);
  });
});
