import { describe, expect, it } from 'vitest';
import { LINKS } from '../../../../email/__tests__/helpers';
import { renderPortalAccess } from '../../../../email/portal-access-email';
import { renderPortalInvite, type PortalInvitePayload } from '../../../../email/portal-email';
import { harness, NOW, seedAccount, type Harness } from '../../accounts/__tests__/harness';
import { bulkInvite, bulkPreview } from '../bulk';
import type { AthleteForAccess } from '../types';

const ok = <T>(r: { ok: boolean; data?: T }): T => {
  expect(r.ok).toBe(true);
  return (r as { data: T }).data;
};

const athlete = (id: string, name: string, over: Partial<AthleteForAccess> = {}): AthleteForAccess =>
  ({ id, name, email: 'parinte1@example.invalid', status: 'activ', birthDate: '2015-04-03', contactName: 'Ioana Ionescu', ...over });

function world(...athletes: AthleteForAccess[]): Harness {
  const h = harness();
  h.access.state.athletes.push(...athletes);
  return h;
}

describe('bulkPreview', () => {
  it('two siblings with one e-mail: two invitations to one address', async () => {
    const h = world(athlete('a1', 'Ana Ionescu'), athlete('a2', 'Matei Ionescu'));
    expect(ok(await bulkPreview(h.c, ['a1', 'a2']))).toEqual({ invites: 2, addresses: 1, skipped: [] });
  });
  it('lists the athletes that are left out with the reason', async () => {
    const h = world(
      athlete('a1', 'Ana Ionescu'), athlete('nou', 'Elena Stan', { status: 'nou' }), athlete('fara', 'Radu Pop', { email: null }),
      athlete('are', 'Sara Dinu', { email: 'sara@example.invalid' }), athlete('anon', 'Sportiv anonimizat', { status: 'anonimizat', email: null }),
    );
    await h.access.store.createAccess({ athleteId: 'are', accountId: 'acc', email: 'sara@example.invalid', invitedAt: NOW.toISOString(), invitedBy: 'x' });
    expect(ok(await bulkPreview(h.c, ['a1', 'nou', 'fara', 'are', 'anon', 'unknown']))).toEqual({
      invites: 1, addresses: 1,
      skipped: [
        { athleteId: 'nou', name: 'Elena Stan', reason: 'nou' }, { athleteId: 'fara', name: 'Radu Pop', reason: 'fără e-mail' },
        { athleteId: 'are', name: 'Sara Dinu', reason: 'are deja acces' }, { athleteId: 'anon', name: 'Sportiv anonimizat', reason: 'anonimizat' },
      ],
    });
  });
  it('more than 200 ids, or none, is 400 "Cerere invalidă."', async () => {
    const h = world();
    expect(await bulkPreview(h.c, Array.from({ length: 201 }, (_, i) => `x${i}`))).toEqual({ ok: false, status: 400, error: 'Cerere invalidă.' });
    expect(await bulkPreview(h.c, [])).toMatchObject({ ok: false, status: 400 });
  });
});

describe('bulkInvite', () => {
  it('one invite job names both siblings, one access row each, toast of one', async () => {
    const h = world(athlete('a1', 'Ana Ionescu'), athlete('a2', 'Matei Ionescu'));
    const r = ok(await bulkInvite(h.c, ['a1', 'a2']));
    expect(r).toEqual({ sent: 1, toast: '1 invitație trimisă.' });
    expect(h.jobs).toHaveLength(1);
    expect(h.after).toEqual(['job1']);
    const mail = renderPortalInvite({ payload: h.jobs[0].payload as PortalInvitePayload, links: LINKS });
    expect(mail.text).toContain('pentru Ana Ionescu și Matei Ionescu');
    expect(h.access.state.rows.filter((x) => x.revokedAt === null).map((x) => x.athleteId)).toEqual(['a1', 'a2']);
    expect(h.fake.state.accounts).toHaveLength(1);
    expect(h.fake.state.tokens.filter((t) => t.usedAt === null)).toHaveLength(1);
  });
  it('several addresses: one mail each; 25 sent reads "25 de invitații trimise."', async () => {
    const list = Array.from({ length: 25 }, (_, i) => athlete(`a${i}`, `Copil ${i}`, { email: `p${i}@example.invalid` }));
    const h = world(...list);
    const r = ok(await bulkInvite(h.c, list.map((a) => a.id)));
    expect(r).toEqual({ sent: 25, toast: '25 de invitații trimise.' });
    expect(h.jobs).toHaveLength(25);
  });
  it('an active account gets one access mail naming both children, no invite', async () => {
    const h = world(athlete('a1', 'Ana Ionescu', { email: 'andreea@example.com' }), athlete('a2', 'Matei Ionescu', { email: 'andreea@example.com' }));
    await seedAccount(h, 'active');
    expect(ok(await bulkInvite(h.c, ['a1', 'a2'])).sent).toBe(1);
    expect(h.jobs).toHaveLength(0);
    expect(h.accessJobs).toHaveLength(1);
    expect(renderPortalAccess({ payload: h.accessJobs[0].payload, links: LINKS }).text).toContain('Ai acces și la Ana Ionescu și Matei Ionescu');
    expect(h.access.state.rows).toHaveLength(2);
  });
  it('one failing address does not stop the others and is not counted; its rows are rolled back', async () => {
    const h = world(athlete('bad1', 'Ana Ionescu', { email: 'dez@example.invalid' }), athlete('bad2', 'Matei Ionescu', { email: 'dez@example.invalid' }), athlete('g', 'Sara Dinu', { email: 'sara@example.invalid' }));
    const { id } = await seedAccount(h, 'disabled', 'dez@example.invalid');
    expect(id).toBeTruthy();
    const r = ok(await bulkInvite(h.c, ['bad1', 'bad2', 'g']));
    expect(r).toEqual({ sent: 1, toast: '1 invitație trimisă.' });
    expect(h.access.state.rows.map((x) => x.athleteId)).toEqual(['g']);
    expect(h.jobs).toHaveLength(1);
    expect(h.jobs[0].recipient).toBe('sara@example.invalid');
  });
  it('a crash in the second sibling leaves the first one unlinked too', async () => {
    const h = world(athlete('a1', 'Ana Ionescu'), athlete('a2', 'Matei Ionescu'));
    const real = h.access.store.createAccess;
    let n = 0;
    h.c.access = { ...h.c.access, createAccess: async (row) => { if (++n === 2) throw new Error('boom'); return real(row); } };
    expect(ok(await bulkInvite(h.c, ['a1', 'a2'])).sent).toBe(0);
    expect(h.fake.state.accounts).toHaveLength(0);
    expect(h.after).toHaveLength(0);
  });
  it('athletes that were skipped in the preview get nothing; a bad request is 400', async () => {
    const h = world(athlete('nou', 'Elena Stan', { status: 'nou' }));
    expect(ok(await bulkInvite(h.c, ['nou']))).toEqual({ sent: 0, toast: '0 invitații trimise.' });
    expect(await bulkInvite(h.c, [])).toMatchObject({ ok: false, status: 400 });
    expect(h.fake.state.accounts).toHaveLength(0);
  });
});
