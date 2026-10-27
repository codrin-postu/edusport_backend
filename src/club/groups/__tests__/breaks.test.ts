import { describe, expect, it } from 'vitest';
import { createBreak, deleteBreak, listBreaks, readBreakInput, updateBreak } from '../breaks';
import { fakeContext } from './fake-group-store';

const BODY = { label: ' Vacanța de iarnă ', startDate: '2026-12-20', endDate: '2027-01-06' };

describe('the break window (7.1)', () => {
  it('reads Nume, De la, Până la; the end before the start is refused with the spec text', () => {
    expect(readBreakInput(BODY)).toEqual({ ok: true, value: { label: 'Vacanța de iarnă', startDate: '2026-12-20', endDate: '2027-01-06' } });
    expect(readBreakInput({ ...BODY, endDate: '2026-12-19' })).toEqual({ ok: false, error: 'Data de sfârșit trebuie să fie după data de început.' });
    expect(readBreakInput({ ...BODY, endDate: '2026-12-20' }).ok).toBe(true);
    expect(readBreakInput({ ...BODY, label: '' }).ok).toBe(false);
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

  it('lists by De la', async () => {
    const { store } = fakeContext({ breaks: [{ id: 'b2', label: 'Paște', startDate: '2027-04-03', endDate: '2027-04-12' }, { id: 'b1', label: 'Iarnă', startDate: '2026-12-20', endDate: '2027-01-06' }] });
    expect((await listBreaks(store)).map((b) => b.id)).toEqual(['b1', 'b2']);
  });

  it('an unknown break is 404', async () => {
    const { ctx } = fakeContext();
    expect((await deleteBreak(ctx, 'nope')).ok).toBe(false);
  });
});
