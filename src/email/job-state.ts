/**
 * E-mail job state machine.
 *
 *   queued --claimed by the sender---------------------> sending (one conditional write; a cancel or a second sender then finds it taken)
 *   sending --attempt ok--------------------------------> sent
 *   sending --attempt failed, attempts < MAX_ATTEMPTS---> queued (retried by the hourly cron)
 *   sending --attempt failed, attempts = MAX_ATTEMPTS---> failed (+ GlitchTip alert)
 *   sending for longer than STUCK_SENDING_MS (a crash)--> failed (the cron; never sent again, the first send may have gone out)
 *
 * A skipped attempt (no Brevo key, no sender, no test address) is not an attempt:
 * the job stays queued with its counter unchanged, so nothing is lost.
 */
export const MAX_ATTEMPTS = 5;
const MAX_ERROR = 500;

export type EmailJobStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'cancelled';
export type AttemptOutcome = { ok: true } | { ok: false; error: string };
export type JobState = { status: EmailJobStatus; attempts: number; lastError: string | null; sentAt: string | null };
export type Transition = JobState & { alert: boolean };

export function nextJobState(job: { attempts: number }, outcome: AttemptOutcome, now: Date): Transition {
  const attempts = job.attempts + 1;
  if (outcome.ok === true) return { status: 'sent', attempts, lastError: null, sentAt: now.toISOString(), alert: false };
  const failed = attempts >= MAX_ATTEMPTS;
  return { status: failed ? 'failed' : 'queued', attempts, lastError: outcome.error.slice(0, MAX_ERROR), sentAt: null, alert: failed };
}

/** A job the cron may try now: queued, past its `notBefore` (a schedule change's hold), untouched for `quietMs`. */
export function isDue(job: { status: EmailJobStatus; updatedAt: string | null; notBefore?: string | null }, now: Date, quietMs: number): boolean {
  if (job.status !== 'queued') return false;
  if (job.notBefore && Date.parse(job.notBefore) > now.getTime()) return false;
  const updated = job.updatedAt ? Date.parse(job.updatedAt) : 0;
  return now.getTime() - updated >= quietMs;
}
