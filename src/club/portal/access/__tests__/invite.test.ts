import { describe, expect, it } from 'vitest';
import { LINKS } from '../../../../email/__tests__/helpers';
import { renderPortalAccess } from '../../../../email/portal-access-email';
import { renderPortalInvite, type PortalInvitePayload } from '../../../../email/portal-email';
import { portalHistoryText } from '../../copy';
import { harness, NOW, seedAccount, type Harness } from '../../accounts/__tests__/harness';
import { historyTexts } from '../../../history-text';
import { SUBJECT } from '../../../subjects';
import { ADMIN_ERRORS } from '../../../athletes/errors';
import { inviteAccess, removeAccess, resendAccess } from '../invite';
import type { AthleteForAccess } from '../types';

const ok = <T>(r: { ok: boolean; data?: T }): T => {
  expect(r.ok).toBe(true);
  return (r as { data: T }).data;
};

const ANA: AthleteForAccess = { id: 'ath1', name: 'Ana Ionescu', email: 'parinte1@example.invalid', status: 'activ', birthDate: '2015-04-03', contactName: 'Ioana Ionescu' };
const MATEI: AthleteForAccess = { id: 'ath2', name: 'Matei Ionescu', email: 'parinte1@example.invalid', status: 'activ', birthDate: '2013-01-09', contactName: null };

function withAthletes(h: Harness, ...athletes: AthleteForAccess[]): Harness {
  h.access.state.athletes.push(...athletes);
  return h;
}

const athleteLines = (h: Harness, id = 'ath1') => h.access.state.history.filter((l) => l.athleteId === id).map((l) => historyTexts(l.action, l.changes, SUBJECT.athlete)[0]);

describe('inviteAccess case 1: no account for the e-mail', () => {
  it('creates user and invited account named after the contact, one parent invite on the sportiv host, one access row', async () => {
    const h = withAthletes(harness(), ANA);
    const a = ok(await inviteAccess(h.c, 'ath1'));
    expect(a.toast).toBe('Invitație trimisă.');
    expect(a.access).toMatchObject({ athleteId: 'ath1', state: 'invited', email: 'parinte1@example.invalid', adult: false, canInvite: false });
    expect(h.fake.state.users).toHaveLength(1);
    expect(h.fake.state.users[0].passwordHash).toBeNull();
    expect(h.fake.state.accounts[0]).toMatchObject({ status: 'invited', name: 'Ioana Ionescu', email: 'parinte1@example.invalid', teamMemberId: null });
    expect(h.fake.state.tokens).toHaveLength(1);
    expect(h.fake.state.tokens[0]).toMatchObject({ host: 'sportiv', kind: 'invite' });
    expect(h.access.state.rows).toHaveLength(1);
    expect(h.jobs).toHaveLength(1);
    expect(h.after).toEqual(['job1']);
    const mail = renderPortalInvite({ payload: h.jobs[0].payload as PortalInvitePayload, links: LINKS });
    expect(mail.subject).toBe('Acces la portalul EduSport');
    expect(mail.text).toContain('Bună, Ioana Ionescu,');
    expect(mail.text).toContain('Ai primit acces la portalul EduSport pentru Ana Ionescu.');
    expect(mail.text).toContain('https://sportiv.scoaladepatinaj.com/invite/');
    expect(mail.text).toContain('Linkul este valabil 7 zile.');
    expect(athleteLines(h)).toEqual(['Acces portal: invitație trimisă la parinte1@example.invalid']);
    const line = h.fake.state.history.find((l) => l.action === 'portal-access-granted');
    expect(portalHistoryText(line!.action, line!.changes)).toBe('Acces la Ana Ionescu');
  });
  it('the holder name falls back to the athlete when there is no contact person', async () => {
    const h = withAthletes(harness(), { ...ANA, contactName: null });
    ok(await inviteAccess(h.c, 'ath1'));
    expect(h.fake.state.accounts[0].name).toBe('Ana Ionescu');
  });
});

describe('inviteAccess case 2: active account', () => {
  it('adds the access at once and sends one access mail, no invite', async () => {
    const h = withAthletes(harness(), { ...ANA, email: 'andreea@example.com' });
    const { id } = await seedAccount(h, 'active');
    const a = ok(await inviteAccess(h.c, 'ath1'));
    expect(a.toast).toBe('Acces adăugat.');
    expect(a.access.state).toBe('active');
    expect(h.access.state.rows).toMatchObject([{ athleteId: 'ath1', accountId: id }]);
    expect(h.jobs).toHaveLength(0);
    expect(h.accessJobs).toHaveLength(1);
    const mail = renderPortalAccess({ payload: h.accessJobs[0].payload, links: LINKS });
    expect(mail.subject).toBe('Acces nou în portalul EduSport');
    expect(mail.text).toContain('Ai acces și la Ana Ionescu în portalul EduSport.');
    expect(mail.text).toContain('https://sportiv.scoaladepatinaj.com/');
    expect(h.fake.state.tokens.every((t) => t.usedAt === null)).toBe(true);
    expect(athleteLines(h)).toEqual(['Acces portal adăugat: andreea@example.com']);
  });
  it('the coach mail variant names the antrenor host', () => {
    const mail = renderPortalAccess({ payload: { name: 'X', variant: 'coach', childName: null, link: 'https://antrenor.scoaladepatinaj.com/', host: 'antrenor.scoaladepatinaj.com' }, links: LINKS });
    expect(mail.text).toContain('Poți intra și pe antrenor.scoaladepatinaj.com cu același cont.');
  });
  it('a second child on the same account is a second access row and a second mail', async () => {
    const h = withAthletes(harness(), ANA, MATEI);
    ok(await inviteAccess(h.c, 'ath1'));
    await h.fake.store.updateAccount(h.fake.state.accounts[0].id, { status: 'active' });
    const a = ok(await inviteAccess(h.c, 'ath2'));
    expect(a.toast).toBe('Acces adăugat.');
    expect(h.access.state.rows.filter((r) => r.revokedAt === null)).toHaveLength(2);
    expect(h.accessJobs).toHaveLength(1);
  });
});

describe('inviteAccess case 3: invited account', () => {
  it('older invites are used up and one fresh invite goes out on the host of the latest one', async () => {
    const h = withAthletes(harness(), { ...ANA, email: 'andreea@example.com' });
    const { id } = await seedAccount(h, 'invited');
    const a = ok(await inviteAccess(h.c, 'ath1'));
    expect(a.toast).toBe('Invitație trimisă.');
    const invites = h.fake.state.tokens.filter((t) => t.kind === 'invite');
    expect(invites.filter((t) => t.usedAt === null)).toHaveLength(1);
    expect(invites.find((t) => t.usedAt === null)?.host).toBe('antrenor');
    expect(h.jobs).toHaveLength(1);
    expect(h.cancelled).toEqual([id]);
    expect(h.access.state.rows).toHaveLength(1);
  });
  it('a second child on a pending parent invite names both children', async () => {
    const h = withAthletes(harness(), ANA, MATEI);
    ok(await inviteAccess(h.c, 'ath1'));
    ok(await inviteAccess(h.c, 'ath2'));
    expect(h.jobs).toHaveLength(2);
    const mail = renderPortalInvite({ payload: h.jobs[1].payload as PortalInvitePayload, links: LINKS });
    expect(mail.text).toContain('pentru Ana Ionescu și Matei Ionescu');
    expect(h.fake.state.tokens.filter((t) => t.usedAt === null)).toHaveLength(1);
    expect(h.fake.state.tokens.find((t) => t.usedAt === null)?.host).toBe('sportiv');
  });
});

describe('inviteAccess refusals', () => {
  it('a disabled account: 409 and nothing written', async () => {
    const h = withAthletes(harness(), { ...ANA, email: 'andreea@example.com' });
    await seedAccount(h, 'disabled');
    expect(await inviteAccess(h.c, 'ath1')).toEqual({ ok: false, status: 409, error: 'Contul acestei adrese este dezactivat.' });
    expect(h.access.state.rows).toHaveLength(0);
    expect(h.jobs).toHaveLength(0);
    expect(h.accessJobs).toHaveLength(0);
    expect(h.after).toHaveLength(0);
  });
  it('no e-mail 400, a new athlete 409, an anonymized one 409, an unknown one 404', async () => {
    const h = withAthletes(harness(), { ...ANA, email: null }, { ...MATEI, status: 'nou' }, { ...MATEI, id: 'ath3', status: 'anonimizat' });
    expect(await inviteAccess(h.c, 'ath1')).toEqual({ ok: false, status: 400, error: 'Adaugă un e-mail în Date.' });
    expect(await inviteAccess(h.c, 'ath2')).toEqual({ ok: false, status: 409, error: 'Confirmă sportivul întâi.' });
    expect(await inviteAccess(h.c, 'ath3')).toMatchObject({ ok: false, status: 409 });
    expect(await inviteAccess(h.c, 'nope')).toMatchObject({ ok: false, status: 404 });
    expect(h.fake.state.accounts).toHaveLength(0);
  });
  it('an athlete that already has a live access to this account is stale', async () => {
    const h = withAthletes(harness(), ANA);
    ok(await inviteAccess(h.c, 'ath1'));
    expect(await inviteAccess(h.c, 'ath1')).toMatchObject({ ok: false, status: 409, error: ADMIN_ERRORS.stale });
    expect(h.access.state.rows).toHaveLength(1);
    expect(h.jobs).toHaveLength(1);
  });
  it('a live access to another account is revoked first (email_schimbat)', async () => {
    const h = withAthletes(harness(), { ...ANA, email: 'andreea@example.com' });
    await seedAccount(h, 'active');
    await h.access.store.createAccess({ athleteId: 'ath1', accountId: 'other', email: 'vechi@example.invalid', invitedAt: NOW.toISOString(), invitedBy: 'x' });
    ok(await inviteAccess(h.c, 'ath1'));
    expect(h.access.state.rows.find((r) => r.accountId === 'other')).toMatchObject({ revokeReason: 'email_schimbat', revokedBy: 'admin@edusport.ro' });
    expect(h.access.state.rows.filter((r) => r.revokedAt === null)).toHaveLength(1);
  });
  it('a failure after the account is created leaves nothing and queues nothing after commit', async () => {
    const h = withAthletes(harness(), ANA);
    h.c.access = { ...h.c.access, createAccess: async () => { throw new Error('boom'); } };
    expect(await inviteAccess(h.c, 'ath1')).toMatchObject({ ok: false, status: 500 });
    expect(h.fake.state.accounts).toHaveLength(0);
    expect(h.fake.state.users).toHaveLength(0);
    expect(h.after).toHaveLength(0);
  });
});

describe('an e-mail edited between the click and the lock', () => {
  it('a single invite answers stale and writes nothing', async () => {
    const h = withAthletes(harness(), ANA);
    const real = h.access.store.athleteForAccess;
    let reads = 0;
    h.c.access = { ...h.c.access, athleteForAccess: async (id) => {
      const row = await real(id);
      return row && ++reads > 1 ? { ...row, email: 'corectat@example.invalid' } : row;
    } };
    expect(await inviteAccess(h.c, 'ath1')).toEqual({ ok: false, status: 409, error: ADMIN_ERRORS.stale });
    expect(h.access.state.rows).toHaveLength(0);
    expect(h.fake.state.accounts).toHaveLength(0);
    expect(h.jobs).toHaveLength(0);
  });
});

describe('resendAccess', () => {
  it('on an invited account: older invite used, one fresh invite, resend line', async () => {
    const h = withAthletes(harness(), ANA);
    ok(await inviteAccess(h.c, 'ath1'));
    const a = ok(await resendAccess(h.c, 'ath1'));
    expect(a.toast).toBe('Invitație trimisă.');
    expect(h.jobs).toHaveLength(2);
    expect(h.fake.state.tokens.filter((t) => t.usedAt === null)).toHaveLength(1);
    expect(h.fake.state.history.some((l) => l.action === 'portal-invite-resent')).toBe(true);
  });
  it('on an active account, or an athlete without access, answers stale and sends nothing', async () => {
    const h = withAthletes(harness(), ANA, MATEI);
    ok(await inviteAccess(h.c, 'ath1'));
    await h.fake.store.updateAccount(h.fake.state.accounts[0].id, { status: 'active' });
    const before = h.jobs.length;
    expect(await resendAccess(h.c, 'ath1')).toMatchObject({ ok: false, status: 409 });
    expect(await resendAccess(h.c, 'ath2')).toMatchObject({ ok: false, status: 409 });
    expect(await resendAccess(h.c, 'nope')).toMatchObject({ ok: false, status: 404 });
    expect(h.jobs).toHaveLength(before);
  });
});

describe('removeAccess', () => {
  it('revokes with reason scos and writes the athlete line', async () => {
    const h = withAthletes(harness(), ANA);
    ok(await inviteAccess(h.c, 'ath1'));
    const a = ok(await removeAccess(h.c, 'ath1'));
    expect(a.toast).toBe('Acces scos.');
    expect(a.access).toMatchObject({ state: 'none', canInvite: true });
    expect(h.access.state.rows[0]).toMatchObject({ revokeReason: 'scos', revokedBy: 'admin@edusport.ro' });
    expect(athleteLines(h)).toContain('Acces portal scos: parinte1@example.invalid');
  });
  it('without a live access it is stale; an unknown athlete is 404', async () => {
    const h = withAthletes(harness(), ANA);
    expect(await removeAccess(h.c, 'ath1')).toMatchObject({ ok: false, status: 409 });
    expect(await removeAccess(h.c, 'nope')).toMatchObject({ ok: false, status: 404 });
  });
  it('after a removal the athlete can be invited again', async () => {
    const h = withAthletes(harness(), ANA);
    ok(await inviteAccess(h.c, 'ath1'));
    ok(await removeAccess(h.c, 'ath1'));
    await h.fake.store.updateAccount(h.fake.state.accounts[0].id, { status: 'active' });
    expect(ok(await inviteAccess(h.c, 'ath1')).toast).toBe('Acces adăugat.');
  });
});
