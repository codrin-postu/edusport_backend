/** A cached skate-results answer. `failedAt` is the last failed refresh; the body is kept through failures. */
export type Snapshot = { key: string; body: unknown; fetchedAt: string; failedAt: string | null };
