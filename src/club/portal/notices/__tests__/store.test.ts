import { describe, expect, it } from 'vitest';
import type { NewNotice } from '../store';
import { fakeNoticeStore, removeAccount } from './fake-store';
import { purgePortal } from '../../purge';
import { fakePortalStore } from '../../__tests__/fake-portal-store';

const auto = (accountId: string | null, over: Partial<NewNotice> = {}): NewNotice => ({
  kind: 'auto', accountId, announcementId: null, key: 'k', title: '1 ședință anulată', rows: [], athleteIds: ['a1'], groupIds: [], lastDate: '2026-11-20', ...over,
});
const T1 = '2026-11-14T10:00:00.000Z';
const T2 = '2026-11-14T11:00:00.000Z';

describe('notice store (fake)', () => {
  it('deliver twice to the same account creates one delivery', async () => {
    const { store } = fakeNoticeStore();
    const id = await store.createNotice(auto('acc1'), T1);
    expect(await store.deliver(id, ['acc1', 'acc2', 'acc2'], T1)).toBe(2);
    expect(await store.deliver(id, ['acc1', 'acc3'], T2)).toBe(1);
    expect(await store.deliveries({ noticeId: id })).toHaveLength(3);
  });
  it('open deliveries leave out dismissed ones', async () => {
    const { store } = fakeNoticeStore();
    const id = await store.createNotice(auto('acc1'), T1);
    await store.deliver(id, ['acc1'], T1);
    const [d] = await store.deliveries({ accountId: 'acc1', open: true });
    await store.dismiss(d.id, T2);
    expect(await store.deliveries({ accountId: 'acc1', open: true })).toEqual([]);
    expect(await store.deliveries({ accountId: 'acc1' })).toHaveLength(1);
  });
  it('markSeen keeps the first seenAt', async () => {
    const { store } = fakeNoticeStore();
    const id = await store.createNotice(auto('acc1'), T1);
    await store.deliver(id, ['acc1'], T1);
    const [d] = await store.deliveries({ noticeId: id });
    await store.markSeen([d.id], T1);
    await store.markSeen([d.id], T2);
    expect((await store.deliveries({ noticeId: id }))[0]).toMatchObject({ seenAt: T1, dismissedAt: null });
  });
  it('liveAutoNotice ignores ended notices', async () => {
    const { store } = fakeNoticeStore();
    const id = await store.createNotice(auto('acc1'), T1);
    expect((await store.liveAutoNotice('acc1'))?.id).toBe(id);
    await store.endNotice(id, T2);
    expect(await store.liveAutoNotice('acc1')).toBeNull();
    expect((await store.notice(id))?.endedAt).toBe(T2);
  });
  it('notices come newest first, since keeps the recent ones, an announcement notice is found by its announcement', async () => {
    const { store } = fakeNoticeStore();
    const a = await store.createNotice(auto('acc1'), T1);
    const b = await store.createNotice(auto(null, { kind: 'anunt', announcementId: 'ann1' }), T2);
    expect((await store.notices({})).map((n) => n.id)).toEqual([b, a]);
    expect((await store.notices({ since: T2 })).map((n) => n.id)).toEqual([b]);
    expect((await store.noticeOfAnnouncement('ann1'))?.id).toBe(b);
    await store.stopNotice(b, T2);
    expect((await store.notice(b))?.stoppedAt).toBe(T2);
  });
});

describe('purge of a deleted account', () => {
  it('its deliveries and auto notices go, other accounts and announcement notices stay', async () => {
    const f = fakeNoticeStore();
    const gone = await f.store.createNotice(auto('acc1'), T1);
    const kept = await f.store.createNotice(auto('acc2'), T1);
    const anunt = await f.store.createNotice(auto(null, { kind: 'anunt', announcementId: 'ann1' }), T1);
    await f.store.deliver(gone, ['acc1'], T1);
    await f.store.deliver(kept, ['acc2'], T1);
    await f.store.deliver(anunt, ['acc1', 'acc2'], T1);
    removeAccount(f.state, 'acc1');
    const n = await purgePortal(fakePortalStore().store, new Date(T2), undefined, {}, f.store);
    expect(n).toMatchObject({ notices: 1, noticeDeliveries: 2 });
    expect(f.state.notices.map((x) => x.id).sort()).toEqual([kept, anunt].sort());
    expect(f.state.deliveries.map((d) => d.accountId).sort()).toEqual(['acc2', 'acc2']);
  });
});
