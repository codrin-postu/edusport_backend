import { describe, expect, it } from 'vitest';
import type { AccountRow } from '../../types';
import type { PortalAnnouncement } from '../../notices/sync';
import { dismissNotice, readNotices } from '../notices';
import { HOLDERS, sportivCtx, type SportivSeed } from './sportiv-seed';

const PARENT = 'parinte1@example.invalid';
const ADULT = 'sportiv18@example.invalid';
const PARENT_ACC = `acc-${PARENT}`;
const ADULT_ACC = `acc-${ADULT}`;
const NOT_FOUND = { ok: false, status: 404, error: 'Nu a fost găsit.' };

const account = (id: string, email: string): AccountRow => ({
  id, userId: 1, email, status: 'active', teamMemberId: null, phone: null, googleSub: null, googleUnlinkedAt: null, invitedAt: null, invitedBy: null, activatedAt: null,
  disabledAt: null, disabledBy: null, lastLoginAt: null, name: null, coachDisabledAt: null, passwordChangedAt: null, notifySchedule: true,
});
const announcement = (over: Partial<PortalAnnouncement> = {}): PortalAnnouncement => ({
  id: 'an1', title: 'Program de sărbători', message: 'Sala e închisă pe 25.', startAt: '2026-11-19T00:00:00.000Z', endAt: '2026-11-30T00:00:00.000Z', isActive: true, showOnPortal: true,
  portalGroupIds: null, ...over,
});

const asAccount = (seed: SportivSeed, email: string): SportivSeed => ({ ...seed, holder: { ...seed.holder, accountId: `acc-${email}`, athleteIds: HOLDERS[email] } });

/** The parent (holds Ana) with one break tomorrow, so an automatic notice exists next to a hand-written one. */
function setup() {
  const base: SportivSeed = sportivCtx(PARENT);
  const seed = asAccount(base, PARENT);
  base.portalFake.state.accounts.push(account(PARENT_ACC, PARENT), account(ADULT_ACC, ADULT));
  base.fake.state.calendar.blackouts.push({ label: 'Zi liberă', startDate: '2026-11-21', endDate: '2026-11-21' });
  base.announcements.push(announcement());
  return seed;
}

describe('readNotices', () => {
  it('lists the account notices newest first, count equals the list length, rows and body by kind', async () => {
    const seed = setup();
    const out = await readNotices(seed);
    expect(out.count).toBe(2);
    expect(out.notices.map((n) => n.title)).toEqual(['1 ședință anulată', 'Program de sărbători']);
    const [auto, hand] = out.notices;
    expect(auto).toMatchObject({ date: '2026-11-20', body: null, rows: [{ date: '2026-11-21', reason: 'Zi liberă' }] });
    expect(hand).toEqual({ id: expect.any(String), date: '2026-11-19', title: 'Program de sărbători', body: 'Sala e închisă pe 25.', rows: [] });
    expect(JSON.stringify(out)).not.toContain(PARENT);
  });

  it('never lists another account automatic notice (the other holder sees only the all-groups announcement)', async () => {
    const seed = setup();
    await readNotices(seed);
    const adult = await readNotices(asAccount(seed, ADULT));
    expect(adult.notices.map((n) => n.title)).toEqual(['Program de sărbători']);
    expect(seed.noticeFake.state.deliveries.filter((d) => d.accountId === ADULT_ACC)).toHaveLength(1);
  });

  it('a hand-written notice whose announcement was edited to Site only disappears', async () => {
    const seed = setup();
    expect((await readNotices(seed)).count).toBe(2);
    seed.announcements[0].showOnPortal = false;
    const out = await readNotices(seed);
    expect(out.notices.map((n) => n.title)).toEqual(['1 ședință anulată']);
    expect(out.count).toBe(1);
  });

  it('seen is recorded only with markSeen, once per delivery, first time kept', async () => {
    const seed = setup();
    await readNotices(seed);
    expect(seed.noticeFake.state.deliveries.every((d) => d.seenAt === null)).toBe(true);
    await readNotices(seed, true);
    const first = seed.noticeFake.state.deliveries.map((d) => d.seenAt);
    expect(first.every((s) => s !== null)).toBe(true);
    seed.presence.now();
    await readNotices({ ...seed, presence: { ...seed.presence, now: () => new Date('2026-11-21T10:00:00.000Z') } }, true);
    expect(seed.noticeFake.state.deliveries.map((d) => d.seenAt)).toEqual(first);
  });
});

describe('expiry', () => {
  it('an ended or past-dated notice is not listed and not counted', async () => {
    const seed = setup();
    expect((await readNotices(seed)).count).toBe(2);
    const auto = seed.noticeFake.state.notices.find((n) => n.kind === 'auto')!;
    auto.lastDate = '2026-11-19';
    expect((await readNotices(seed)).notices.map((n) => n.title)).toEqual(['Program de sărbători']);
    seed.announcements[0].endAt = '2026-11-19T00:00:00.000Z';
    expect(await readNotices(seed)).toEqual({ count: 0, notices: [] });
  });
});

describe('dismissNotice', () => {
  it('returns the new count and the notice never comes back, also in a second session of the same account', async () => {
    const seed = setup();
    const [first] = (await readNotices(seed)).notices;
    expect(await dismissNotice(seed, first.id)).toEqual({ ok: true, data: { count: 1 } });
    const again = await readNotices({ ...seed });
    expect(again.notices.map((n) => n.id)).not.toContain(first.id);
    expect(again.count).toBe(1);
    expect(await dismissNotice(seed, first.id)).toMatchObject(NOT_FOUND);
  });

  it('answers 404 and changes nothing for an id of another account, an unknown id or a non-string', async () => {
    const seed = setup();
    await readNotices(seed);
    const adultSeed = asAccount(seed, ADULT);
    const [first] = (await readNotices(seed)).notices;
    const before = structuredClone(seed.noticeFake.state.deliveries);
    const auto = (await readNotices(seed)).notices.find((n) => n.body === null)!;
    for (const id of [auto.id, first.id, 'nope', 42, null, undefined, '']) {
      expect(await dismissNotice(adultSeed, id), String(id)).toMatchObject(NOT_FOUND);
    }
    for (const id of ['nope', 42, null, undefined, '']) expect(await dismissNotice(seed, id), String(id)).toMatchObject(NOT_FOUND);
    expect(seed.noticeFake.state.deliveries).toEqual(before);
  });
});
