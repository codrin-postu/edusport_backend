import { describe, expect, it } from 'vitest';
import { A_ANA, A_IOANA, A_MATEI, sportivCtx } from '../../portal/sportiv/__tests__/sportiv-seed';
import { givePin } from '../grants';
import { readParcurs, type ParcursStaffDeps } from '../read';
import { addAward, removeAwardOf, removePinOf } from '../staff';

const TODAY = '2026-11-20';
const setup = () => {
  const c = sportivCtx('parinte1@example.invalid');
  const d: ParcursStaffDeps = { store: c.parcurs, club: c.club.store, presence: c.presence.store, results: async () => null, adminNames: async () => ({ 7: 'Mara Admin' }) };
  return { c, d };
};

describe('awards', () => {
  it('adds an award and answers the fresh Parcurs, then removes it', async () => {
    const { d } = setup();
    const added = await addAward(d, A_ANA, { kind: 'jump', jump: 'f', level: 3 }, { adminId: '7' }, TODAY);
    expect(added).toMatchObject({ ok: true, data: { awards: [{ pin: 'saritura-3f', givenBy: 'Mara Admin' }] } });
    const id = added.ok === true ? added.data.awards[0].id : '';
    const removed = await removeAwardOf(d, A_ANA, id, TODAY);
    expect(removed).toMatchObject({ ok: true, data: { awards: [] } });
  });

  it('refuses a bad kind and a bad jump with 400', async () => {
    const { d } = setup();
    expect(await addAward(d, A_ANA, { kind: 'x' }, { adminId: '7' }, TODAY)).toMatchObject({ ok: false, status: 400 });
    expect(await addAward(d, A_ANA, { kind: 'jump', jump: 'zz', level: 1 }, { adminId: '7' }, TODAY)).toMatchObject({ ok: false, status: 400, error: 'BAD_JUMP' });
  });

  it('removing an award through another athlete is 404 and leaves it', async () => {
    const { d, c } = setup();
    await addAward(d, A_ANA, { kind: 'steaua' }, { adminId: '7' }, TODAY);
    const id = c.parcursFake.state.awards[0].id;
    expect(await removeAwardOf(d, A_MATEI, id, TODAY)).toMatchObject({ ok: false, status: 404 });
    expect(c.parcursFake.state.awards).toHaveLength(1);
  });
});

describe('pins', () => {
  async function pinGiven() {
    const s = setup();
    await readParcurs(s.d, A_ANA, TODAY);
    const given = await givePin(s.c.parcurs, { giverId: A_ANA, recipientId: A_IOANA, design: 1, today: TODAY, activeIds: new Set([A_IOANA]) });
    return { ...s, pinId: given.ok === true ? given.id : '' };
  }

  it('the admin deletes a pin of the giver or of the recipient', async () => {
    const { d, c, pinId } = await pinGiven();
    expect(await removePinOf(d, A_IOANA, pinId, TODAY)).toMatchObject({ ok: true });
    expect(c.parcursFake.state.pins).toHaveLength(0);
  });

  it('a pin of two other athletes is 404 and stays', async () => {
    const { d, c, pinId } = await pinGiven();
    expect(await removePinOf(d, A_MATEI, pinId, TODAY)).toMatchObject({ ok: false, status: 404 });
    expect(c.parcursFake.state.pins).toHaveLength(1);
  });
});
