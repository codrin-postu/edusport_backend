/**
 * The Strapi side of the registration e-mail: job store, registration and document reads,
 * Brevo, history, GlitchTip. The flow itself is in ./email-jobs.ts.
 */
import { readFile } from 'node:fs/promises';
import type { Core } from '@strapi/strapi';
import { buildRegistrationDocuments, listRegistrationDocuments } from '../club/documents';
import { SCHEDULE_HOLD_MS } from '../club/groups/schedule-mail';
import type { ScheduleChangePayload } from '../club/groups/types';
import { recordHistory } from '../club/history';
import { captureMessage } from '../sentry';
import { sendWithBrevo } from './brevo';
import { readEmailConfig, type EmailConfig } from './config';
import {
  attemptJob,
  queueRegistrationEmail,
  retryDueJobs,
  type EmailDeps,
  type EmailJobRow,
  type EmailJobStore,
  type RegistrationForEmail,
  type RetrySummary,
} from './email-jobs';
import type { EmailJobStatus } from './job-state';
import { buildEmailLinks } from './links';
import { isSchedulePayload } from './schedule-change-template';
import { sheetSyncedStore } from './sheet-status';
import { queueUpsert } from '../sheets/queue';

const JOB_UID = 'api::email-job.email-job' as const;
const REGISTRATION_UID = 'api::registration-submission.registration-submission' as const;
const SETTINGS_UID = 'api::site-settings.site-settings' as const;
const POPULATE: 'registration'[] = ['registration'];

type RawJob = {
  documentId: string;
  recipient?: string | null;
  subject?: string | null;
  status?: string | null;
  attempts?: number | null;
  lastError?: string | null;
  sentAt?: unknown;
  updatedAt?: unknown;
  registration?: { documentId?: string } | null;
  kind?: string | null;
  payload?: unknown;
  notBefore?: unknown;
};

const iso = (value: unknown): string | null =>
  value instanceof Date ? value.toISOString() : typeof value === 'string' && value ? value : null;

/** The stored payload when it has the shape the template needs, else null (the job then fails at once). */
const payloadOf = (v: unknown): ScheduleChangePayload | null => (isSchedulePayload(v) ? v : null);

export function toJobRow(raw: RawJob): EmailJobRow {
  return {
    documentId: raw.documentId,
    recipient: raw.recipient ?? '',
    subject: raw.subject ?? '',
    registrationDocumentId: raw.registration?.documentId ?? null,
    status: (raw.status ?? 'queued') as EmailJobStatus,
    attempts: raw.attempts ?? 0,
    lastError: raw.lastError ?? null,
    sentAt: iso(raw.sentAt),
    updatedAt: iso(raw.updatedAt),
    kind: raw.kind === 'schedule-change' ? 'schedule-change' : 'registration',
    payload: payloadOf(raw.payload),
    notBefore: iso(raw.notBefore),
  };
}

export function jobStore(strapi: Core.Strapi): EmailJobStore {
  const jobs = () => strapi.documents(JOB_UID);
  return {
    create: async (job) =>
      toJobRow(
        await jobs().create({
          data: { recipient: job.recipient, subject: job.subject, kind: 'registration', registration: job.registrationDocumentId, status: 'queued', attempts: 0 },
          populate: POPULATE,
        }),
      ),
    update: async (documentId, data) => toJobRow(await jobs().update({ documentId, data, populate: POPULATE })),
    findById: async (documentId) => {
      const raw = await jobs().findOne({ documentId, populate: POPULATE });
      return raw ? toJobRow(raw) : null;
    },
    claim: async (documentId) => (await strapi.db.query(JOB_UID).updateMany({ where: { documentId, status: 'queued' }, data: { status: 'sending', updatedAt: new Date() } })).count === 1,
    finish: async (documentId, data) => {
      const { count } = await strapi.db.query(JOB_UID).updateMany({ where: { documentId, status: 'sending' }, data: { ...data, updatedAt: new Date() } });
      if (count !== 1) return null;
      const raw = await jobs().findOne({ documentId, populate: POPULATE });
      return raw ? toJobRow(raw) : null;
    },
    failStuck: async (before, error) =>
      (await strapi.db.query(JOB_UID).updateMany({ where: { status: 'sending', updatedAt: { $lt: before.toISOString() } }, data: { status: 'failed', lastError: error, updatedAt: new Date() } })).count,
    findQueued: async (limit) =>
      (await jobs().findMany({ filters: { status: 'queued' }, sort: 'updatedAt:asc', limit, populate: POPULATE })).map(toJobRow),
    findLatest: async (registrationDocumentId) => {
      const rows = await jobs().findMany({ filters: { registration: { documentId: registrationDocumentId } }, sort: ['createdAt:desc', 'id:desc'], limit: 1, populate: POPULATE });
      return rows.length ? toJobRow(rows[0]) : null;
    },
    countForRecipientSince: (recipient, since) =>
      jobs().count({ filters: { kind: 'registration', recipient: { $eqi: recipient }, createdAt: { $gte: since.toISOString() } } }),
  };
}

async function loadRegistration(strapi: Core.Strapi, documentId: string): Promise<RegistrationForEmail | null> {
  const r = await strapi.documents(REGISTRATION_UID).findOne({ documentId, fields: ['email', 'childName', 'registrationNumber', 'season'] });
  if (!r?.email || !r.registrationNumber) return null;
  return { email: r.email, childName: r.childName ?? '', registrationNumber: r.registrationNumber, seasonLabel: r.season ?? '' };
}

function deliver(config: EmailConfig): EmailDeps['send'] {
  return (message) =>
    config.apiKey && config.sender
      ? sendWithBrevo(message, { apiKey: config.apiKey, sender: config.sender, replyTo: config.replyTo })
      : Promise.resolve({ ok: false, error: 'e-mail not configured' });
}

export function buildEmailDeps(strapi: Core.Strapi, config: EmailConfig = readEmailConfig()): EmailDeps {
  return {
    config,
    // Every job write also refreshes the registration's Sheet row (the "E-mail" column), like an edit does.
    jobs: sheetSyncedStore(jobStore(strapi), (registrationDocumentId) => queueUpsert('inscrieri', registrationDocumentId)),
    loadRegistration: (documentId) => loadRegistration(strapi, documentId),
    listDocuments: (documentId) => listRegistrationDocuments(strapi, documentId),
    buildDocuments: (documentId) => buildRegistrationDocuments(strapi, documentId),
    readDocument: (document) => readFile(document.path),
    loadLinks: async () => buildEmailLinks(config, (await strapi.documents(SETTINGS_UID).findFirst({}))?.contact),
    send: deliver(config),
    recordHistory: (note) => recordHistory(strapi, { subjectType: 'registration-submission', ...note }),
    alert: (message) => {
      strapi.log.error(message);
      captureMessage(message);
    },
    log: (level, message) => strapi.log[level](message),
    defer: (task) => {
      setImmediate(() => task().catch((err) => strapi.log.error(`[email-job] attempt crashed: ${err instanceof Error ? err.message : String(err)}`)));
    },
    now: () => new Date(),
  };
}

/** Contract for the submit flow (plan 2D/2F): queue the registration e-mail after the documents are built. */
export async function enqueueRegistrationEmail(strapi: Core.Strapi, registrationDocumentId: string): Promise<void> {
  await queueRegistrationEmail(buildEmailDeps(strapi), registrationDocumentId);
}

/** Deletes the e-mail jobs of registrations about to be deleted; call it before the rows go, while the link resolves. */
export async function deleteRegistrationEmailJobs(strapi: Core.Strapi, registrationDocumentIds: string[]): Promise<number> {
  if (registrationDocumentIds.length === 0) return 0;
  const { count } = await strapi.db.query(JOB_UID).deleteMany({ where: { registration: { documentId: { $in: registrationDocumentIds } } } });
  return count;
}

/** Hourly cron entry (config/cron-tasks.ts). */
export function retryRegistrationEmails(strapi: Core.Strapi): Promise<RetrySummary> {
  return retryDueJobs(buildEmailDeps(strapi));
}

async function attemptChange(strapi: Core.Strapi, changeKey: string): Promise<void> {
  const deps = buildEmailDeps(strapi);
  const rows = await strapi.documents(JOB_UID).findMany({ filters: { changeKey, status: 'queued' }, populate: POPULATE, limit: 1000 });
  for (const raw of rows) await attemptJob(deps, toJobRow(raw as unknown as RawJob));
}

/** The first attempt of a schedule change's e-mails once the hold is over (spec 6.5); the hourly cron retries. */
export function attemptScheduleChangeJobs(strapi: Core.Strapi, changeKey: string, delayMs = SCHEDULE_HOLD_MS + 1000): void {
  setTimeout(() => {
    attemptChange(strapi, changeKey).catch((err) => strapi.log.error(`[email-job] schedule change ${changeKey} crashed: ${err instanceof Error ? err.message : String(err)}`));
  }, delayMs);
}
