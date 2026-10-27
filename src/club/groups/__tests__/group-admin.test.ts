import { describe, expect, it } from 'vitest';
import { createGroup, deleteGroup, readGroupInput, updateGroup } from '../group-admin';
import { event, fakeContext, member } from './fake-group-store';

const body = (over: Record<string, unknown> = {}) => ({ section: 'scoala-afi', name: 'Începători', priceListId: 'pl-std', coachIds: ['tm-virgil'], programPublic: true, ...over });

describe('reading the group window (5.4, W11)', () => {
  it('trims the name, writes comma letters and defaults "Program public" to on', () => {
    expect(readGroupInput({ name: '  Primii Paşi ', coachIds: ['tm-virgil'] })).toEqual({ ok: true, value: { name: 'Primii Pași', priceListId: null, coachIds: ['tm-virgil'], programPublic: true } });
    expect(readGroupInput({ name: ' ' })).toEqual({ ok: false, error: 'Completați numele.' });
  });
});

describe('"Grupă nouă"', () => {
  it('creates the group last in its section, with a history line', async () => {
    const { ctx, state } = fakeContext();
    const res = await createGroup(ctx, body());
    expect(res).toEqual({ ok: true, data: { documentId: expect.any(String), name: 'Începători' } });
    const created = state.groups.find((g) => g.name === 'Începători');
    expect(created).toMatchObject({ sectionId: 'afi', order: 4, priceListId: 'pl-std', coachIds: ['tm-virgil'], programPublic: true, active: true });
    expect(state.history.map((h) => [h.subjectType, h.action])).toEqual([['group', 'group-created']]);
  });

  it('refuses a name already used in the section, ignoring case and diacritics (W17)', async () => {
    const { ctx } = fakeContext();
    expect(await createGroup(ctx, body({ name: 'primii pasi' }))).toEqual({ ok: false, status: 409, error: 'Există deja o grupă cu acest nume.' });
    expect((await createGroup(ctx, body({ section: 'club', name: 'Primii Pași', priceListId: null }))).ok).toBe(true);
  });

  it('refuses a price list of another section or an unknown coach', async () => {
    const { ctx } = fakeContext();
    expect((await createGroup(ctx, body({ priceListId: 'pl-club' }))).ok).toBe(false);
    expect((await createGroup(ctx, body({ coachIds: ['nobody'] }))).ok).toBe(false);
  });
});

describe('"Editează grupa"', () => {
  it('writes one line per changed field, old -> new, and pings the website for a public change', async () => {
    const { ctx, state, revalidated } = fakeContext();
    const res = await updateGroup(ctx, 'g-ib', { name: 'Intermediari Bronz', priceListId: null, coachIds: ['tm-virgil', 'tm-andreea'], programPublic: false });
    expect(res).toEqual({ ok: true, data: { changed: true } });
    expect(state.history[0].changes).toEqual({ fields: {
      name: { from: 'Intermediari Bronze', to: 'Intermediari Bronz' }, priceList: { from: 'Standard', to: '' },
      coaches: { from: 'Virgil Pascu', to: 'Andreea Pascu, Virgil Pascu' }, programPublic: { from: true, to: false },
    } });
    expect(revalidated()).toBe(1);
  });

  it('answers "no change" without a line', async () => {
    const { ctx, state } = fakeContext();
    expect(await updateGroup(ctx, 'g-ib', { name: 'Intermediari Bronze', priceListId: 'pl-std', coachIds: ['tm-virgil'], programPublic: true })).toEqual({ ok: true, data: { changed: false } });
    expect(state.history).toEqual([]);
  });
});

describe('"Șterge grupa" (W11)', () => {
  it('deletes a group that never had a member or an event', async () => {
    const { ctx, state } = fakeContext();
    expect(await deleteGroup(ctx, 'g-is')).toEqual({ ok: true, data: { name: 'Intermediari Silver' } });
    expect(state.groups.some((g) => g.id === 'g-is')).toBe(false);
  });

  it('refuses (409) once it had an ended membership or an event', async () => {
    const used = fakeContext({ memberships: [member({ id: 'm1', athleteId: 'a1', groupId: 'g-is', to: '2026-10-31' })] });
    expect(await deleteGroup(used.ctx, 'g-is')).toEqual({ ok: false, status: 409, error: 'Datele s-au schimbat. Reîncarcă pagina.' });
    const scheduled = fakeContext({ events: [event({ id: 'e1', groupId: 'g-is' })] });
    expect((await deleteGroup(scheduled.ctx, 'g-is')).ok).toBe(false);
  });

  it('refuses (409) when the Istoric shows a line beyond creation and edit, even with no row left (same-day delete)', async () => {
    for (const action of ['member-added', 'class-added', 'class-deleted', 'program-added']) {
      const { ctx, state } = fakeContext();
      await ctx.store.record({ subjectType: 'group', subjectId: 'g-is', action, actor: 'admin@example.com' });
      expect(await deleteGroup(ctx, 'g-is'), action).toEqual({ ok: false, status: 409, error: 'Datele s-au schimbat. Reîncarcă pagina.' });
      expect(state.groups.some((g) => g.id === 'g-is')).toBe(true);
    }
  });

  it('still deletes a group whose Istoric holds only creation and edit lines', async () => {
    const { ctx } = fakeContext();
    await ctx.store.record({ subjectType: 'group', subjectId: 'g-is', action: 'group-created', actor: 'a@b.ro' });
    await ctx.store.record({ subjectType: 'group', subjectId: 'g-is', action: 'group-updated', changes: { fields: {} }, actor: 'a@b.ro' });
    expect((await deleteGroup(ctx, 'g-is')).ok).toBe(true);
  });
});
