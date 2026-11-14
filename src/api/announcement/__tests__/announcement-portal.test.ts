import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeNoticeStore } from '../../../club/portal/notices/__tests__/fake-store';

const h = vi.hoisted(() => ({ store: null as unknown, sync: null as unknown }));
vi.mock('../../../club/portal/notices/strapi-store', () => ({ strapiNoticeStore: () => h.store }));
vi.mock('../../../club/portal/notices/strapi-sync', () => ({ syncNoticesAfterSave: (...a: unknown[]) => (h.sync as (...x: unknown[]) => unknown)(...a) }));

import controller from '../controllers/announcement';

const draft = (kind: 'anunt' | 'auto') => ({
  kind, accountId: null, announcementId: kind === 'anunt' ? 'an1' : null, key: null, title: 't', rows: [], athleteIds: [], groupIds: [], lastDate: null,
});

describe('portalStop', () => {
  let sync: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    sync = vi.fn(async () => null);
    h.sync = sync;
    (globalThis as { strapi?: unknown }).strapi = {};
  });
  afterEach(() => {
    delete (globalThis as { strapi?: unknown }).strapi;
  });

  it('stops a hand-written notice and runs the notice sync', async () => {
    const { store, state } = fakeNoticeStore();
    h.store = store;
    const id = await store.createNotice(draft('anunt'), '2026-11-20T08:00:00.000Z');
    const ctx = { params: { noticeId: id }, query: {}, request: { header: {} }, status: 200, body: null as unknown };
    await (controller as unknown as { portalStop: (c: unknown) => Promise<void> }).portalStop(ctx);
    expect(ctx.body).toEqual({ data: { stopped: true } });
    expect(state.notices[0].stoppedAt).not.toBeNull();
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('refuses an automatic notice and does not run the sync', async () => {
    const { store } = fakeNoticeStore();
    h.store = store;
    const id = await store.createNotice(draft('auto'), '2026-11-20T08:00:00.000Z');
    const ctx = { params: { noticeId: id }, query: {}, request: { header: {} }, status: 200, body: null as unknown };
    await (controller as unknown as { portalStop: (c: unknown) => Promise<void> }).portalStop(ctx);
    expect(ctx.status).toBe(409);
    expect(sync).not.toHaveBeenCalled();
  });
});
