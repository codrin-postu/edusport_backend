import { describe, expect, it } from 'vitest';
import { queueEmailAfterSubmit } from '../after-submit';

describe('queueEmailAfterSubmit', () => {
  it('queues the e-mail for a saved registration', async () => {
    const queued: string[] = [];
    await queueEmailAfterSubmit({ ok: true, documentId: 'reg-doc' }, async (id) => {
      queued.push(id);
    }, () => undefined);
    expect(queued).toEqual(['reg-doc']);
  });

  it('queues nothing for a refused submit', async () => {
    const queued: string[] = [];
    await queueEmailAfterSubmit({ ok: false }, async (id) => {
      queued.push(id);
    }, () => undefined);
    expect(queued).toEqual([]);
  });

  it('never throws when queueing fails, and logs it', async () => {
    const errors: string[] = [];
    const failing = async (): Promise<void> => {
      throw new Error('db down');
    };
    await expect(queueEmailAfterSubmit({ ok: true, documentId: 'reg-doc' }, failing, (m) => errors.push(m))).resolves.toBeUndefined();
    expect(errors).toEqual(['[inscriere] e-mail not queued for reg-doc: db down']);
  });
});
