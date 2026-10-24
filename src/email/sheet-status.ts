/**
 * The Înscrieri Sheet's "E-mail" column (approved screen decisions-1-5.html, last column after Document)
 * and the hook that refreshes a registration's Sheet row whenever one of its e-mail jobs changes.
 */
import { formatEmailSentAt } from '../club/registration-panel';
import type { EmailJobStore } from './email-jobs';

type JobForCell = { status?: unknown; sentAt?: unknown; createdAt?: unknown };

const STATUS_TEXT: Record<string, string> = { queued: 'Urmează să fie trimis', failed: 'Netrimis' };

const time = (value: unknown): number => {
  const t = value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isNaN(t) ? 0 : t;
};

const toIso = (value: unknown): string | null => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  return typeof value === 'string' ? value : null;
};

/** "03.10.2026, 14:23": shared with the panel's e-mail status (`formatEmailSentAt`). */
export function sentAtLabel(value: unknown): string {
  const iso = toIso(value);
  return iso ? formatEmailSentAt(iso) : '';
}

/** The newest job of a registration (populated `emailJobs`), or null. */
export function latestJob(jobs: unknown): JobForCell | null {
  if (!Array.isArray(jobs) || !jobs.length) return null;
  return (jobs as JobForCell[]).reduce((latest, job) => (time(job?.createdAt) >= time(latest?.createdAt) ? job : latest));
}

/** Cell text: "Trimis 03.10.2026, 14:23", "Urmează să fie trimis", "Netrimis", or "Niciun e-mail trimis" with no job. */
export function emailStatusCell(jobs: unknown): string {
  const job = latestJob(jobs);
  if (!job) return 'Niciun e-mail trimis';
  if (job.status === 'sent') return `Trimis ${sentAtLabel(job.sentAt)}`.trim();
  return STATUS_TEXT[String(job.status)] ?? '';
}

/** Wraps the job store so every create and update also refreshes that registration's Sheet row. */
export function sheetSyncedStore(store: EmailJobStore, refreshRow: (registrationDocumentId: string) => void): EmailJobStore {
  const notify = <T extends { registrationDocumentId: string | null }>(row: T): T => {
    if (row.registrationDocumentId) refreshRow(row.registrationDocumentId);
    return row;
  };
  return {
    create: async (job) => notify(await store.create(job)),
    update: async (documentId, data) => notify(await store.update(documentId, data)),
    findQueued: (limit) => store.findQueued(limit),
    findLatest: (registrationDocumentId) => store.findLatest(registrationDocumentId),
    countForRecipientSince: (recipient, since) => store.countForRecipientSince(recipient, since),
  };
}
