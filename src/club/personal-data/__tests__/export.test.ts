import { unzipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { athleteRow, fakeClubStore, registrationRow } from '../../athletes/__tests__/fake-store';
import { ADMIN_ERRORS } from '../../athletes/errors';
import { pdfText } from '../../documents/__tests__/pdf-text';
import { HISTORY_ACTIONS } from '../../history-text';
import { exportAthleteData, type ExportContext, type ExportDocument } from '../export-service';
import { exportFileName, zipExport, zipHeaders } from '../export-zip';

vi.setConfig({ testTimeout: 30_000 });

const NOW = new Date('2026-10-27T10:00:00.000Z');
const PDF = new Uint8Array([37, 80, 68, 70, 45, 49]);

function setup(
  stored: Record<string, ExportDocument[]> = { r1: [{ kind: 'acord', fileName: 'Ilinca-Zamfirescu_Acord_2026-2027.pdf', data: PDF }] },
  registrationRecords: Record<string, Record<string, unknown>> = { r1: { relationship: 'parinte', gdprConsent: true, regulationsConsent: true } },
) {
  const fake = fakeClubStore({
    athletes: [
      athleteRow({ id: 'a1', name: 'Ilinca Zamfirescu', birthDate: '2013-04-27', contactName: 'Dana Zamfirescu', phone: '0799 123 456', email: 'dana@example.com' }),
      athleteRow({ id: 'a9', name: 'Sportiv anonimizat', status: 'anonimizat' }),
    ],
    registrations: [
      registrationRow({ id: 'r1', childName: 'Ilinca Zamfirescu', athleteId: 'a1', status: 'Confirmat', membershipAnswer: 'da' }),
      registrationRow({ id: 'r4', number: '2019-0007', season: '2019-2020', seasonId: null, childName: 'Ilinca Zamfirescu', athleteId: 'a1', membershipAnswer: null }),
    ],
    registrationRecords,
    memberships: [{ id: 'gm1', athleteId: 'a1', groupId: 'g-pp', seasonId: 's26', isMain: true, from: null }],
    acs: [{ id: 'acs1', athleteId: 'a1', seasonId: 's26', state: 'da' }],
    admins: { 'ana@example.com': 'Ana Admin' },
  });
  const logs: string[] = [];
  const ctx: ExportContext = {
    store: fake.store, actor: 'ana@example.com', today: { year: 2026, month: 10, day: 27 }, log: (m) => logs.push(m),
    storedDocuments: async (id) => stored[id] ?? [], now: () => NOW,
  };
  return { fake, ctx, logs };
}

const files = (zip: Uint8Array) => unzipSync(zip);
const fileNames = (zip: Uint8Array) => Object.keys(files(zip)).filter((n) => !n.endsWith('/')).sort();

describe('ZIP (spec 3)', () => {
  it('names the file after the child and the Bucharest date', () => {
    expect(exportFileName('Ilinca Zamfirescu', NOW)).toBe('date-ilinca-zamfirescu-2026-10-27.zip');
    expect(exportFileName('Ștefan Țăranu', new Date('2026-10-27T22:30:00.000Z'))).toBe('date-stefan-taranu-2026-10-28.zip');
    expect(exportFileName(null, NOW)).toBe('date-sportiv-2026-10-27.zip');
  });

  it('holds rezumat.pdf and each registration PDF under inscrieri/<nr>/', () => {
    const zip = zipExport(PDF, [{ folder: '2026-0142', fileName: 'A.pdf', data: PDF }, { folder: '2026-0142', fileName: 'B.pdf', data: PDF }]);
    expect(fileNames(zip)).toEqual(['inscrieri/2026-0142/A.pdf', 'inscrieri/2026-0142/B.pdf', 'rezumat.pdf']);
    expect(fileNames(zipExport(PDF, []))).toEqual(['rezumat.pdf']);
  });

  it('is sent as a private download', () => {
    expect(zipHeaders('date-x-2026-10-27.zip')).toEqual({
      'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="date-x-2026-10-27.zip"',
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex',
    });
  });
});

describe('export service (spec 3)', () => {
  it('builds the ZIP: summary plus the stored PDFs as they are', async () => {
    const { ctx } = setup();
    const result = await exportAthleteData(ctx, 'a1');
    if (result.ok !== true) throw new Error('export refused');
    expect(result.data.fileName).toBe('date-ilinca-zamfirescu-2026-10-27.zip');
    expect(fileNames(result.data.data)).toEqual(['inscrieri/2026-0142/Ilinca-Zamfirescu_Acord_2026-2027.pdf', 'rezumat.pdf']);
    expect(files(result.data.data)['inscrieri/2026-0142/Ilinca-Zamfirescu_Acord_2026-2027.pdf']).toEqual(PDF);
  });

  it('the summary lists a missing PDF as "Document indisponibil", never for an old registration without PDFs', async () => {
    const { ctx } = setup();
    const result = await exportAthleteData(ctx, 'a1');
    if (result.ok !== true) throw new Error('export refused');
    const { text } = await pdfText(Buffer.from(files(result.data.data)['rezumat.pdf']));
    expect(text).toContain('Date personale: Ilinca Zamfirescu');
    expect(text).toContain('Înscrierea 2026-0142');
    expect(text).toContain('Înscrierea 2019-0007');
    expect(text.match(/Document indisponibil/g)).toHaveLength(1);
    expect(text).toContain('Generat la 27.10.2026, 12:00, de Ana Admin.');
  });

  it('writes "Date exportate" after a successful export; a failed history write still delivers', async () => {
    const { fake, ctx, logs } = setup();
    await exportAthleteData(ctx, 'a1');
    expect(fake.state.history.filter((h) => h.action === HISTORY_ACTIONS.dataExported)).toEqual([
      expect.objectContaining({ subjectId: 'a1', actor: 'ana@example.com', changes: {} }),
    ]);
    fake.failOn('record');
    expect((await exportAthleteData(ctx, 'a1')).ok).toBe(true);
    expect(logs.join('\n')).toContain('export history of a1');
  });

  it('rezumat.pdf never names another child: a dismissed pair and a link to another child\'s record are left out', async () => {
    const { fake, ctx } = setup();
    const at = '2026-10-20T10:00:00.000Z';
    fake.state.history.push(
      { seq: 1, subjectType: 'athlete', subjectId: 'a1', action: HISTORY_ACTIONS.duplicateDismissed, changes: { name: 'Maria Ionescu', otherAthleteId: 'a2' }, actor: 'ana@example.com', at },
      { seq: 2, subjectType: 'athlete', subjectId: 'a1', action: HISTORY_ACTIONS.merged, changes: { name: 'Ilinca Zamfirescu' }, actor: 'ana@example.com', at },
      { seq: 3, subjectType: 'registration-submission', subjectId: 'r1', action: HISTORY_ACTIONS.confirmed, changes: { athleteName: 'Ana Popescu', createdAthlete: false }, actor: 'ana@example.com', at },
      { seq: 4, subjectType: 'registration-submission', subjectId: 'r1', action: HISTORY_ACTIONS.athleteUnlinked, changes: { name: 'Ana Popescu' }, actor: 'ana@example.com', at },
    );
    const result = await exportAthleteData(ctx, 'a1');
    if (result.ok !== true) throw new Error('export refused');
    const { text } = await pdfText(Buffer.from(files(result.data.data)['rezumat.pdf']));
    for (const s of ['Maria', 'Ionescu', 'Popescu', 'Nu e același copil']) expect(text, s).not.toContain(s);
    expect(text).toContain('Unit cu Ilinca Zamfirescu');
  });

  it('unknown or anonymized: 404; a build failure: the shared text and no history line', async () => {
    const { fake, ctx } = setup();
    expect(await exportAthleteData(ctx, 'ghost')).toEqual({ ok: false, status: 404, error: ADMIN_ERRORS.notFound });
    expect(await exportAthleteData(ctx, 'a9')).toEqual({ ok: false, status: 404, error: ADMIN_ERRORS.notFound });
    ctx.storedDocuments = async () => { throw new Error('EIO'); };
    expect(await exportAthleteData(ctx, 'a1')).toEqual({ ok: false, status: 500, error: ADMIN_ERRORS.failed });
    expect(fake.state.history).toEqual([]);
  });

  it('never leaks a raw registration row\'s private fields (submissionKey, confirmation internals) into the ZIP', async () => {
    const { ctx } = setup(
      { r1: [{ kind: 'acord', fileName: 'Ilinca-Zamfirescu_Acord_2026-2027.pdf', data: PDF }] },
      {
        r1: {
          relationship: 'parinte', gdprConsent: true, regulationsConsent: true,
          submissionKey: 'SECRET-SUBMISSION-KEY-9f8e7d',
          confirmation: { internalNote: 'CONFIDENTIAL-INTERNAL-NOTE', token: 'CONFIRM-TOKEN-xyz' },
        },
      },
    );
    const result = await exportAthleteData(ctx, 'a1');
    if (result.ok !== true) throw new Error('export refused');
    const forbidden = ['SECRET-SUBMISSION-KEY-9f8e7d', 'CONFIDENTIAL-INTERNAL-NOTE', 'CONFIRM-TOKEN-xyz', 'submissionKey', 'confirmation'];
    for (const name of fileNames(result.data.data)) for (const needle of forbidden) expect(name).not.toContain(needle);
    const rezumat = Buffer.from(files(result.data.data)['rezumat.pdf']);
    const { text: summaryText } = await pdfText(rezumat);
    for (const needle of forbidden) expect(summaryText).not.toContain(needle);
  });
});
