import { describe, expect, it } from 'vitest';
import { deleteRegistrationsWithDocuments, type BulkDeleteDeps } from '../bulk-delete';

function fake(over: Partial<BulkDeleteDeps> = {}) {
  const calls: string[] = [];
  const errors: string[] = [];
  const deps: BulkDeleteDeps = {
    findIds: async () => {
      calls.push('find');
      return ['reg0000000000000000000001', 'reg0000000000000000000002', 'reg0000000000000000000003'];
    },
    deleteEmailJobs: async (ids) => {
      calls.push(`delete e-mail jobs ${ids.join(',')}`);
    },
    deleteRows: async (ids) => {
      calls.push(`delete rows ${ids.join(',')}`);
      return ids.length;
    },
    deleteDocuments: async (id) => {
      calls.push(`delete documents ${id}`);
    },
    logError: (m) => {
      errors.push(m);
    },
    ...over,
  };
  return { deps, calls, errors };
}

describe('deleteRegistrationsWithDocuments (delete archived season)', () => {
  it('reads the ids first, deletes their e-mail jobs, the rows, then every registration folder', async () => {
    const { deps, calls } = fake();
    await expect(deleteRegistrationsWithDocuments(deps)).resolves.toBe(3);
    expect(calls).toEqual([
      'find',
      'delete e-mail jobs reg0000000000000000000001,reg0000000000000000000002,reg0000000000000000000003',
      'delete rows reg0000000000000000000001,reg0000000000000000000002,reg0000000000000000000003',
      'delete documents reg0000000000000000000001',
      'delete documents reg0000000000000000000002',
      'delete documents reg0000000000000000000003',
    ]);
  });

  it('logs a folder that fails and still removes the others', async () => {
    const removed: string[] = [];
    const { deps, errors } = fake({
      deleteDocuments: async (id) => {
        if (id.endsWith('2')) throw new Error('EACCES');
        removed.push(id);
      },
    });
    await expect(deleteRegistrationsWithDocuments(deps)).resolves.toBe(3);
    expect(removed).toEqual(['reg0000000000000000000001', 'reg0000000000000000000003']);
    expect(errors).toEqual(['[inscrieri] deleting documents of reg0000000000000000000002 failed: EACCES']);
  });

  it('deletes nothing when no registration matches', async () => {
    const { deps, calls } = fake({
      findIds: async () => {
        calls.push('find');
        return [];
      },
    });
    await expect(deleteRegistrationsWithDocuments(deps)).resolves.toBe(0);
    expect(calls).toEqual(['find']);
  });

  it('keeps the rows and folders when deleting the e-mail jobs fails', async () => {
    const { deps, calls } = fake({
      deleteEmailJobs: async () => {
        throw new Error('database down');
      },
    });
    await expect(deleteRegistrationsWithDocuments(deps)).rejects.toThrow('database down');
    expect(calls).toEqual(['find']);
  });

  it('removes no folder when deleting the rows fails', async () => {
    const { deps, calls } = fake({
      deleteRows: async () => {
        throw new Error('database down');
      },
    });
    await expect(deleteRegistrationsWithDocuments(deps)).rejects.toThrow('database down');
    expect(calls).toEqual(['find', 'delete e-mail jobs reg0000000000000000000001,reg0000000000000000000002,reg0000000000000000000003']);
  });
});
