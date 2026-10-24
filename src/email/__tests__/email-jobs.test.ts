import { describe, expect, it } from 'vitest';
import type { StoredDocument } from '../../club/documents';
import type { OutgoingEmail, SendResult } from '../brevo';
import { readEmailConfig } from '../config';
import {
  QUIET_MS,
  RECIPIENT_DAILY_CAP,
  RESEND_ACTION,
  RESEND_ERRORS,
  attemptJob,
  queueRegistrationEmail,
  registrationEmailStatus,
  resendRegistrationEmail,
  retryDueJobs,
  type EmailDeps,
  type EmailJobRow,
  type HistoryNote,
  type JobUpdate,
  type NewEmailJob,
  type RegistrationForEmail,
} from '../email-jobs';
import type { EmailLinks } from '../registration-template';

const NOW = new Date('2026-10-20T09:00:00.000Z');
const LONG_AGO = '2026-10-20T07:00:00.000Z';
const REGISTRATION: RegistrationForEmail = { email: 'parinte@example.ro', childName: 'Maria Pop', registrationNumber: '2026-0008', seasonLabel: '2026-2027' };
const DOCUMENTS: StoredDocument[] = [
  { kind: 'acord', fileName: 'Pop_Maria_Acord_2026-2027.pdf', path: '/private/documents/a.pdf' },
  { kind: 'adeziune', fileName: 'Pop_Maria_Adeziune_2026-2027.pdf', path: '/private/documents/b.pdf' },
];
const LINKS: EmailLinks = {
  site: 'https://scoaladepatinaj.com',
  program: 'https://scoaladepatinaj.com/cursuri/program',
  privacy: 'https://scoaladepatinaj.com/protectia-datelor',
  headerImage: 'https://cms.scoaladepatinaj.com/email/edusport-header.png',
  whatsapp: null,
  phone: null,
  email: null,
  facebook: null,
};
const ENV = { BREVO_API_KEY: 'k', EMAIL_FROM_ADDRESS: 'inscrieri@scoaladepatinaj.com', EMAIL_TEST_RECIPIENT: 'test@codrin.space', NODE_ENV: 'test' };

type Options = {
  env?: Record<string, string | undefined>;
  send?: (m: OutgoingEmail) => Promise<SendResult>;
  documents?: StoredDocument[];
  build?: (registrationDocumentId: string) => Promise<StoredDocument[]>;
  registration?: RegistrationForEmail | null;
};

const buildFails = async (): Promise<StoredDocument[]> => {
  throw new Error('render failed');
};

function fakeDeps(options: Options = {}) {
  const jobs = new Map<string, EmailJobRow>();
  const sent: OutgoingEmail[] = [];
  const alerts: string[] = [];
  const history: HistoryNote[] = [];
  const deferred: (() => Promise<void>)[] = [];
  const createdAt = new Map<string, number>();
  const warnings: string[] = [];
  let seq = 0;
  const save = (row: EmailJobRow) => {
    jobs.set(row.documentId, row);
    return row;
  };
  const deps: EmailDeps = {
    config: readEmailConfig(options.env ?? ENV),
    jobs: {
      create: async (job: NewEmailJob) => {
        const row = save({ documentId: `job-${++seq}`, ...job, status: 'queued', attempts: 0, lastError: null, sentAt: null, updatedAt: NOW.toISOString() });
        createdAt.set(row.documentId, NOW.getTime());
        return row;
      },
      update: async (id: string, data: JobUpdate) => save({ ...jobs.get(id)!, ...data, updatedAt: NOW.toISOString() }),
      findQueued: async () => [...jobs.values()].filter((j) => j.status === 'queued'),
      findLatest: async (regId: string) => [...jobs.values()].filter((j) => j.registrationDocumentId === regId).pop() ?? null,
      countForRecipientSince: async (recipient: string, since: Date) =>
        [...jobs.values()].filter((j) => j.recipient.toLowerCase() === recipient.toLowerCase() && createdAt.get(j.documentId)! >= since.getTime()).length,
    },
    loadRegistration: async () => (options.registration === undefined ? REGISTRATION : options.registration),
    listDocuments: async () => options.documents ?? DOCUMENTS,
    buildDocuments: options.build ?? buildFails,
    readDocument: async (d) => Buffer.from(`pdf:${d.fileName}`),
    loadLinks: async () => LINKS,
    send:
      options.send ??
      (async (m) => {
        sent.push(m);
        return { ok: true, messageId: '<m1>' };
      }),
    recordHistory: async (note) => {
      history.push(note);
    },
    alert: (m) => {
      alerts.push(m);
    },
    log: (level, m) => {
      if (level === 'warn') warnings.push(m);
    },
    defer: (task) => {
      deferred.push(task);
    },
    now: () => NOW,
  };
  const runDeferred = async () => {
    for (const task of deferred.splice(0)) await task();
  };
  const age = (id: string) => jobs.set(id, { ...jobs.get(id)!, updatedAt: LONG_AGO });
  const createdBefore = (id: string, ms: number) => createdAt.set(id, NOW.getTime() - ms);
  return { deps, jobs, sent, alerts, history, warnings, runDeferred, age, createdBefore };
}

const failing = async (): Promise<SendResult> => ({ ok: false, error: 'Brevo 500: down' });

describe('queueRegistrationEmail', () => {
  it('stores a queued job and sends it right after, not inside the submit request', async () => {
    const { deps, jobs, sent, runDeferred } = fakeDeps();
    const job = await queueRegistrationEmail(deps, 'reg-1');
    expect(job).toMatchObject({ status: 'queued', attempts: 0, recipient: 'parinte@example.ro', registrationDocumentId: 'reg-1', subject: 'Înscriere înregistrată: Maria Pop (nr. 2026-0008)' });
    expect(sent).toEqual([]);
    await runDeferred();
    expect(jobs.get(job!.documentId)).toMatchObject({ status: 'sent', attempts: 1, sentAt: NOW.toISOString(), lastError: null });
  });

  it('attaches the stored PDFs and uses the E1 subject', async () => {
    const { deps, sent, runDeferred } = fakeDeps();
    await queueRegistrationEmail(deps, 'reg-1');
    await runDeferred();
    expect(sent[0].subject).toBe('Înscriere înregistrată: Maria Pop (nr. 2026-0008)');
    expect(sent[0].attachments).toEqual([
      { name: 'Pop_Maria_Acord_2026-2027.pdf', content: Buffer.from('pdf:Pop_Maria_Acord_2026-2027.pdf').toString('base64') },
      { name: 'Pop_Maria_Adeziune_2026-2027.pdf', content: Buffer.from('pdf:Pop_Maria_Adeziune_2026-2027.pdf').toString('base64') },
    ]);
    expect(sent[0].text).toContain('Am atașat formularul de înscriere și cererea de adeziune.');
  });

  it('queues nothing for an unknown registration', async () => {
    const { deps, jobs } = fakeDeps({ registration: null });
    await expect(queueRegistrationEmail(deps, 'gone')).resolves.toBeNull();
    expect(jobs.size).toBe(0);
  });
});

describe('recipient cap', () => {
  const DAY = 24 * 60 * 60_000;

  it('queues 3 registration e-mails to one address in 24 h, not a 4th, and warns once', async () => {
    const { deps, jobs, warnings } = fakeDeps();
    expect(RECIPIENT_DAILY_CAP).toBe(3);
    for (const id of ['reg-1', 'reg-2', 'reg-3']) await expect(queueRegistrationEmail(deps, id)).resolves.not.toBeNull();
    await expect(queueRegistrationEmail(deps, 'reg-4')).resolves.toBeNull();
    expect(jobs.size).toBe(3);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('reg-4');
    expect(warnings[0]).not.toContain('parinte@example.ro');
  });

  it('stops counting an e-mail once it is older than 24 h', async () => {
    const { deps, jobs, createdBefore } = fakeDeps();
    for (const id of ['reg-1', 'reg-2', 'reg-3']) await queueRegistrationEmail(deps, id);
    createdBefore('job-1', DAY + 1);
    await expect(queueRegistrationEmail(deps, 'reg-4')).resolves.not.toBeNull();
    expect(jobs.size).toBe(4);
  });

  it('never caps the admin resend', async () => {
    const { deps, jobs, sent, runDeferred } = fakeDeps();
    for (const id of ['reg-1', 'reg-2', 'reg-3']) await queueRegistrationEmail(deps, id);
    await runDeferred();
    await expect(resendRegistrationEmail(deps, 'reg-1', 'Admin')).resolves.toMatchObject({ ok: true });
    await expect(resendRegistrationEmail(deps, 'reg-2', 'Admin')).resolves.toMatchObject({ ok: true });
    expect(jobs.size).toBe(5);
    expect(sent).toHaveLength(5);
  });
});

describe('test recipient', () => {
  it('sends every e-mail outside production to EMAIL_TEST_RECIPIENT', async () => {
    const { deps, sent, jobs, runDeferred } = fakeDeps({ env: { ...ENV, NODE_ENV: 'development' } });
    const job = await queueRegistrationEmail(deps, 'reg-1');
    await runDeferred();
    expect(sent.map((m) => m.to)).toEqual(['test@codrin.space']);
    expect(jobs.get(job!.documentId)!.recipient).toBe('parinte@example.ro');
  });

  it('sends to the parent only in production with EMAIL_LIVE=true', async () => {
    const { deps, sent, runDeferred } = fakeDeps({ env: { ...ENV, NODE_ENV: 'production', EMAIL_LIVE: 'true', FRONTEND_ORIGIN: 'https://scoaladepatinaj.com' } });
    await queueRegistrationEmail(deps, 'reg-1');
    await runDeferred();
    expect(sent.map((m) => m.to)).toEqual(['parinte@example.ro']);
  });
});

describe('no Brevo key', () => {
  it('keeps the job queued, uncounted, and the cron does nothing', async () => {
    const { deps, jobs, sent, runDeferred, age } = fakeDeps({ env: { ...ENV, BREVO_API_KEY: '' } });
    const job = await queueRegistrationEmail(deps, 'reg-1');
    await runDeferred();
    age(job!.documentId);
    await expect(retryDueJobs(deps)).resolves.toEqual({ attempted: 0, skipped: 'no-key' });
    expect(jobs.get(job!.documentId)).toMatchObject({ status: 'queued', attempts: 0, lastError: null });
    expect(sent).toEqual([]);
  });

  it('sends the waiting job once a key is configured', async () => {
    const off = fakeDeps({ env: { ...ENV, BREVO_API_KEY: '' } });
    const job = await queueRegistrationEmail(off.deps, 'reg-1');
    await off.runDeferred();
    off.age(job!.documentId);
    const on = { ...off.deps, config: readEmailConfig(ENV) };
    await expect(retryDueJobs(on)).resolves.toEqual({ attempted: 1, skipped: null });
    expect(off.jobs.get(job!.documentId)).toMatchObject({ status: 'sent', attempts: 1 });
  });
});

describe('retries', () => {
  it('retries hourly and fails with one alert after 5 attempts', async () => {
    const { deps, jobs, alerts, runDeferred, age } = fakeDeps({ send: failing });
    const job = await queueRegistrationEmail(deps, 'reg-1');
    await runDeferred();
    for (let hour = 0; hour < 6; hour++) {
      age(job!.documentId);
      await retryDueJobs(deps);
    }
    expect(jobs.get(job!.documentId)).toMatchObject({ status: 'failed', attempts: 5, lastError: 'Brevo 500: down' });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain(job!.documentId);
    expect(alerts[0]).not.toContain('parinte@example.ro');
  });

  it('does not retry a job touched less than QUIET_MS ago', async () => {
    const { deps, jobs, runDeferred } = fakeDeps({ send: failing });
    const job = await queueRegistrationEmail(deps, 'reg-1');
    await runDeferred();
    expect(QUIET_MS).toBe(5 * 60_000);
    await expect(retryDueJobs(deps)).resolves.toEqual({ attempted: 0, skipped: null });
    expect(jobs.get(job!.documentId)!.attempts).toBe(1);
  });

  it('builds missing documents first, then sends them', async () => {
    const built: string[] = [];
    const { deps, jobs, sent, runDeferred } = fakeDeps({
      documents: [],
      build: async (id) => {
        built.push(id);
        return [DOCUMENTS[0]];
      },
    });
    const job = await queueRegistrationEmail(deps, 'reg-1');
    await runDeferred();
    expect(built).toEqual(['reg-1']);
    expect(sent[0].attachments).toEqual([{ name: 'Pop_Maria_Acord_2026-2027.pdf', content: Buffer.from('pdf:Pop_Maria_Acord_2026-2027.pdf').toString('base64') }]);
    expect(jobs.get(job!.documentId)).toMatchObject({ status: 'sent', attempts: 1 });
  });

  it('counts missing documents whose build fails as a failed attempt', async () => {
    const { deps, jobs, sent, runDeferred } = fakeDeps({ documents: [] });
    const job = await queueRegistrationEmail(deps, 'reg-1');
    await runDeferred();
    expect(sent).toEqual([]);
    expect(jobs.get(job!.documentId)).toMatchObject({ status: 'queued', attempts: 1, lastError: 'no documents built for this registration' });
  });

  it('fails after 5 attempts when documents stay missing, with one alert (not a skip that waits)', async () => {
    const { deps, jobs, alerts, runDeferred, age } = fakeDeps({ documents: [] });
    const job = await queueRegistrationEmail(deps, 'reg-1');
    await runDeferred();
    for (let hour = 0; hour < 4; hour++) {
      age(job!.documentId);
      await retryDueJobs(deps);
    }
    expect(jobs.get(job!.documentId)).toMatchObject({ status: 'failed', attempts: 5, lastError: 'no documents built for this registration' });
    expect(alerts).toHaveLength(1);
  });

  it('logs a job whose attempt throws and still tries the rest of the batch', async () => {
    const { deps, jobs, runDeferred, age } = fakeDeps({ send: failing });
    const first = await queueRegistrationEmail(deps, 'reg-1');
    const second = await queueRegistrationEmail(deps, 'reg-2');
    await runDeferred();
    age(first!.documentId);
    age(second!.documentId);
    const logs: string[] = [];
    const update = deps.jobs.update;
    const flaky: EmailDeps = {
      ...deps,
      jobs: {
        ...deps.jobs,
        update: async (id, data) => {
          if (id === first!.documentId) throw new Error('row gone');
          return update(id, data);
        },
      },
      log: (level, m) => {
        logs.push(`${level} ${m}`);
      },
    };
    await expect(retryDueJobs(flaky)).resolves.toEqual({ attempted: 2, skipped: null });
    expect(jobs.get(second!.documentId)!.attempts).toBe(2);
    expect(logs).toContain(`error [email-job] retry of job ${first!.documentId} crashed: row gone`);
  });

  it('fails a job whose registration was deleted, without an alert', async () => {
    const { deps, alerts } = fakeDeps();
    const row: EmailJobRow = { documentId: 'job-x', recipient: 'p@example.ro', subject: 's', registrationDocumentId: null, status: 'queued', attempts: 2, lastError: null, sentAt: null, updatedAt: LONG_AGO };
    const updated = await attemptJob({ ...deps, jobs: { ...deps.jobs, update: async (_id, data) => ({ ...row, ...data }) } }, row);
    expect(updated).toMatchObject({ status: 'failed', attempts: 2, lastError: 'registration deleted' });
    expect(alerts).toEqual([]);
  });

  it('leaves sent and failed jobs alone', async () => {
    const { deps, sent } = fakeDeps();
    const row: EmailJobRow = { documentId: 'job-s', recipient: 'p@example.ro', subject: 's', registrationDocumentId: 'reg-1', status: 'sent', attempts: 1, lastError: null, sentAt: LONG_AGO, updatedAt: LONG_AGO };
    await expect(attemptJob(deps, row)).resolves.toBe(row);
    await expect(attemptJob(deps, { ...row, status: 'failed' })).resolves.toEqual({ ...row, status: 'failed' });
    expect(sent).toEqual([]);
  });
});

describe('resendRegistrationEmail', () => {
  it('logs a history entry, sends a new job now and returns the status', async () => {
    const { deps, history, sent, runDeferred } = fakeDeps();
    await queueRegistrationEmail(deps, 'reg-1');
    await runDeferred();
    const result = await resendRegistrationEmail(deps, 'reg-1', 'admin@edusport.ro');
    expect(history).toEqual([
      { subjectId: 'reg-1', action: RESEND_ACTION, actor: 'admin@edusport.ro', changes: { recipient: 'parinte@example.ro', documents: ['Pop_Maria_Acord_2026-2027.pdf', 'Pop_Maria_Adeziune_2026-2027.pdf'] } },
    ]);
    expect(sent).toHaveLength(2);
    expect(result).toEqual({
      ok: true,
      status: { status: 'sent', recipient: 'parinte@example.ro', attempts: 1, lastError: null, sentAt: NOW.toISOString(), updatedAt: NOW.toISOString(), documents: ['Pop_Maria_Acord_2026-2027.pdf', 'Pop_Maria_Adeziune_2026-2027.pdf'] },
    });
  });

  it('reuses a job that is still queued instead of adding a second one', async () => {
    const { deps, jobs, runDeferred } = fakeDeps({ send: failing });
    await queueRegistrationEmail(deps, 'reg-1');
    await runDeferred();
    await resendRegistrationEmail(deps, 'reg-1', 'admin@edusport.ro');
    expect(jobs.size).toBe(1);
    expect([...jobs.values()][0]).toMatchObject({ status: 'queued', attempts: 1 });
  });

  it('builds missing documents first, then resends with them', async () => {
    const { deps, history, sent } = fakeDeps({ documents: [], build: async () => [DOCUMENTS[0]] });
    const result = await resendRegistrationEmail(deps, 'reg-1', 'admin@edusport.ro');
    expect(result).toMatchObject({ ok: true, status: { status: 'sent', documents: ['Pop_Maria_Acord_2026-2027.pdf'] } });
    expect(history[0].changes).toEqual({ recipient: 'parinte@example.ro', documents: ['Pop_Maria_Acord_2026-2027.pdf'] });
    expect(sent).toHaveLength(1);
  });

  it('refuses an unknown registration and one whose missing documents fail to build', async () => {
    await expect(resendRegistrationEmail(fakeDeps({ registration: null }).deps, 'x', 'a')).resolves.toEqual({ ok: false, code: 'not-found', error: RESEND_ERRORS['not-found'] });
    const empty = fakeDeps({ documents: [] });
    await expect(resendRegistrationEmail(empty.deps, 'reg-1', 'a')).resolves.toEqual({ ok: false, code: 'no-documents', error: RESEND_ERRORS['no-documents'] });
    expect(empty.history).toEqual([]);
  });

  it('with no key, logs the resend and leaves the job queued', async () => {
    const { deps, history, sent } = fakeDeps({ env: { ...ENV, BREVO_API_KEY: '' } });
    const result = await resendRegistrationEmail(deps, 'reg-1', 'admin@edusport.ro');
    expect(history).toHaveLength(1);
    expect(sent).toEqual([]);
    expect(result).toMatchObject({ ok: true, status: { status: 'queued', attempts: 0 } });
  });
});

describe('registrationEmailStatus', () => {
  it('reports none before any job, then the latest job', async () => {
    const { deps, runDeferred } = fakeDeps();
    await expect(registrationEmailStatus(deps, 'reg-1')).resolves.toMatchObject({ status: 'none', attempts: 0, recipient: 'parinte@example.ro' });
    await queueRegistrationEmail(deps, 'reg-1');
    await runDeferred();
    await expect(registrationEmailStatus(deps, 'reg-1')).resolves.toMatchObject({ status: 'sent', attempts: 1 });
  });

  it('is null for an unknown registration', async () => {
    await expect(registrationEmailStatus(fakeDeps({ registration: null }).deps, 'x')).resolves.toBeNull();
  });
});
