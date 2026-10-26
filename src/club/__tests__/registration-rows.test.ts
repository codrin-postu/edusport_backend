import { describe, expect, it } from 'vitest';
import { planRegistrationNumbering, planSeasonTextNormalization, type RegistrationRowForMigration } from '../migrate/registration-rows';

const row = (over: Partial<RegistrationRowForMigration> & { documentId: string }): RegistrationRowForMigration => ({
  season: '2026-2027',
  submittedAt: null,
  registrationNumber: null,
  seasonRef: null,
  section: null,
  ...over,
});

describe('planSeasonTextNormalization', () => {
  it('rewrites en-dash and spaced season texts to the hyphen label and counts them per old text', () => {
    const plan = planSeasonTextNormalization([
      { documentId: 'r1', season: '2026–2027' },
      { documentId: 'r2', season: '2026–2027' },
      { documentId: 'r3', season: ' 2025 - 2026 ' },
      { documentId: 'r4', season: '2026-2027' },
    ]);
    expect(plan.updates).toEqual([
      { documentId: 'r1', from: '2026–2027', to: '2026-2027' },
      { documentId: 'r2', from: '2026–2027', to: '2026-2027' },
      { documentId: 'r3', from: ' 2025 - 2026 ', to: '2025-2026' },
    ]);
    expect(plan.rewrites).toEqual([
      { from: '2026–2027', to: '2026-2027', count: 2 },
      { from: ' 2025 - 2026 ', to: '2025-2026', count: 1 },
    ]);
    expect(plan.unrecognised).toEqual([]);
  });

  it('never writes a text that is no season, and skips empty ones', () => {
    const plan = planSeasonTextNormalization([
      { documentId: 'r1', season: 'toamna' },
      { documentId: 'r2', season: '2026–2028' },
      { documentId: 'r3', season: null },
      { documentId: 'r4', season: '' },
    ]);
    expect(plan.updates).toEqual([]);
    expect(plan.unrecognised).toEqual(['toamna', '2026–2028']);
  });

  it('has nothing to do once every text is normalized', () => {
    expect(planSeasonTextNormalization([{ documentId: 'r1', season: '2026-2027' }]).updates).toEqual([]);
  });
});

describe('planRegistrationNumbering', () => {
  const seasons = { '2026-2027': 'season2026' };

  it('numbers unnumbered rows after the highest number of their start year, with the Sezon and school links', () => {
    const plan = planRegistrationNumbering(
      [
        row({ documentId: 'r1', registrationNumber: '2026-0004', seasonRef: 'season2026', section: 'school1' }),
        row({ documentId: 'r2', season: '2026–2027', submittedAt: '2026-10-02T10:00:00.000Z' }),
        row({ documentId: 'r3', submittedAt: '2026-10-01T10:00:00.000Z' }),
      ],
      seasons,
      'school1',
    );
    expect(plan.number).toEqual([
      { documentId: 'r3', data: { registrationNumber: '2026-0005', seasonRef: 'season2026', section: 'school1' } },
      { documentId: 'r2', data: { registrationNumber: '2026-0006', seasonRef: 'season2026', section: 'school1' } },
    ]);
    expect(plan.link).toEqual([]);
    expect(plan.skipped).toEqual([]);
  });

  it('keeps existing links, leaves the Sezon link unset when no Sezon matches, and skips rows with no season', () => {
    const plan = planRegistrationNumbering(
      [
        row({ documentId: 'r1', seasonRef: 'seasonOld', section: 'school2' }),
        row({ documentId: 'r2', season: '2030-2031' }),
        row({ documentId: 'r3', season: null }),
      ],
      seasons,
      null,
    );
    expect(plan.number).toEqual([
      { documentId: 'r1', data: { registrationNumber: '2026-0001' } },
      { documentId: 'r2', data: { registrationNumber: '2030-0001' } },
    ]);
    expect(plan.skipped).toEqual(['r3']);
  });

  it('links a numbered row with no Sezon link when its season has a Sezon, and is idempotent', () => {
    const rows = [
      row({ documentId: 'r1', season: '2026–2027', registrationNumber: '2026-0001' }),
      row({ documentId: 'r2', season: '2030-2031', registrationNumber: '2030-0001' }),
      row({ documentId: 'r3', registrationNumber: '2026-0002', seasonRef: 'season2026' }),
    ];
    const plan = planRegistrationNumbering(rows, seasons, 'school1');
    expect(plan.number).toEqual([]);
    expect(plan.link).toEqual([{ documentId: 'r1', seasonRef: 'season2026' }]);
    const after = rows.map((r) => (r.documentId === 'r1' ? { ...r, seasonRef: 'season2026' } : r));
    expect(planRegistrationNumbering(after, seasons, 'school1').link).toEqual([]);
  });
});
