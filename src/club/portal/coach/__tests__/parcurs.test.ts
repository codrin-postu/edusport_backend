import { describe, expect, it } from 'vitest';
import { PORTAL_ERRORS } from '../../copy';
import { addCoachAward, readCoachParcurs, removeCoachAward } from '../parcurs';
import { coachCtx } from './coach-seed';

describe('coach Parcurs', () => {
  it('reads an own athlete', async () => {
    const out = await readCoachParcurs(coachCtx('tm-andreea'), 'a-club-1');
    expect(out).toMatchObject({ ok: true, data: { pinsLeft: 2, awards: [] } });
  });

  it('refuses 403 an athlete of another coach and one with no group, for read, award and removal', async () => {
    const c = coachCtx('tm-andreea');
    for (const id of ['a-b-1', 'a-free']) {
      expect(await readCoachParcurs(c, id), id).toEqual({ ok: false, status: 403, error: PORTAL_ERRORS.noAccess });
      expect(await addCoachAward(c, id, { kind: 'steaua' }), id).toMatchObject({ ok: false, status: 403 });
      expect(await removeCoachAward(c, id, 'x'), id).toMatchObject({ ok: false, status: 403 });
    }
    expect(c.parcursFake.state.awards).toHaveLength(0);
  });

  it('awards and removes an award on an own athlete, the coach named in full', async () => {
    const c = coachCtx('tm-andreea');
    const added = await addCoachAward(c, 'a-club-1', { kind: 'jump', jump: 'a', level: 1 });
    expect(added).toMatchObject({ ok: true, data: { awards: [{ pin: 'saritura-1a', givenBy: 'Andreea Pascu' }] } });
    const id = added.ok === true ? added.data.awards[0].id : '';
    expect(await removeCoachAward(c, 'a-club-1', id)).toMatchObject({ ok: true, data: { awards: [] } });
  });

  it('removing an award through another own athlete is 404', async () => {
    const c = coachCtx('tm-andreea');
    await addCoachAward(c, 'a-club-1', { kind: 'test' });
    const id = c.parcursFake.state.awards[0].id;
    expect(await removeCoachAward(c, 'a-club-2', id)).toMatchObject({ ok: false, status: 404 });
    expect(c.parcursFake.state.awards).toHaveLength(1);
  });
});
