import { describe, expect, it } from 'vitest';
import { sportivCtx, type SportivSeed } from '../../sportiv/__tests__/sportiv-seed';
import type { AccountRow } from '../../types';
import { fakeNoticeStore } from './fake-store';
import { syncNotices, type NoticeSyncContext, type PortalAnnouncement } from '../sync';

const PARENT = 'parinte1@example.invalid';
const ADULT = 'sportiv18@example.invalid';
const PARENT_ACC = `acc-${PARENT}`;
const ADULT_ACC = `acc-${ADULT}`;
const TODAY = '2026-11-20';
const NOW = new Date('2026-11-20T09:00:00.000Z');

const account = (id: string, email: string, over: Partial<AccountRow> = {}): AccountRow => ({
  id, userId: 1, email, status: 'active', teamMemberId: null, phone: null, googleSub: null, googleUnlinkedAt: null, invitedAt: null, invitedBy: null, activatedAt: null,
  disabledAt: null, disabledBy: null, lastLoginAt: null, name: null, coachDisabledAt: null, passwordChangedAt: null, notifySchedule: true, ...over,
});

function setup() {
  const seed: SportivSeed = sportivCtx(PARENT, TODAY);
  seed.portalFake.state.accounts.push(account(PARENT_ACC, PARENT), account(ADULT_ACC, ADULT));
  const { store, state } = fakeNoticeStore();
  const logs: string[] = [];
  const announcements: PortalAnnouncement[] = [];
  const c: NoticeSyncContext = {
    notices: { ...store, transaction: seed.portal.transaction }, portal: seed.portal, access: seed.access, sportiv: (holder) => ({ ...seed, holder }), announcements: async () => structuredClone(announcements),
    now: () => NOW, today: TODAY, log: (m) => logs.push(m),
  };
  return { seed, c, state, logs, announcements };
}

const announcement = (over: Partial<PortalAnnouncement> = {}): PortalAnnouncement => ({
  id: 'an1', title: 'Program de sărbători', message: 'Detalii.', startAt: '2026-11-19T00:00:00.000Z', endAt: '2026-11-30T00:00:00.000Z', isActive: true, showOnPortal: true, portalGroupIds: null, ...over,
});
const deliveriesOf = (state: ReturnType<typeof setup>['state'], accountId: string) => state.deliveries.filter((d) => d.accountId === accountId);
const breakOn = (seed: SportivSeed, label: string, date: string): void => { seed.fake.state.calendar.blackouts.push({ label, startDate: date, endDate: date }); };

describe('automatic notices', () => {
  it('creates one notice and one delivery for the holder with cancellations, and nothing the second time', async () => {
    const { seed, c, state } = setup();
    breakOn(seed, 'Vacanța de iarnă', '2026-11-21');
    expect(await syncNotices(c, {})).toEqual({ created: 1, delivered: 1, ended: 0 });
    expect(state.notices).toHaveLength(1);
    expect(state.notices[0]).toMatchObject({ kind: 'auto', accountId: PARENT_ACC, title: '1 ședință anulată', lastDate: '2026-11-21' });
    expect(state.notices[0].rows).toEqual([{ date: '2026-11-21', text: '11:00 Intermediari Bronze, Ana', reason: 'Vacanța de iarnă' }]);
    expect(deliveriesOf(state, ADULT_ACC)).toEqual([]);
    expect(await syncNotices(c, {})).toEqual({ created: 0, delivered: 0, ended: 0 });
    expect(state.notices).toHaveLength(1);
  });

  it('a new cancellation ends the old notice and creates one new one', async () => {
    const { seed, c, state } = setup();
    breakOn(seed, 'Vacanța de iarnă', '2026-11-21');
    await syncNotices(c, {});
    breakOn(seed, 'Zi liberă', '2026-11-22');
    expect(await syncNotices(c, {})).toEqual({ created: 1, delivered: 1, ended: 1 });
    expect(state.notices.map((n) => [n.title, n.endedAt !== null])).toEqual([['1 ședință anulată', true], ['2 ședințe anulate', false]]);
  });

  it('a cancellation that was undone ends the notice', async () => {
    const { seed, c, state } = setup();
    breakOn(seed, 'Vacanța de iarnă', '2026-11-21');
    await syncNotices(c, {});
    seed.fake.state.calendar.blackouts = [];
    expect(await syncNotices(c, {})).toEqual({ created: 0, delivered: 0, ended: 1 });
    expect(state.notices[0].endedAt).not.toBeNull();
  });

  it('a row that only went past keeps the same message, a dismissed one is not sent again', async () => {
    const { seed, c, state } = setup();
    breakOn(seed, 'Vacanța de iarnă', '2026-11-20');
    breakOn(seed, 'Zi liberă', '2026-11-22');
    await syncNotices(c, {});
    await c.notices.dismiss(state.deliveries[0].id, NOW.toISOString());
    const tomorrow: NoticeSyncContext = { ...c, today: '2026-11-21', now: () => new Date('2026-11-21T09:00:00.000Z') };
    expect(await syncNotices(tomorrow, {})).toEqual({ created: 0, delivered: 0, ended: 0 });
    expect(state.notices).toHaveLength(1);
    expect(await c.notices.deliveries({ accountId: PARENT_ACC, open: true })).toEqual([]);
  });

  it('ends the notice when every row is past', async () => {
    const { seed, c, state } = setup();
    breakOn(seed, 'Vacanța de iarnă', '2026-11-21');
    await syncNotices(c, {});
    seed.fake.state.calendar.blackouts = [];
    await syncNotices({ ...c, today: '2026-11-23' }, {});
    expect(state.notices[0].endedAt).not.toBeNull();
  });

  it('names no child when the account holds one athlete', async () => {
    const { seed, c, state } = setup();
    seed.fake.state.calendar.blackouts.push({ label: 'Pauză', startDate: '2026-11-24', endDate: '2026-11-24' });
    await syncNotices(c, {});
    expect(state.notices.find((n) => n.accountId === ADULT_ACC)?.rows[0].text).toBe('17:00 Club Performanță');
  });

  it('scope.accountId touches only that account', async () => {
    const { seed, c, state } = setup();
    breakOn(seed, 'Vacanța de iarnă', '2026-11-24');
    breakOn(seed, 'Vacanța de iarnă', '2026-11-21');
    await syncNotices(c, { accountId: ADULT_ACC });
    expect(state.notices.map((n) => n.accountId)).toEqual([ADULT_ACC]);
  });

  it('skips accounts that are disabled or team members and logs a failing one by code only', async () => {
    const { seed, c, state, logs } = setup();
    breakOn(seed, 'Vacanța de iarnă', '2026-11-21');
    seed.portalFake.state.accounts.find((a) => a.id === PARENT_ACC)!.status = 'disabled';
    await syncNotices(c, {});
    expect(state.notices.filter((n) => n.accountId === PARENT_ACC)).toEqual([]);
    seed.portalFake.state.accounts.find((a) => a.id === PARENT_ACC)!.status = 'active';
    const broken: NoticeSyncContext = { ...c, notices: { ...c.notices, liveAutoNotice: async () => { throw Object.assign(new Error('Ana secret'), { code: '40001' }); } } };
    await syncNotices(broken, {});
    expect(logs.every((l) => !l.includes('Ana') && !l.includes('secret'))).toBe(true);
    expect(logs.some((l) => l.includes('40001'))).toBe(true);
  });
});

describe('stable notices', () => {
  it('a moved row whose planned date has passed stays one notice across syncs and stays dismissed', async () => {
    const { seed, c, state } = setup();
    seed.fake.state.calendar.events[0].exceptions = [{ date: '2026-11-21', kind: 'override', newDate: '2026-11-23', newStartTime: '17:00', newEndTime: '17:50' }];
    expect(await syncNotices(c, {})).toMatchObject({ created: 1, delivered: 1 });
    await c.notices.dismiss(state.deliveries[0].id, NOW.toISOString());
    const later: NoticeSyncContext = { ...c, today: '2026-11-22', now: () => new Date('2026-11-22T09:00:00.000Z') };
    for (let i = 0; i < 3; i++) expect(await syncNotices(later, {})).toEqual({ created: 0, delivered: 0, ended: 0 });
    expect(state.notices).toHaveLength(1);
    expect(await c.notices.deliveries({ accountId: PARENT_ACC, open: true })).toEqual([]);
  });

  it('an account that lost every access has its live auto notice ended', async () => {
    const { seed, c, state } = setup();
    breakOn(seed, 'Vacanța de iarnă', '2026-11-21');
    await syncNotices(c, {});
    for (const r of seed.accessFake.state.rows.filter((x) => x.accountId === PARENT_ACC)) r.revokedAt = NOW.toISOString();
    expect(await syncNotices(c, {})).toMatchObject({ ended: 1 });
    expect(state.notices[0].endedAt).not.toBeNull();
  });
});

describe('hand-written notices', () => {
  it.each([
    ['deleted', (a: PortalAnnouncement[]) => { a.length = 0; }],
    ['unticked for the portal', (a: PortalAnnouncement[]) => { a.length = 0; }],
    ['no longer running', (a: PortalAnnouncement[]) => { a[0].endAt = '2026-11-19T00:00:00.000Z'; }],
  ])('an announcement %s ends its notice', async (_name, change) => {
    const { c, state, announcements } = setup();
    announcements.push(announcement());
    await syncNotices(c, {});
    change(announcements);
    expect(await syncNotices(c, {})).toMatchObject({ ended: 1 });
    expect(state.notices[0].endedAt).not.toBeNull();
  });

  it('a stopped announcement ends its notice', async () => {
    const { c, state, announcements } = setup();
    announcements.push(announcement());
    await syncNotices(c, {});
    await c.notices.stopNotice(state.notices[0].id, NOW.toISOString());
    expect(await syncNotices(c, {})).toMatchObject({ ended: 1 });
    expect(state.notices[0].endedAt).not.toBeNull();
  });

  it('a group announcement reaches the account with an athlete in the group, "Toate grupele" reaches both', async () => {
    const { c, state, announcements } = setup();
    announcements.push(announcement({ portalGroupIds: ['g-ib'] }));
    expect(await syncNotices(c, {})).toMatchObject({ created: 1, delivered: 1 });
    expect(deliveriesOf(state, PARENT_ACC)).toHaveLength(1);
    expect(deliveriesOf(state, ADULT_ACC)).toEqual([]);
    expect(state.notices[0]).toMatchObject({ kind: 'anunt', announcementId: 'an1', accountId: null, groupIds: ['g-ib'] });
    announcements[0] = announcement({ id: 'an2', portalGroupIds: null });
    await syncNotices(c, {});
    expect(deliveriesOf(state, PARENT_ACC)).toHaveLength(2);
    expect(deliveriesOf(state, ADULT_ACC)).toHaveLength(1);
  });

  it('a scheduled, inactive, stopped or site-only announcement reaches nobody', async () => {
    const { c, state, announcements } = setup();
    announcements.push(
      announcement({ id: 'a-sched', startAt: '2026-11-25T00:00:00.000Z' }), announcement({ id: 'a-off', isActive: false }),
      announcement({ id: 'a-site', showOnPortal: false }), announcement({ id: 'a-over', endAt: '2026-11-19T00:00:00.000Z' }),
    );
    await syncNotices(c, {});
    expect(state.deliveries).toEqual([]);
    expect(state.notices).toEqual([]);
    announcements.length = 0;
    announcements.push(announcement({ id: 'a-stop' }));
    await syncNotices(c, {});
    expect(state.deliveries).toHaveLength(2);
    const id = state.notices[0].id;
    await c.notices.stopNotice(id, NOW.toISOString());
    state.deliveries.length = 0;
    await syncNotices(c, {});
    expect(state.deliveries).toEqual([]);
  });

  it('an announcement that stops running ends its notice', async () => {
    const { c, state, announcements } = setup();
    announcements.push(announcement());
    await syncNotices(c, {});
    announcements[0].isActive = false;
    expect(await syncNotices(c, {})).toMatchObject({ ended: 1 });
    expect(state.notices[0].endedAt).not.toBeNull();
  });

  it('an account that gains an athlete in the group is topped up on the next run, once', async () => {
    const { seed, c, state, announcements } = setup();
    announcements.push(announcement({ portalGroupIds: ['g-ib'] }));
    await syncNotices(c, {});
    expect(deliveriesOf(state, ADULT_ACC)).toEqual([]);
    seed.fake.group.memberships.push({ id: 'gm-ioana-ib', athleteId: 'a-ioana', groupId: 'g-ib', seasonId: 's26', isMain: false, from: '2026-11-01', to: null });
    await syncNotices(c, {});
    await syncNotices(c, {});
    expect(deliveriesOf(state, ADULT_ACC)).toHaveLength(1);
    expect(state.notices.filter((n) => n.kind === 'anunt')).toHaveLength(1);
  });

  it('two syncs at the same time do not double-deliver', async () => {
    const { seed, c, state, announcements } = setup();
    announcements.push(announcement());
    breakOn(seed, 'Vacanța de iarnă', '2026-11-21');
    await Promise.all([syncNotices(c, {}), syncNotices(c, {})]);
    expect(state.deliveries.map((d) => `${d.noticeId}|${d.accountId}`)).toEqual([...new Set(state.deliveries.map((d) => `${d.noticeId}|${d.accountId}`))]);
  });
});
