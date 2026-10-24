import { beforeEach, describe, expect, it } from 'vitest';
import { getForm } from '../registry';
import { installStrapi } from './fakes.test.helper';

const newRow = { documentId: 'new-1', season: '2026-2027', membershipAnswer: 'da', registrationNumber: '2026-0001' };
const oldRow = { documentId: 'old-1', season: '2025-2026', childName: 'Ana' };

describe('form descriptors and per-tab plans', () => {
  beforeEach(() => {
    getForm('inscrieri').invalidate();
    getForm('voluntari').invalidate();
  });

  it('reads registrations with the name of their school, oldest first', async () => {
    const { findMany } = installStrapi([oldRow, newRow]);
    await getForm('inscrieri').fetchAll();
    expect(findMany).toHaveBeenCalledWith({
      sort: { submittedAt: 'asc' },
      limit: 5000,
      populate: { section: { fields: ['name'] }, emailJobs: { fields: ['status', 'sentAt', 'createdAt'] } },
    });
  });

  it('reads queued registrations by id with the same relations, and nothing for no ids', async () => {
    const { findMany } = installStrapi([oldRow, newRow]);
    const rows = await getForm('inscrieri').fetchByIds(['new-1']);
    expect(rows.map((r) => r.documentId)).toEqual(['new-1']);
    expect(findMany).toHaveBeenCalledWith({
      filters: { documentId: { $in: ['new-1'] } },
      limit: 1,
      populate: { section: { fields: ['name'] }, emailJobs: { fields: ['status', 'sentAt', 'createdAt'] } },
    });
    findMany.mockClear();
    expect(await getForm('inscrieri').fetchByIds([])).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('plans each Înscrieri tab from its own rows', async () => {
    installStrapi([oldRow, newRow]);
    const plans = await getForm('inscrieri').resolveTabPlans();
    expect(plans.forTab('2026-2027').header[0]).toBe('Nr. înscriere');
    expect(plans.forTab('2025-2026').header[0]).toBe('Trimis la');
  });

  it('reuses the tab plans for a short while, until invalidated', async () => {
    const { findMany } = installStrapi([oldRow, newRow]);
    await getForm('inscrieri').resolveTabPlans();
    await getForm('inscrieri').resolveTabPlans();
    expect(findMany).toHaveBeenCalledTimes(1);
    getForm('inscrieri').invalidate();
    await getForm('inscrieri').resolveTabPlans();
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it('gives the single-tab forms one plan for every tab, read without relations', async () => {
    const { findMany } = installStrapi([]);
    const plans = await getForm('voluntari').resolveTabPlans();
    expect(plans.forTab('a').header).toEqual(plans.forTab('b').header);
    expect(findMany).toHaveBeenCalledWith({ sort: { submittedAt: 'asc' }, limit: 5000 });
  });
});
