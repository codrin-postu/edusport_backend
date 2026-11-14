export type NoticeKind = 'auto' | 'anunt';
export type NoticeRow = { date: string; text: string; reason: string | null };

export type NoticeRecord = {
  id: string; kind: NoticeKind; accountId: string | null; announcementId: string | null; key: string | null; title: string;
  rows: NoticeRow[]; athleteIds: string[]; groupIds: string[]; lastDate: string | null; createdAt: string; endedAt: string | null; stoppedAt: string | null;
};
export type NewNotice = Omit<NoticeRecord, 'id' | 'createdAt' | 'endedAt' | 'stoppedAt'>;

/** `seenAt`: the account opened its Mesaje list while the message was in it (first time only). `dismissedAt`: the account closed it. */
export type DeliveryRecord = { id: string; noticeId: string; accountId: string; deliveredAt: string; seenAt: string | null; dismissedAt: string | null };

export interface NoticeStore {
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  /** Kind auto, not ended. */
  liveAutoNotice(accountId: string): Promise<NoticeRecord | null>;
  noticeOfAnnouncement(announcementId: string): Promise<NoticeRecord | null>;
  createNotice(n: NewNotice, at: string): Promise<string>;
  endNotice(id: string, at: string): Promise<void>;
  stopNotice(id: string, at: string): Promise<void>;
  /** Newest first; `since` keeps notices created at or after the instant. */
  notices(q: { since?: string }): Promise<NoticeRecord[]>;
  notice(id: string): Promise<NoticeRecord | null>;
  /** `open`: not dismissed. */
  deliveries(q: { noticeId?: string; accountId?: string; open?: boolean }): Promise<DeliveryRecord[]>;
  /** Callers hold the account locks first (lock order account, then notice rows). Accounts already delivered are skipped; returns the count created. */
  deliver(noticeId: string, accountIds: string[], at: string): Promise<number>;
  dismiss(deliveryId: string, at: string): Promise<void>;
  /** Idempotent: a delivery already seen keeps its first `seenAt`. */
  markSeen(deliveryIds: string[], at: string): Promise<void>;
  /** Deliveries whose account is gone, and auto notices whose account is gone (with their deliveries). Returns the counts removed. */
  purgeOrphans(): Promise<{ notices: number; deliveries: number }>;
}
