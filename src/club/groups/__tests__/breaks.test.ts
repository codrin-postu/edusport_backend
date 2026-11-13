import { describe, expect, it } from 'vitest';
import { createBreak, deleteBreak, listBreaks, readBreakInput, updateBreak } from '../breaks';
import { fakeContext } from './fake-group-store';

const BODY = { label: ' Vacanța de iarnă ', startDate: '2026-12-20', endDate: '2027-01-06' };
const CLEAN = { label: 'Vacanța de iarnă', startDate: '2026-12-20', endDate: '2027-01-06', exceptGroupIds: [] };

describe('the break window (7.1)', () => {
  it('reads Nume, De la, Până la; the end before the start is refused with the spec text', () => {
    expect(readBreakInput(BODY)).toEqual({ ok: true, value: CLEAN });
    expect(readBreakInput({ ...BODY, endDate: '2026-12-19' })).toEqual({ ok: false, error: 'Data de sfârșit trebuie să fie după data de început.' });
    expect(readBreakInput({ ...BODY, endDate: '2026-12-20' }).ok).toBe(true);
    expect(readBreakInput({ ...BODY, label: '' }).ok).toBe(false);
  });

  it('reads the unticked groups sorted and unique; a non-array is refused', () => {
    expect(readBreakInput({ ...BODY, exceptGroupIds: ['g2', 'g1', 'g2'] })).toEqual({ ok: true, value: { ...CLEAN, exceptGroupIds: ['g1', 'g2'] } });
    expect(readBreakInput({ ...BODY, exceptGroupIds: 'g1' }).ok).toBe(false);
  });
});

describe('Pauze writes', () => {
  it('create, edit and delete, each with its line and a website ping', async () => {
    const { ctx, state, revalidated } = fakeContext();
    const created = await createBreak(ctx, BODY);
    const id = created.ok ? created.data.id : '';
    expect(await updateBreak(ctx, id, { ...BODY, endDate: '2027-01-08' })).toEqual({ ok: true, data: { changed: true } });
    expect(await updateBreak(ctx, id, { ...BODY, endDate: '2027-01-08' })).toEqual({ ok: true, data: { changed: false } });
    expect(await deleteBreak(ctx, id)).toEqual({ ok: true, data: { label: 'Vacanța de iarnă' } });
    expect(state.history.map((h) => [h.subjectType, h.action])).toEqual([['calendar-blackout', 'break-added'], ['calendar-blackout', 'break-updated'], ['calendar-blackout', 'break-deleted']]);
    expect(state.history[1].changes).toEqual({ fields: { endDate: { from: '2027-01-06', to: '2027-01-08' } } });
    expect(revalidated()).toBe(3);
  });

  it('unknown groups are refused; updating only the ticks writes one line, the same ticks in another order change nothing', async () => {
    const { ctx, state, store } = fakeContext();
    const [g1, g2] = (await store.groups()).map((g) => g.id);
    expect((await createBreak(ctx, { ...BODY, exceptGroupIds: ['nope'] })).ok).toBe(false);
    const created = await createBreak(ctx, { ...BODY, exceptGroupIds: [g1] });
    const id = created.ok ? created.data.id : '';
    expect(await updateBreak(ctx, id, { ...BODY, exceptGroupIds: [g2, g1] })).toEqual({ ok: true, data: { changed: true } });
    expect(await updateBreak(ctx, id, { ...BODY, exceptGroupIds: [g1, g2] })).toEqual({ ok: true, data: { changed: false } });
    expect(state.history.filter((h) => h.action === 'break-updated')).toHaveLength(1);
    expect(state.history[1].changes).toEqual({ fields: { exceptGroupIds: { from: [g1], to: [g1, g2].sort() } } });
  });

  it('lists by De la', async () => {
    const { store } = fakeContext({ breaks: [{ id: 'b2', label: 'Paște', startDate: '2027-04-03', endDate: '2027-04-12', exceptGroupIds: [] }, { id: 'b1', label: 'Iarnă', startDate: '2026-12-20', endDate: '2027-01-06', exceptGroupIds: [] }] });
    expect((await listBreaks(store)).map((b) => b.id)).toEqual(['b1', 'b2']);
  });

  it('an unknown break is 404', async () => {
    const { ctx } = fakeContext();
    expect((await deleteBreak(ctx, 'nope')).ok).toBe(false);
  });
});
