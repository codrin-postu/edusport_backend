import { describe, expect, it } from 'vitest';
import { readHistory } from '../history-read';
import { fakeClubStore } from './fake-store';

describe('Istoric (spec 1.6, 3b Q23)', () => {
  it('newest first, actor by name, several lines of one entry kept in order', async () => {
    const fake = fakeClubStore({ admins: { 'ana@club.ro': 'Ana Pop' } });
    await fake.store.record({ subjectType: 'athlete', subjectId: 'a1', action: 'created-from-profile', actor: 'migrare' });
    await fake.store.record({ subjectType: 'athlete', subjectId: 'a1', action: 'updated', actor: 'ana@club.ro', changes: { fields: { phone: { from: null, to: '07' }, email: { from: null, to: 'e' } } } });
    const lines = await readHistory(fake.store, 'athlete', 'a1');
    expect(lines.map((l) => [l.actor, l.text])).toEqual([
      ['Ana Pop', 'Telefon: "" → "07"'],
      ['Ana Pop', 'E-mail: "" → "e"'],
      ['Migrare', 'Fișă creată din profilul public existent'],
    ]);
  });

  it('shows "Înscriere înregistrată" from submittedAt for an older registration without the row (r4 e10)', async () => {
    const fake = fakeClubStore();
    await fake.store.record({ subjectType: 'registration-submission', subjectId: 'r1', action: 'document-rebuilt', actor: 'ana@club.ro', changes: { documents: [] } });
    const lines = await readHistory(fake.store, 'registration-submission', 'r1', '2026-10-03T11:22:00.000Z');
    expect(lines.map((l) => l.text)).toEqual(['Document refăcut', 'Înscriere înregistrată']);
    expect(lines[1].at).toBe('2026-10-03T11:22:00.000Z');
  });

  it('does not add it twice', async () => {
    const fake = fakeClubStore();
    await fake.store.record({ subjectType: 'registration-submission', subjectId: 'r1', action: 'submitted', actor: 'formular' });
    expect(await readHistory(fake.store, 'registration-submission', 'r1', '2026-10-03T11:22:00.000Z')).toHaveLength(1);
  });
});
