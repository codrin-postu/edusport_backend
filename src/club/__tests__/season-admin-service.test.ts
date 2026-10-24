import { describe, expect, it } from 'vitest';
import type { HistoryInput } from '../history';
import { SEASON_ERRORS, seasonExistsError, type RawAdminSeason, type SeasonWriteData } from '../season-admin';
import { createSeason, listAdminSeasons, updateSeason, type SeasonStore } from '../season-admin-service';

const fields = { label: '2026-2027', startMonth: '2026-10', endMonth: '2027-05', membershipFee: 270 };

function fakeStore(registrations = 0) {
  const rows: RawAdminSeason[] = [
    { documentId: 'old', label: '2025-2026', startMonth: '2025-10-04', endMonth: '2026-05-31', membershipFee: 250, isCurrent: false },
    { documentId: 'cur', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', membershipFee: 270, isCurrent: true },
  ];
  const history: HistoryInput[] = [];
  const writes: { documentId: string; data: SeasonWriteData }[] = [];
  const store: SeasonStore = {
    all: async () => rows,
    find: async (id) => rows.find((r) => r.documentId === id) ?? null,
    labelTaken: async (label, exceptId) => rows.some((r) => r.label === label && r.documentId !== exceptId),
    registrations: async (id) => (id === 'cur' ? registrations : 0),
    create: async (data) => {
      rows.push({ ...data, documentId: 'new' });
      return 'new';
    },
    update: async (documentId, data) => {
      writes.push({ documentId, data });
      Object.assign(rows.find((r) => r.documentId === documentId)!, data);
    },
    record: async (entry) => {
      history.push(entry);
    },
  };
  return { store, history, writes, rows };
}

describe('listAdminSeasons', () => {
  it('newest first, with months and registration counts', async () => {
    const list = await listAdminSeasons(fakeStore(3).store);
    expect(list.map((s) => [s.label, s.startMonth, s.isCurrent, s.registrations])).toEqual([
      ['2026-2027', '2026-10', true, 3],
      ['2025-2026', '2025-10', false, 0],
    ]);
  });
});

describe('createSeason', () => {
  it('creates a season that is not current and records it', async () => {
    const { store, history, rows } = fakeStore();
    const r = await createSeason(store, { ...fields, label: '2027-2028', startMonth: '2027-10', endMonth: '2028-05' }, 'ana@club.ro');
    expect(r.ok && r.data[0]).toMatchObject({ label: '2027-2028', isCurrent: false });
    expect(rows[rows.length - 1]).toMatchObject({ isCurrent: false, startMonth: '2027-10-01', endMonth: '2028-05-31' });
    expect(history[0]).toMatchObject({ subjectType: 'season', subjectId: 'new', action: 'created', actor: 'ana@club.ro', changes: { label: { from: null, to: '2027-2028' } } });
  });

  it('refuses a label that exists', async () => {
    await expect(createSeason(fakeStore().store, fields, 'a')).resolves.toEqual({ ok: false, status: 409, error: seasonExistsError('2026-2027') });
  });
});

describe('updateSeason', () => {
  it('changes the fee, keeps the stored dates and records old -> new', async () => {
    const { store, history, writes } = fakeStore(5);
    await expect(updateSeason(store, 'old', { ...fields, label: '2025-2026', startMonth: '2025-10', endMonth: '2026-05', membershipFee: 260 }, 'a')).resolves.toMatchObject({ ok: true });
    expect(writes[0].data).toEqual({ label: '2025-2026', startMonth: '2025-10-04', endMonth: '2026-05-31', membershipFee: 260 });
    expect(history[0]).toMatchObject({ action: 'updated', changes: { membershipFee: { from: 250, to: 260 } } });
  });

  it('writes nothing when nothing changed', async () => {
    const { store, history, writes } = fakeStore();
    await updateSeason(store, 'cur', fields, 'a');
    expect(writes).toEqual([]);
    expect(history).toEqual([]);
  });

  it('locks the label of a season with registrations', async () => {
    const { store, writes } = fakeStore(2);
    await expect(updateSeason(store, 'cur', { ...fields, label: '2027-2028' }, 'a')).resolves.toEqual({ ok: false, status: 409, error: SEASON_ERRORS.locked });
    expect(writes).toEqual([]);
  });

  it('refuses a label used by another season, and a missing season', async () => {
    const { store } = fakeStore();
    await expect(updateSeason(store, 'cur', { ...fields, label: '2025-2026' }, 'a')).resolves.toEqual({ ok: false, status: 409, error: seasonExistsError('2025-2026') });
    await expect(updateSeason(store, 'nope', fields, 'a')).resolves.toEqual({ ok: false, status: 404, error: SEASON_ERRORS.missing });
  });
});
