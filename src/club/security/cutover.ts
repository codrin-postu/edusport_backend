import type { SecurityStore, Subject } from './store';

export type CutoverPlan = {
  /** Keys per rpId, all subjects together. */
  perRpId: Record<string, number>;
  /** Subjects that hold keys and none of them on the current rpId: the offer is shown to them once more. */
  subjectsToOffer: Subject[];
};

const KEEP_MS = 30 * 24 * 3600_000;

/** Counts the keys per rpId and names the subjects whose keys are all on an old rpId (spec 8.6 step 2). Reads only. */
export async function planCutover(store: SecurityStore, currentRpId: string): Promise<CutoverPlan> {
  const perRpId: Record<string, number> = {};
  const bySubject = new Map<string, { subject: Subject; onCurrent: boolean }>();
  for (const key of await store.allPasskeys()) {
    perRpId[key.rpId] = (perRpId[key.rpId] ?? 0) + 1;
    const id = `${key.subject.type}:${key.subject.id}`;
    const seen = bySubject.get(id) ?? { subject: key.subject, onCurrent: false };
    bySubject.set(id, { subject: seen.subject, onCurrent: seen.onCurrent || key.rpId === currentRpId });
  }
  return { perRpId, subjectsToOffer: [...bySubject.values()].filter((s) => !s.onCurrent).map((s) => s.subject) };
}

/** Clears `passkeyOfferedAt` for the planned subjects so the offer shows once more. Deletes nothing. Answers how many subjects it cleared. */
export async function applyCutover(store: SecurityStore, plan: CutoverPlan): Promise<number> {
  let cleared = 0;
  for (const s of plan.subjectsToOffer) {
    if (s.type === 'admin') {
      const account = await store.adminAccount(Number(s.id));
      if (!account) continue;
      await store.updateAdminAccount(account.id, { passkeyOfferedAt: null });
    } else {
      await store.updatePortalAccountExtra(s.id, { passkeyOfferedAt: null });
    }
    cleared += 1;
  }
  return cleared;
}

/** The daily purge rule: 30 days after `WEBAUTHN_MOVED_AT` the keys of an old rpId go. Null while it is unset, unreadable or less than 30 days ago. */
export function oldKeyPurge(env: NodeJS.ProcessEnv, now: Date): { rpId: string; before: Date } | null {
  const rpId = env.WEBAUTHN_RP_ID?.trim();
  const moved = env.WEBAUTHN_MOVED_AT ? new Date(env.WEBAUTHN_MOVED_AT) : null;
  if (!rpId || !moved || Number.isNaN(moved.getTime())) return null;
  return now.getTime() >= moved.getTime() + KEEP_MS ? { rpId, before: moved } : null;
}

/** The text the script prints: the same lines for a dry run and a real run. */
export function cutoverReport(plan: CutoverPlan): string[] {
  const lines = Object.entries(plan.perRpId).sort(([a], [b]) => a.localeCompare(b)).map(([rpId, n]) => `${rpId}: ${n}`);
  return [...(lines.length ? lines : ['no keys']), `subjects to offer again: ${plan.subjectsToOffer.length}`];
}
