import { describe, expect, it, vi } from 'vitest';
import { buildHistoryEntry, recordHistory } from '../history';

describe('buildHistoryEntry', () => {
  it('stamps the time', () => {
    const e = buildHistoryEntry({ subjectType: 'athlete', subjectId: 'a1', action: 'created', actor: 'migrare' }, new Date('2026-10-19T08:00:00Z'));
    expect(e).toEqual({ subjectType: 'athlete', subjectId: 'a1', action: 'created', actor: 'migrare', at: '2026-10-19T08:00:00.000Z' });
  });
  it('rejects a missing actor', () =>
    expect(() => buildHistoryEntry({ subjectType: 'athlete', subjectId: 'a1', action: 'created', actor: '' })).toThrow());
});

describe('recordHistory', () => {
  it('writes through the document service', async () => {
    const create = vi.fn().mockResolvedValue({});
    await recordHistory({ documents: () => ({ create }) }, { subjectType: 'group', subjectId: 'g1', action: 'created', actor: 'migrare' });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ subjectType: 'group', subjectId: 'g1', action: 'created', actor: 'migrare' }) });
  });
});
