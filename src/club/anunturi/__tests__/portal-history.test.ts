import { beforeEach, describe, expect, it } from 'vitest';
import { syncNotices, type PortalAnnouncement } from '../../portal/notices/sync';
import type { DeliveryRecord, NoticeRecord } from '../../portal/notices/store';
import type { AccountRow } from '../../portal/types';
import { readNotices, resetNoticeSyncThrottle } from '../../portal/sportiv/notices';
import { HOLDERS, sportivCtx, type SportivSeed } from '../../portal/sportiv/__tests__/sportiv-seed';
import {
  ANUNT_LIST_COPY, announcementRow, autoGroupRow, causeKey, filterRows, listRows, orderRows, placeStates, portalSummary, readCauseRecipients, readRecipients, resultLines, stopNotice,
  type AnnouncementForList, type ListRow,
} from '../portal-history';

const NOW = Date.parse('2026-11-20T09:00:00.000Z');
const PARENT = 'parinte1@example.invalid';
const ADULT = 'sportiv18@example.invalid';

const ann = (over: Partial<AnnouncementForList> = {}): AnnouncementForList => ({
  id: 'an1', title: 'Program de sărbători', showOnSite: true, showOnPortal: true, isActive: true, startAt: '2026-11-19T00:00:00.000Z', endAt: '2026-11-30T00:00:00.000Z',
  portalGroupIds: null, portalAuthor: 'Ioana Pop', siteViews: null, ...over,
});
const notice = (over: Partial<NoticeRecord> = {}): NoticeRecord => ({
  id: 'n1', kind: 'anunt', accountId: null, announcementId: 'an1', key: null, title: 'Program de sărbători', rows: [], athleteIds: [], groupIds: [], lastDate: null,
  createdAt: '2026-11-19T00:00:00.000Z', endedAt: null, stoppedAt: null, ...over,
});
const autoNotice = (over: Partial<NoticeRecord> = {}): NoticeRecord => notice({
  id: 'a1', kind: 'auto', accountId: 'acc1', announcementId: null, title: '2 ședințe anulate', athleteIds: ['x'],
  rows: [{ date: '2026-11-21', text: '11:00 Grupa', reason: 'Vacanța de toamnă' }, { date: '2026-11-22', text: '11:00 Grupa', reason: 'Vacanța de toamnă' }], ...over,
});
const delivery = (over: Partial<DeliveryRecord> = {}): DeliveryRecord => ({ id: 'd1', noticeId: 'n1', accountId: 'acc1', deliveredAt: '2026-11-19T10:00:00.000Z', seenAt: null, dismissedAt: null, ...over });

describe('placeStates', () => {
  it('is active on both places inside the window', () => {
    expect(placeStates(ann(), notice(), NOW)).toEqual({ site: 'active', portal: 'active' });
  });
  it('is waiting before startAt and ended after endAt', () => {
    expect(placeStates(ann({ startAt: '2026-11-25T00:00:00.000Z' }), null, NOW)).toEqual({ site: 'waiting', portal: 'waiting' });
    expect(placeStates(ann({ endAt: '2026-11-19T23:00:00.000Z' }), null, NOW)).toEqual({ site: 'ended', portal: 'ended' });
  });
  it('ends the portal alone when the notice is stopped, the site stays active', () => {
    expect(placeStates(ann(), notice({ stoppedAt: '2026-11-20T08:00:00.000Z' }), NOW)).toEqual({ site: 'active', portal: 'ended' });
  });
  it('has no portal for a site-only announcement and reads a null showOnSite as ticked', () => {
    expect(placeStates(ann({ showOnPortal: false }), null, NOW)).toEqual({ site: 'active', portal: null });
    expect(placeStates(ann({ showOnSite: null, showOnPortal: false }), null, NOW).site).toBe('active');
    expect(placeStates(ann({ showOnSite: false }), null, NOW).site).toBeNull();
  });
  it('counts a switched-off announcement as ended', () => {
    expect(placeStates(ann({ isActive: false }), null, NOW)).toEqual({ site: 'ended', portal: 'ended' });
  });
});

describe('rows', () => {
  it('states: stopped by hand is Oprit, an end date is Incheiat, a place still active keeps the row Activ', () => {
    expect(announcementRow(ann({ showOnSite: false }), notice({ stoppedAt: '2026-11-20T08:00:00.000Z' }), [], NOW).state).toBe('stopped');
    expect(announcementRow(ann({ endAt: '2026-11-19T23:00:00.000Z' }), null, [], NOW).state).toBe('ended');
    expect(announcementRow(ann(), notice({ stoppedAt: '2026-11-20T08:00:00.000Z' }), [], NOW).state).toBe('active');
    expect(announcementRow(ann({ startAt: '2026-11-25T00:00:00.000Z' }), null, [], NOW).state).toBe('waiting');
  });

  it('writes the author, the audience and the period', () => {
    const r = announcementRow(ann({ portalGroupIds: ['a', 'b', 'c'] }), notice(), [], NOW);
    expect(r).toMatchObject({ source: 'anunt', kind: 'Scris de Ioana Pop', audience: '3 grupe', period: '19-30 noi' });
    expect(announcementRow(ann({ portalGroupIds: null }), notice(), [], NOW).audience).toBe('Toate grupele');
    expect(announcementRow(ann({ showOnPortal: false, portalAuthor: null }), null, [], NOW)).toMatchObject({ audience: '-', kind: '-' });
  });

  it('shows views only: site views and portal accounts that saw it, nothing when none yet', () => {
    expect(resultLines(null, null)).toEqual([]);
    expect(resultLines(0, 0)).toEqual([]);
    expect(resultLines(120, 3)).toEqual(['120 de vizualizări site public', '3 vizualizări portal']);
    expect(resultLines(1, null)).toEqual(['1 vizualizare site public']);
    const seen = [delivery({ seenAt: '2026-11-19T11:00:00.000Z' }), delivery({ id: 'd2', accountId: 'acc2' })];
    expect(announcementRow(ann({ siteViews: 40 }), notice(), seen, NOW).results).toEqual(['40 de vizualizări site public', '1 vizualizare portal']);
    expect(announcementRow(ann({ showOnPortal: false, siteViews: null }), null, [], NOW).results).toEqual([]);
  });

  it('puts automatic notices in the list as Automat with the portal icon only, newest first, with a muted line of reason and dates', () => {
    const rows = listRows({
      announcements: [ann()],
      notices: [notice(), autoNotice({ id: 'a1', createdAt: '2026-11-18T00:00:00.000Z' }), autoNotice({ id: 'a2', createdAt: '2026-11-19T00:00:00.000Z', rows: [{ date: '2026-11-25', text: '11:00 Grupa', reason: 'Zi liberă' }] })],
      deliveries: new Map(), now: NOW,
    });
    expect(rows.map((r) => r.subline)).toEqual([null, 'Zi liberă, 25 noi', 'Vacanța de toamnă, 21-22 noi']);
    expect(rows[2]).toMatchObject({ source: 'auto', kind: 'Automat', site: null, portal: 'active', subline: 'Vacanța de toamnă, 21-22 noi', audience: '1 sportiv', reorderable: false });
  });

  it('makes one row per cause: sessions two accounts share count once, athletes and viewing accounts are counted across the group', () => {
    const shared = { date: '2026-11-21', text: '11:00 Grupa', reason: 'Vacanța de toamnă' };
    const a = autoNotice({ id: 'a1', accountId: 'acc1', athleteIds: ['x'], rows: [shared, { date: '2026-11-22', text: '11:00 Grupa', reason: 'Vacanța de toamnă' }] });
    const b = autoNotice({ id: 'a2', accountId: 'acc2', athleteIds: ['y', 'z'], rows: [shared, { date: '2026-11-23', text: '17:00 Alta', reason: 'Vacanța de toamnă' }] });
    const other = autoNotice({ id: 'a3', accountId: 'acc3', rows: [{ date: '2026-11-24', text: '18:00 Grupa', reason: 'Zi liberă' }] });
    const rows = listRows({ announcements: [], notices: [a, b, other], deliveries: new Map(), now: NOW });
    expect(rows).toHaveLength(2);
    const group = rows.find((r) => r.subline?.startsWith('Vacanța'));
    expect(group).toMatchObject({ title: '3 ședințe anulate', audience: '3 sportivi', subline: 'Vacanța de toamnă, 21-23 noi' });
    expect(causeKey(a.rows)).toBe(causeKey(b.rows));
    expect(causeKey(a.rows)).not.toBe(causeKey(other.rows));
    const seen = [delivery({ id: 'd1', noticeId: 'a1', accountId: 'acc1', seenAt: '2026-11-21T10:00:00.000Z' }), delivery({ id: 'd2', noticeId: 'a2', accountId: 'acc1', seenAt: '2026-11-22T10:00:00.000Z' })];
    expect(autoGroupRow([a, b], seen).results).toEqual(['1 vizualizare portal']);
  });

  it('groups every moved session into one cause and uses the moved title', () => {
    const m = (id: string, to: string) => autoNotice({ id, rows: [{ date: '2026-11-21', text: '11:00 Grupa', reason: `Mutată: ${to}` }] });
    const rows = listRows({ announcements: [], notices: [m('m1', 'Vin 20 noi, 18:00'), m('m2', 'Sâm 21 noi, 10:00')], deliveries: new Map(), now: NOW });
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('1 ședință anulată sau mutată');
  });

  it('orders active, then scheduled, then ended; site rows keep their order and come before the rest', () => {
    const row = (id: string, state: ListRow['state'], over: Partial<ListRow> = {}): ListRow => ({
      id, source: 'anunt', title: id, site: 'active', portal: null, kind: '-', audience: '-', state, period: '-', subline: null, results: [], reorderable: state === 'active', ...over,
    });
    const rows = [
      row('ended1', 'ended', { reorderable: false }), row('auto1', 'active', { source: 'auto', site: null, portal: 'active', reorderable: false }),
      row('portalOnly', 'active', { site: null, portal: 'active', reorderable: false }), row('site2', 'active'), row('waiting', 'waiting', { reorderable: false }),
      row('site1', 'active'), row('stopped', 'stopped', { reorderable: false }),
    ];
    expect(orderRows(rows).map((r) => r.id)).toEqual(['site2', 'site1', 'portalOnly', 'auto1', 'waiting', 'ended1', 'stopped']);
  });

  it('marks only an active site row as reorderable', () => {
    expect(announcementRow(ann(), notice(), [], NOW).reorderable).toBe(true);
    expect(announcementRow(ann({ startAt: '2026-11-25T00:00:00.000Z' }), null, [], NOW).reorderable).toBe(false);
    expect(announcementRow(ann({ showOnSite: false }), notice(), [], NOW).reorderable).toBe(false);
    expect(autoGroupRow([autoNotice()], []).reorderable).toBe(false);
  });

  it('summarises the portal counts of an announcement', () => {
    expect(portalSummary(null, [])).toBeNull();
    const seen = [delivery({ seenAt: '2026-11-19T11:00:00.000Z' }), delivery({ id: 'd2' })];
    expect(portalSummary(notice(), seen)).toEqual({ noticeId: 'n1', sent: 2, seen: 1, live: true });
    expect(portalSummary(notice({ stoppedAt: '2026-11-20T00:00:00.000Z' }), seen)?.live).toBe(false);
  });
});

describe('filterRows', () => {
  const site = announcementRow(ann({ showOnPortal: false }), null, [], NOW);
  const both = announcementRow(ann({ id: 'an2' }), notice({ id: 'n2', announcementId: 'an2' }), [], NOW);
  const portalOnly = announcementRow(ann({ id: 'an3', showOnSite: false }), notice({ id: 'n3', announcementId: 'an3' }), [], NOW);
  const auto = autoGroupRow([autoNotice()], []);
  const rows = [site, both, portalOnly, auto];
  it('keeps every row for Toate', () => expect(filterRows(rows, 'toate')).toEqual(rows));
  it('keeps the rows with a site place for Site', () => expect(filterRows(rows, 'site').map((r) => r.id)).toEqual(['an1', 'an2']));
  it('keeps the rows with a portal place for Portal, automatic ones included', () => expect(filterRows(rows, 'portal').map((r) => r.id)).toEqual(['an2', 'an3', auto.id]));
});

const account = (id: string, email: string): AccountRow => ({
  id, userId: 1, email, status: 'active', teamMemberId: null, phone: null, googleSub: null, googleUnlinkedAt: null, invitedAt: null, invitedBy: null, activatedAt: null,
  disabledAt: null, disabledBy: null, lastLoginAt: null, name: null, coachDisabledAt: null, passwordChangedAt: null, notifySchedule: true,
});
const announcement = (over: Partial<PortalAnnouncement> = {}): PortalAnnouncement => ({
  id: 'an1', title: 'Program de sărbători', message: 'Sala e închisă.', startAt: '2026-11-19T00:00:00.000Z', endAt: '2026-11-30T00:00:00.000Z', isActive: true, showOnPortal: true,
  portalGroupIds: null, ...over,
});
const asAccount = (seed: SportivSeed, email: string): SportivSeed => ({ ...seed, holder: { ...seed.holder, accountId: `acc-${email}`, athleteIds: HOLDERS[email] } });

async function setup() {
  const seed = sportivCtx(PARENT);
  seed.portalFake.state.accounts.push(account(`acc-${PARENT}`, PARENT), account(`acc-${ADULT}`, ADULT));
  seed.fake.state.calendar.blackouts.push({ label: 'Zi liberă', startDate: '2026-11-21', endDate: '2026-11-21' });
  seed.announcements.push(announcement());
  await syncNotices(seed.noticeSync(), {});
  const store = seed.noticeFake.store;
  const hand = seed.noticeFake.state.notices.find((n) => n.kind === 'anunt');
  const auto = seed.noticeFake.state.notices.find((n) => n.kind === 'auto');
  if (!hand || !auto) throw new Error('setup: notices missing');
  return { seed, store, hand, auto, ctx: { notices: store, portal: seed.portal, access: seed.access } };
}

beforeEach(resetNoticeSyncThrottle);

describe('readRecipients', () => {
  it('counts the accounts, the ones who saw it, and lists e-mail, athletes held now and the day seen', async () => {
    const { seed, hand, ctx } = await setup();
    await readNotices(asAccount(seed, PARENT), true);
    const out = await readRecipients(ctx, hand.id);
    if (!out.ok) throw new Error('expected ok');
    expect(out.data).toMatchObject({ title: 'Program de sărbători', sentTo: 'Trimis la 2 conturi', seenBy: 'Văzut de 1', stopped: false, canStop: true });
    const parent = out.data.accounts.find((a) => a.email === PARENT);
    expect(parent).toMatchObject({ athletes: ['Ana Ionescu', 'Matei Ionescu'], seen: true, seenText: 'da, 20 noi' });
    expect(out.data.accounts.find((a) => a.email === ADULT)).toMatchObject({ athletes: ['Ioana Marin'], seen: false, seenText: 'nu' });
  });

  it('aggregates a cause across its notices: an account once, with its earliest seenAt', async () => {
    const { seed, auto, ctx, store } = await setup();
    await readNotices(asAccount(seed, PARENT), true);
    const twin = await store.createNotice({ ...auto, accountId: `acc-${ADULT}` }, '2026-11-20T09:00:00.000Z');
    await store.deliver(twin, [`acc-${ADULT}`, `acc-${PARENT}`], '2026-11-20T09:00:00.000Z');
    const second = seed.noticeFake.state.deliveries.find((d) => d.noticeId === twin && d.accountId === `acc-${PARENT}`);
    if (second) second.seenAt = '2026-11-19T08:00:00.000Z';
    const out = await readCauseRecipients(ctx, causeKey(auto.rows), NOW);
    if (!out.ok) throw new Error('expected ok');
    expect(out.data).toMatchObject({ title: '1 ședință anulată', sentTo: 'Trimis la 2 conturi', seenBy: 'Văzut de 1', canStop: false });
    expect(out.data.accounts.find((a) => a.email === PARENT)).toMatchObject({ seen: true, seenText: 'da, 19 noi' });
    expect(await readCauseRecipients(ctx, 'cause-nope', NOW)).toMatchObject({ ok: false, status: 404 });
  });

  it('words one account as "1 cont" and shows nothing about dismissals', async () => {
    const { seed, auto, ctx } = await setup();
    await readNotices(asAccount(seed, PARENT), true);
    const out = await readRecipients(ctx, auto.id);
    if (!out.ok) throw new Error('expected ok');
    expect(out.data).toMatchObject({ sentTo: 'Trimis la 1 cont', canStop: false, rows: [{ date: '2026-11-21' }] });
    expect(JSON.stringify(out.data)).not.toMatch(/dismiss|closed|Închis/i);
  });

  it('answers 404 for an unknown notice', async () => {
    const { ctx } = await setup();
    expect(await readRecipients(ctx, 'nope')).toEqual({ ok: false, status: 404, error: 'Nu a fost găsit.' });
  });

  it('words the count as 1 cont, 12 conturi, 20 de conturi', () => {
    expect([1, 12, 20].map((n) => ANUNT_LIST_COPY.sentTo(n))).toEqual(['Trimis la 1 cont', 'Trimis la 12 conturi', 'Trimis la 20 de conturi']);
  });
});

describe('stopNotice', () => {
  it('stops a hand-written notice: the portal read no longer shows it, the site still runs', async () => {
    const { seed, store, hand } = await setup();
    const parent = asAccount(seed, PARENT);
    expect((await readNotices(parent)).notices.map((n) => n.title)).toContain('Program de sărbători');
    expect(await stopNotice(store, hand.id, '2026-11-20T09:30:00.000Z')).toEqual({ ok: true, data: { stopped: true } });
    expect((await readNotices(parent)).notices.map((n) => n.title)).not.toContain('Program de sărbători');
    const stored = await store.notice(hand.id);
    expect(placeStates(ann(), stored, NOW)).toEqual({ site: 'active', portal: 'ended' });
  });

  it('refuses an automatic notice with 409 and changes nothing', async () => {
    const { store, auto } = await setup();
    const out = await stopNotice(store, auto.id, '2026-11-20T09:30:00.000Z');
    expect(out).toMatchObject({ ok: false, status: 409 });
    expect((await store.notice(auto.id))?.stoppedAt).toBeNull();
  });

  it('is a no-op the second time and keeps the first instant', async () => {
    const { store, hand } = await setup();
    await stopNotice(store, hand.id, '2026-11-20T09:30:00.000Z');
    expect(await stopNotice(store, hand.id, '2026-11-20T10:00:00.000Z')).toEqual({ ok: true, data: { stopped: true } });
    expect((await store.notice(hand.id))?.stoppedAt).toBe('2026-11-20T09:30:00.000Z');
  });

  it('answers 404 for an unknown id', async () => {
    const { store } = await setup();
    expect(await stopNotice(store, 'nope', '2026-11-20T09:30:00.000Z')).toMatchObject({ ok: false, status: 404 });
  });
});
