import { describe, expect, it } from 'vitest';
import { A_ANA, A_IOANA, A_MATEI, sportivCtx, type SportivSeed } from '../../portal/sportiv/__tests__/sportiv-seed';
import { giveAward } from '../awards';
import { givePin } from '../grants';
import { readParcurs, readParcursStaff, type ParcursStaffDeps } from '../read';

const TODAY = '2026-11-20';
const depsOf = (c: SportivSeed, admins: Record<string, string> = {}): ParcursStaffDeps => ({
  store: c.parcurs, club: c.club.store, presence: c.presence.store, results: async () => null, adminNames: async () => admins,
});
const give = (c: SportivSeed, from: string, to: string, design = 2, today = TODAY) =>
  givePin(c.parcurs, { giverId: from, recipientId: to, design, today, activeIds: new Set([A_ANA, A_MATEI, A_IOANA]) });

describe('readParcurs', () => {
  it('ensures this month grant: two pins left, idempotent across reads', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    expect((await readParcurs(depsOf(c), A_ANA, TODAY)).pinsLeft).toBe(2);
    expect((await readParcurs(depsOf(c), A_ANA, TODAY)).pinsLeft).toBe(2);
    expect(c.parcursFake.state.grants).toHaveLength(1);
  });

  it('lists the insigne in the agreed order', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    const out = await readParcurs(depsOf(c), A_ANA, TODAY);
    expect(out.insigne.map((p) => p.pin)).toEqual(['locul-1', 'podium', 'prezenta', 'steaua', 'test', 'manusi']);
    expect(out.sarituri).toHaveLength(3);
  });

  it('manusi is earned on the first pin the athlete gave; a pin given uses one of the pins left', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    await readParcurs(depsOf(c), A_ANA, TODAY);
    await give(c, A_ANA, A_IOANA, 2, '2026-11-12');
    const out = await readParcurs(depsOf(c), A_ANA, TODAY);
    expect(out.insigne.find((p) => p.pin === 'manusi')).toMatchObject({ earnedOn: '2026-11-12' });
    expect(out.pinsLeft).toBe(1);
  });

  it('shows a received pin with the short giver name and its fixed message, "Fost sportiv" once the giver is anonymised', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    await readParcurs(depsOf(c), A_ANA, TODAY);
    await give(c, A_ANA, A_IOANA, 3);
    expect((await readParcurs(depsOf(c), A_IOANA, TODAY)).received).toMatchObject([{ design: 3, message: 'Te susțin!', from: 'Ana I.', givenOn: TODAY }]);
    c.clubFake.state.athletes.find((a) => a.id === A_ANA)!.status = 'anonimizat';
    expect((await readParcurs(depsOf(c), A_IOANA, TODAY)).received[0].from).toBe('Fost sportiv');
  });
});

describe('readParcursStaff', () => {
  it('names givers in full, lists awards with who gave them and the pins the athlete gave with the recipient', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    const [member] = await c.presence.store.teamMembers();
    await giveAward(c.parcurs, { athleteId: A_ANA, kind: 'steaua', by: { teamMemberId: member.id }, today: TODAY });
    await giveAward(c.parcurs, { athleteId: A_ANA, kind: 'jump', jump: 'lz', level: 2, by: { adminId: '7' }, today: TODAY });
    await readParcurs(depsOf(c), A_ANA, TODAY);
    await give(c, A_ANA, A_IOANA);
    await readParcurs(depsOf(c), A_IOANA, TODAY);
    await give(c, A_IOANA, A_ANA);
    const out = await readParcursStaff(depsOf(c, { 7: 'Mara Admin' }), A_ANA, TODAY);
    expect(out.awards.map(({ pin, givenBy }) => ({ pin, givenBy }))).toEqual([{ pin: 'steaua', givenBy: member.name }, { pin: 'saritura-2lz', givenBy: 'Mara Admin' }]);
    expect(out.received[0].from).toBe('Ioana Marin');
    expect(out.given).toMatchObject([{ to: 'Ioana Marin', from: 'Ana Ionescu' }]);
  });
});
