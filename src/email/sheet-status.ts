/**
 * The Înscrieri Sheet's "E-mail" column (approved screen decisions-1-5.html, last column after Document)
 * and the hook that refreshes a registration's Sheet row whenever one of its e-mail jobs changes.
 */
import type { EmailJobStore } from './email-jobs';

type JobForCell = { status?: unknown; sentAt?: unknown; createdAt?: unknown };

const TIME_ZONE = 'Europe/Bucharest';
const STATUS_TEXT: Record<string, string> = { queued: 'În coadă', failed: 'Eșuat' };

const time = (value: unknown): number => {
  const t = value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isNaN(t) ? 0 : t;
};

/** "03.10 14:23": day, month, hour and minute in Bucharest time. */
export function sentAtLabel(value: unknown): string {
  const t = time(value);
  if (!t) return '';
  const parts = new Intl.DateTimeFormat('ro-RO', {
    timeZone: TIME_ZONE, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(t));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('day')}.${part('month')} ${part('hour')}:${part('minute')}`;
}

/** The newest job of a registration (populated `emailJobs`), or null. */
export function latestJob(jobs: unknown): JobForCell | null {
  if (!Array.isArray(jobs) || !jobs.length) return null;
  return (jobs as JobForCell[]).reduce((latest, job) => (time(job?.createdAt) >= time(latest?.createdAt) ? job : latest));
}

/** Cell text: "Trimis 03.10 14:23", "În coadă", "Eșuat", or empty with no job. */
export function emailStatusCell(jobs: unknown): string {
  const job = latestJob(jobs);
  if (!job) return '';
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
