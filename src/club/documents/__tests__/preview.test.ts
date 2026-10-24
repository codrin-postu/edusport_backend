import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { it } from 'vitest';
import { renderDocument } from '../pdf/render';
import type { DocumentSeason } from '../types';
import { blankValues, registrationValues } from '../values';

/** Visual check only: DOCUMENT_PREVIEW_DIR=<dir> npx vitest run src/club/documents/__tests__/preview.test.ts */
const OUT = process.env.DOCUMENT_PREVIEW_DIR;
const SEASON: DocumentSeason = { label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', membershipFee: 270 };
// The mockups' own invented sample (document-v4.html, gen_adeziune.py).
const SAMPLE = {
  documentId: 'reg0000000000000000000001',
  registrationNumber: '2026-0142',
  parentName: 'Mihaela Dumitrescu',
  phone: '07xx xxx xxx',
  email: 'parinte@exemplu.ro',
  relationship: 'parinte',
  childName: 'Maria Dumitrescu',
  childBirthDate: '2014-03-14',
  membershipAnswer: 'da',
  submittedAt: '2026-10-03T08:00:00.000Z',
};

it.runIf(Boolean(OUT))('writes the four PDFs for the visual check', async () => {
  const dir = path.resolve(OUT as string);
  mkdirSync(dir, { recursive: true });
  const filled = registrationValues(SAMPLE, SEASON);
  writeFileSync(path.join(dir, 'acord.pdf'), await renderDocument('acord', filled));
  writeFileSync(path.join(dir, 'adeziune.pdf'), await renderDocument('adeziune', filled));
  writeFileSync(path.join(dir, 'acord-gol.pdf'), await renderDocument('acord', blankValues(SEASON)));
  writeFileSync(path.join(dir, 'adeziune-gol.pdf'), await renderDocument('adeziune', blankValues(SEASON)));
});
