import type { DeliveryRecord, NoticeRecord, NoticeStore } from '../store';

export type NoticeState = { notices: NoticeRecord[]; deliveries: DeliveryRecord[]; nextId: number };
export const emptyNoticeState = (): NoticeState => ({ notices: [], deliveries: [], nextId: 1 });

/** Removes the notices that name the athlete with their deliveries (the real store does the same on `dropNoticesForAthlete`). */
export function dropNamed(state: NoticeState, athleteId: string): void {
  const gone = new Set(state.notices.filter((n) => n.kind === 'auto' && n.athleteIds.includes(athleteId)).map((n) => n.id));
  state.notices = state.notices.filter((n) => !gone.has(n.id));
  state.deliveries = state.deliveries.filter((d) => !gone.has(d.noticeId));
}

/** What the database does when an account is deleted: its links go, the rows stay until the purge. */
export function removeAccount(state: NoticeState, accountId: string): void {
  for (const n of state.notices) if (n.accountId === accountId) n.accountId = null;
  for (const d of state.deliveries) if (d.accountId === accountId) d.accountId = '';
}

const must = <T extends { id: string }>(rows: T[], id: string): T => {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`fake: no row ${id}`);
  return row;
};

export function fakeNoticeStore(state: NoticeState = emptyNoticeState()): { store: NoticeStore; state: NoticeState } {
  const store: NoticeStore = {
    transaction: (fn) => fn(),
    liveAutoNotice: async (accountId) => structuredClone(state.notices.find((n) => n.kind === 'auto' && n.accountId === accountId && n.endedAt === null) ?? null),
    noticeOfAnnouncement: async (id) => structuredClone(state.notices.find((n) => n.announcementId === id) ?? null),
    createNotice: async (n, at) => {
      const id = `ntc${state.nextId++}`;
      state.notices.push({ ...structuredClone(n), id, createdAt: at, endedAt: null, stoppedAt: null });
      return id;
    },
    endNotice: async (id, at) => {
      must(state.notices, id).endedAt = at;
    },
    stopNotice: async (id, at) => {
      must(state.notices, id).stoppedAt = at;
    },
    notices: async ({ since }) =>
      structuredClone(state.notices.filter((n) => !since || n.createdAt >= since).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))),
    notice: async (id) => structuredClone(state.notices.find((n) => n.id === id) ?? null),
    deliveries: async ({ noticeId, accountId, open }) =>
      structuredClone(state.deliveries.filter((d) => (!noticeId || d.noticeId === noticeId) && (!accountId || d.accountId === accountId) && (!open || d.dismissedAt === null))),
    deliveriesFor: async (ids) => structuredClone(state.deliveries.filter((d) => ids.includes(d.noticeId))),
    deliver: async (noticeId, accountIds, at) => {
      const fresh = [...new Set(accountIds)].filter((a) => !state.deliveries.some((d) => d.noticeId === noticeId && d.accountId === a));
      for (const accountId of fresh) state.deliveries.push({ id: `dlv${state.nextId++}`, noticeId, accountId, deliveredAt: at, seenAt: null, dismissedAt: null });
      return fresh.length;
    },
    dismiss: async (id, at) => {
      must(state.deliveries, id).dismissedAt = at;
    },
    markSeen: async (ids, at) => {
      for (const d of state.deliveries) if (ids.includes(d.id) && d.seenAt === null) d.seenAt = at;
    },
    purgeOrphans: async () => {
      const notices = state.notices.filter((n) => n.kind === 'auto' && n.accountId === null).map((n) => n.id);
      const before = state.deliveries.length;
      state.deliveries = state.deliveries.filter((d) => d.accountId !== '' && !notices.includes(d.noticeId));
      state.notices = state.notices.filter((n) => !notices.includes(n.id));
      return { notices: notices.length, deliveries: before - state.deliveries.length };
    },
  };
  return { store, state };
}
