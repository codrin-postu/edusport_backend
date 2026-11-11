/**
 * Registration e-mail jobs: queue, attempt, retry, resend, status.
 * Everything Strapi-, Brevo- or file-related comes in through `EmailDeps`, so the flow is
 * unit tested with fakes (src/email/__tests__/email-jobs.test.ts). Wiring: ./strapi-email.ts.
 */
import type { StoredDocument } from '../club/documents';
import type { ScheduleChangePayload } from '../club/groups/types';
import type { PaymentEmailPayload } from '../club/presence/types';
import type { Attachment, OutgoingEmail, SendResult } from './brevo';
import { blockedReason, deliveryTarget, type BlockedReason, type EmailConfig } from './config';
import { isDue, nextJobState, type AttemptOutcome, type EmailJobStatus, type JobState } from './job-state';
import { registrationSubject, renderRegistrationEmail, type EmailLinks } from './registration-template';
import { isPaymentPayload, renderPaymentEmail } from './payment-email';
import { isPortalInvitePayload, renderPortalInvite, type PortalInvitePayload } from './portal-email';
import { isPortalAccessPayload, renderPortalAccess, type PortalAccessPayload } from './portal-access-email';
import { isSchedulePayload, renderScheduleEmail } from './schedule-change-template';

/** A job is not retried by the cron until it has been left alone this long (a first attempt may be running). */
export const QUIET_MS = 5 * 60_000;
/** A job left in `sending` this long was cut short (a crash): the cron fails it and never sends it again. */
export const STUCK_SENDING_MS = 10 * 60_000;
export const STUCK_SENDING_ERROR = 'sending was interrupted';
export const RESEND_ACTION = 'email-resent';
/** Registration e-mails per recipient address per 24 h from the public submit; a resend is not capped (user, 2026-10-24). */
export const RECIPIENT_DAILY_CAP = 3;
const DAY_MS = 24 * 60 * 60_000;

export type EmailJobKind = 'registration' | 'schedule-change' | 'payment' | 'portal-invite' | 'portal-access';
export type EmailJobRow = {
  documentId: string;
  recipient: string;
  subject: string;
  registrationDocumentId: string | null;
  status: EmailJobStatus;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  updatedAt: string | null;
  kind?: EmailJobKind;
  payload?: ScheduleChangePayload | PaymentEmailPayload | PortalInvitePayload | PortalAccessPayload | null;
  paymentDocumentId?: string | null;
  notBefore?: string | null;
};
export type NewEmailJob = { recipient: string; subject: string; registrationDocumentId: string };
export type RegistrationForEmail = { email: string; childName: string; registrationNumber: string; seasonLabel: string };
export type JobUpdate = JobState & { recipient?: string; subject?: string; payload?: EmailJobRow['payload'] };
export type RetrySummary = { attempted: number; skipped: BlockedReason | null };
export type HistoryNote = { subjectId: string; action: string; actor: string; changes: Record<string, unknown> };

export interface EmailJobStore {
  create(job: NewEmailJob): Promise<EmailJobRow>;
  update(documentId: string, data: JobUpdate): Promise<EmailJobRow>;
  /** The stored job, read again after a refused claim so the caller reports what is stored; optional. */
  findById?(documentId: string): Promise<EmailJobRow | null>;
  /** One conditional write queued -> sending; true only for the caller that made it (a cancel or another sender got there first otherwise). */
  claim(documentId: string): Promise<boolean>;
  /** Writes the final state only where the status is still `sending`; null when it no longer is. */
  finish(documentId: string, data: JobUpdate): Promise<EmailJobRow | null>;
  /** Jobs left in `sending` since before `before` become failed (never resent); the count. */
  failStuck(before: Date, error: string): Promise<number>;
  findQueued(limit: number): Promise<EmailJobRow[]>;
  findLatest(registrationDocumentId: string): Promise<EmailJobRow | null>;
  countForRecipientSince(recipient: string, since: Date): Promise<number>;
}

export interface EmailDeps {
  config: EmailConfig;
  jobs: EmailJobStore;
  loadRegistration(documentId: string): Promise<RegistrationForEmail | null>;
  listDocuments(registrationDocumentId: string): Promise<StoredDocument[]>;
  buildDocuments(registrationDocumentId: string): Promise<StoredDocument[]>;
  readDocument(document: StoredDocument): Promise<Buffer>;
  loadLinks(): Promise<EmailLinks>;
  send(message: OutgoingEmail): Promise<SendResult>;
  recordHistory(note: HistoryNote): Promise<void>;
  alert(message: string): void;
  log(level: 'info' | 'warn' | 'error', message: string): void;
  defer(task: () => Promise<void>): void;
  now(): Date;
  /** Called once after a job is written `sent`; a throw is logged and never fails the attempt. */
  onSent?(job: EmailJobRow): Promise<void>;
}

export type RegistrationEmailStatus = {
  status: Exclude<EmailJobStatus, 'sending'> | 'none';
  recipient: string;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  updatedAt: string | null;
  documents: string[];
};

export type ResendResult =
  | { ok: true; status: RegistrationEmailStatus }
  | { ok: false; code: 'not-found' | 'no-documents'; error: string };

export const RESEND_ERRORS = {
  'not-found': 'Înscrierea nu a fost găsită.',
  'no-documents': 'Înscrierea nu are documente.',
} as const;

const message = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const RETRY_BATCH = 100;

async function attachmentsFor(deps: EmailDeps, documents: StoredDocument[]): Promise<Attachment[]> {
  return Promise.all(
    documents.map(async (d) => ({ name: d.fileName, content: (await deps.readDocument(d)).toString('base64') })),
  );
}

/** The stored PDFs; when none are stored (the build failed at submit), they are built first. Empty only if that fails. */
async function documentsFor(deps: EmailDeps, registrationDocumentId: string): Promise<StoredDocument[]> {
  const stored = await deps.listDocuments(registrationDocumentId);
  if (stored.length) return stored;
  try {
    return await deps.buildDocuments(registrationDocumentId);
  } catch (err) {
    deps.log('warn', `[email-job] building the documents of ${registrationDocumentId} failed: ${message(err)}`);
    return [];
  }
}

async function compose(deps: EmailDeps, registrationDocumentId: string, to: string): Promise<OutgoingEmail> {
  const registration = await deps.loadRegistration(registrationDocumentId);
  if (!registration) throw new Error('registration not found');
  const documents = await documentsFor(deps, registrationDocumentId);
  if (!documents.length) throw new Error('no documents built for this registration');
  const rendered = renderRegistrationEmail({
    childName: registration.childName,
    registrationNumber: registration.registrationNumber,
    seasonLabel: registration.seasonLabel,
    documents: documents.map((d) => d.kind),
    links: await deps.loadLinks(),
  });
  return { to, ...rendered, attachments: await attachmentsFor(deps, documents) };
}

type Compose = (to: string) => Promise<OutgoingEmail>;

function scheduleComposer(deps: EmailDeps, payload: EmailJobRow['payload']): Compose | null {
  if (!isSchedulePayload(payload)) return null;
  return async (to) => ({ to, ...renderScheduleEmail({ payload, links: await deps.loadLinks() }), attachments: [] });
}

function paymentComposer(deps: EmailDeps, payload: EmailJobRow['payload']): Compose | null {
  if (!isPaymentPayload(payload)) return null;
  return async (to) => ({ to, ...renderPaymentEmail({ payload, links: await deps.loadLinks() }), attachments: [] });
}

function inviteComposer(deps: EmailDeps, payload: EmailJobRow['payload']): Compose | null {
  if (!isPortalInvitePayload(payload)) return null;
  return async (to) => ({ to, ...renderPortalInvite({ payload, links: await deps.loadLinks() }), attachments: [] });
}

function accessComposer(deps: EmailDeps, payload: EmailJobRow['payload']): Compose | null {
  if (!isPortalAccessPayload(payload)) return null;
  return async (to) => ({ to, ...renderPortalAccess({ payload, links: await deps.loadLinks() }), attachments: [] });
}

function composerFor(deps: EmailDeps, job: EmailJobRow): Compose | null {
  if (job.kind === 'portal-access') return accessComposer(deps, job.payload ?? null);
  if (job.kind === 'portal-invite') return inviteComposer(deps, job.payload ?? null);
  if (job.kind === 'payment') return paymentComposer(deps, job.payload ?? null);
  if (job.kind === 'schedule-change') return scheduleComposer(deps, job.payload ?? null);
  const registrationId = job.registrationDocumentId;
  return registrationId ? (to) => compose(deps, registrationId, to) : null;
}

async function tryOnce(deps: EmailDeps, composer: Compose, to: string): Promise<AttemptOutcome> {
  try {
    const result = await deps.send(await composer(to));
    return result.ok === true ? { ok: true } : { ok: false, error: result.error };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

const held = (job: EmailJobRow, now: Date): boolean => !!job.notBefore && Date.parse(job.notBefore) > now.getTime();
const MISSING_SOURCE: Record<EmailJobKind, string> = {
  registration: 'registration deleted', 'schedule-change': 'schedule change without payload', payment: 'payment without payload', 'portal-invite': 'invite without payload', 'portal-access': 'access mail without payload',
};
const missingSource = (job: EmailJobRow): string => MISSING_SOURCE[job.kind ?? 'registration'];

/** Once an invite job leaves the queue (sent or failed) its link, which holds a live secret, is blanked. */
export function withoutInviteLink(job: EmailJobRow, state: JobUpdate): JobUpdate {
  if (job.kind !== 'portal-invite' || state.status === 'queued' || !job.payload) return state;
  return { ...state, payload: { ...(job.payload as PortalInvitePayload), link: '' } };
}

/** The final write, only while the job is still `sending`; a job the cron already failed is left as it is. */
async function finishJob(deps: EmailDeps, job: EmailJobRow, state: JobUpdate): Promise<EmailJobRow> {
  const written = await deps.jobs.finish(job.documentId, withoutInviteLink(job, state));
  if (!written) {
    deps.log('warn', `[email-job] job ${job.documentId} was no longer sending when its result was written`);
    return { ...job, ...state };
  }
  if (written.status === 'sent') await notifySent(deps, written);
  return written;
}

async function notifySent(deps: EmailDeps, job: EmailJobRow): Promise<void> {
  try {
    await deps.onSent?.(job);
  } catch (err) {
    deps.log('warn', `[email-job] onSent of job ${job.documentId} failed: ${message(err)}`);
  }
}

/**
 * One delivery attempt for a queued job. Skipped (job unchanged) while it is held (`notBefore`) or while e-mail
 * cannot be sent here. The job is claimed (queued -> sending, one conditional write) before anything is composed or
 * sent: a cancel (undo) that landed first wins and nothing is sent; a claimed job is refused by the undo. A job whose
 * registration (or payload) is gone fails at once without an alert.
 */
export async function attemptJob(deps: EmailDeps, job: EmailJobRow): Promise<EmailJobRow> {
  if (job.status !== 'queued' || held(job, deps.now())) return job;
  const composer = composerFor(deps, job);
  const target = composer ? deliveryTarget(deps.config, job.recipient) : null;
  if (target && target.ok === false) {
    deps.log('info', `[email-job] job ${job.documentId} stays queued: ${target.reason}`);
    return job;
  }
  if (!(await deps.jobs.claim(job.documentId))) {
    deps.log('info', `[email-job] job ${job.documentId} is no longer queued, not sent`);
    return (deps.jobs.findById ? await deps.jobs.findById(job.documentId) : null) ?? { ...job, status: 'cancelled' };
  }
  if (!composer || !target || target.ok === false) {
    return finishJob(deps, job, { status: 'failed', attempts: job.attempts, lastError: missingSource(job), sentAt: null });
  }
  const outcome = await tryOnce(deps, composer, target.to);
  const { alert, ...state } = nextJobState(job, outcome, deps.now());
  const updated = await finishJob(deps, job, state);
  deps.log(state.status === 'sent' ? 'info' : 'warn', `[email-job] job ${job.documentId}: ${state.status} after attempt ${state.attempts}`);
  if (alert) deps.alert(`[email-job] ${job.kind ?? 'registration'} e-mail failed after ${state.attempts} attempts (job ${job.documentId}): ${state.lastError}`);
  return updated;
}

async function recipientCapReached(deps: EmailDeps, recipient: string): Promise<boolean> {
  const since = new Date(deps.now().getTime() - DAY_MS);
  return (await deps.jobs.countForRecipientSince(recipient, since)) >= RECIPIENT_DAILY_CAP;
}

/**
 * Called by the submit flow once the documents are built: store the job, then try it right away (not awaited).
 * No job once the recipient already had RECIPIENT_DAILY_CAP in 24 h; the registration itself is kept.
 */
export async function queueRegistrationEmail(deps: EmailDeps, registrationDocumentId: string): Promise<EmailJobRow | null> {
  const registration = await deps.loadRegistration(registrationDocumentId);
  if (!registration) {
    deps.log('warn', `[email-job] registration ${registrationDocumentId} not found, no e-mail queued`);
    return null;
  }
  if (await recipientCapReached(deps, registration.email)) {
    deps.log('warn', `[email-job] recipient of ${registrationDocumentId} already had ${RECIPIENT_DAILY_CAP} e-mails in 24 h, no e-mail queued`);
    return null;
  }
  const job = await deps.jobs.create({
    recipient: registration.email,
    subject: registrationSubject(registration.childName, registration.registrationNumber),
    registrationDocumentId,
  });
  deps.defer(async () => {
    await attemptJob(deps, job);
  });
  return job;
}

/** One cron attempt; a job that throws (a job store error) is logged and the batch goes on. */
async function retryJob(deps: EmailDeps, job: EmailJobRow): Promise<void> {
  try {
    await attemptJob(deps, job);
  } catch (err) {
    deps.log('error', `[email-job] retry of job ${job.documentId} crashed: ${message(err)}`);
  }
}

/** Hourly cron: one more attempt for every queued job left alone for QUIET_MS. Nothing happens while e-mail cannot be sent. */
export async function retryDueJobs(deps: EmailDeps): Promise<RetrySummary> {
  const stuck = await deps.jobs.failStuck(new Date(deps.now().getTime() - STUCK_SENDING_MS), STUCK_SENDING_ERROR);
  if (stuck) deps.log('warn', `[email-job] ${stuck} job(s) left in sending were marked failed, not resent`);
  const skipped = blockedReason(deps.config);
  if (skipped) return { attempted: 0, skipped };
  const now = deps.now();
  const due = (await deps.jobs.findQueued(RETRY_BATCH)).filter((job) => isDue(job, now, QUIET_MS));
  for (const job of due) await retryJob(deps, job);
  return { attempted: due.length, skipped: null };
}

function toStatus(registration: RegistrationForEmail, job: EmailJobRow | null, documents: StoredDocument[]): RegistrationEmailStatus {
  return {
    status: job ? (job.status === 'sending' ? 'queued' : job.status) : 'none',
    recipient: registration.email,
    attempts: job?.attempts ?? 0,
    lastError: job?.lastError ?? null,
    sentAt: job?.sentAt ?? null,
    updatedAt: job?.updatedAt ?? null,
    documents: documents.map((d) => d.fileName),
  };
}

/** GET .../email-status: the latest job, the address a resend goes to and the documents it would carry. */
export async function registrationEmailStatus(deps: EmailDeps, registrationDocumentId: string): Promise<RegistrationEmailStatus | null> {
  const registration = await deps.loadRegistration(registrationDocumentId);
  if (!registration) return null;
  const [job, documents] = await Promise.all([deps.jobs.findLatest(registrationDocumentId), deps.listDocuments(registrationDocumentId)]);
  return toStatus(registration, job, documents);
}

/** A still-queued job is reused (fresh address and subject, counter reset); otherwise a new job. */
async function jobForResend(deps: EmailDeps, registrationDocumentId: string, registration: RegistrationForEmail): Promise<EmailJobRow> {
  const recipient = registration.email;
  const subject = registrationSubject(registration.childName, registration.registrationNumber);
  const latest = await deps.jobs.findLatest(registrationDocumentId);
  if (latest?.status === 'queued') {
    return deps.jobs.update(latest.documentId, { recipient, subject, status: 'queued', attempts: 0, lastError: null, sentAt: null });
  }
  return deps.jobs.create({ recipient, subject, registrationDocumentId });
}

/** POST .../resend-email: logged in Istoric, then one attempt now (awaited, so the admin sees the result). */
export async function resendRegistrationEmail(deps: EmailDeps, registrationDocumentId: string, actor: string): Promise<ResendResult> {
  const registration = await deps.loadRegistration(registrationDocumentId);
  if (!registration) return { ok: false, code: 'not-found', error: RESEND_ERRORS['not-found'] };
  const documents = await documentsFor(deps, registrationDocumentId);
  if (!documents.length) return { ok: false, code: 'no-documents', error: RESEND_ERRORS['no-documents'] };
  const job = await jobForResend(deps, registrationDocumentId, registration);
  await deps.recordHistory({
    subjectId: registrationDocumentId,
    action: RESEND_ACTION,
    actor,
    changes: { recipient: registration.email, documents: documents.map((d) => d.fileName) },
  });
  const attempted = await attemptJob(deps, job);
  return { ok: true, status: toStatus(registration, attempted, documents) };
}
