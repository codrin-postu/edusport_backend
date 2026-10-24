import { describe, expect, it } from 'vitest';
import { SUBMIT_ERRORS } from '../../registration-submit';
import { finishSubmit, submitBlockedReason, type FinishDeps } from '../submit-response';
import type { StoredDocument } from '../types';

const OK = { ok: true as const, registrationNumber: '2026-0008', documentId: 'reg0000000000000000000001' };
const STORED: StoredDocument[] = [
  { kind: 'acord', fileName: 'Ana_Pop_Acord_2026-2027.pdf', path: '/x/a.pdf' },
  { kind: 'adeziune', fileName: 'Ana_Pop_Adeziune_2026-2027.pdf', path: '/x/b.pdf' },
];

function deps(over: Partial<FinishDeps> = {}) {
  const errors: string[] = [];
  const built: string[] = [];
  const d: FinishDeps = {
    buildDocuments: async (id) => {
      built.push(id);
      return STORED;
    },
    createToken: (id) => `token-for-${id}`,
    logError: (m) => {
      errors.push(m);
    },
    ...over,
  };
  return { d, errors, built };
}

describe('finishSubmit', () => {
  it('returns the number, the download token and the built kinds, never the internal id', async () => {
    const { d, built } = deps();
    const response = await finishSubmit(OK, d);
    expect(response).toEqual({ ok: true, registrationNumber: '2026-0008', downloadToken: 'token-for-reg0000000000000000000001', documents: ['acord', 'adeziune'] });
    expect(JSON.stringify(response)).not.toContain('"documentId"');
    expect(built).toEqual(['reg0000000000000000000001']);
  });

  it('keeps the registration when the PDFs fail, logs it, lists no documents', async () => {
    const { d, errors } = deps({
      buildDocuments: async () => {
        throw new Error('disk full');
      },
    });
    await expect(finishSubmit(OK, d)).resolves.toMatchObject({ ok: true, registrationNumber: '2026-0008', documents: [] });
    expect(errors[0]).toContain('2026-0008');
    expect(errors[0]).toContain('disk full');
  });

  it('passes a refused submit through without building anything', async () => {
    const { d, built } = deps();
    const refused = { ok: false as const, code: 'closed' as const, error: SUBMIT_ERRORS.closed };
    await expect(finishSubmit(refused, d)).resolves.toEqual(refused);
    expect(built).toEqual([]);
  });
});

describe('submitBlockedReason', () => {
  it('refuses submits in production without DOCUMENT_TOKEN_SECRET', () => {
    expect(submitBlockedReason({ NODE_ENV: 'production' })).toEqual({ ok: false, code: 'save-failed', error: SUBMIT_ERRORS['save-failed'] });
    expect(submitBlockedReason({ NODE_ENV: 'production', DOCUMENT_TOKEN_SECRET: 'x'.repeat(32) })).toBeNull();
    expect(submitBlockedReason({ NODE_ENV: 'development' })).toBeNull();
  });
});
