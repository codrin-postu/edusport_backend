import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOWNLOAD_TOKEN_TTL_MS, DocumentTokenSecretMissingError, createDownloadToken, documentTokenSecret, verifyDownloadToken } from '../token';

const ID = 'reg0000000000000000000001';
const OTHER = 'reg0000000000000000000002';
const NOW = new Date('2026-10-20T10:00:00.000Z');
const SECRET = 'a-test-secret-that-is-at-least-32-characters-long';

afterEach(() => vi.unstubAllEnvs());

describe('24-hour download token', () => {
  it('opens the registration it was made for, until 24 hours later', () => {
    vi.stubEnv('DOCUMENT_TOKEN_SECRET', SECRET);
    const token = createDownloadToken(ID, NOW);
    expect(verifyDownloadToken(token, NOW)).toEqual({ registrationDocumentId: ID });
    expect(verifyDownloadToken(token, new Date(NOW.getTime() + DOWNLOAD_TOKEN_TTL_MS - 1))).toEqual({ registrationDocumentId: ID });
  });

  it('is refused once expired', () => {
    vi.stubEnv('DOCUMENT_TOKEN_SECRET', SECRET);
    const token = createDownloadToken(ID, NOW);
    expect(verifyDownloadToken(token, new Date(NOW.getTime() + DOWNLOAD_TOKEN_TTL_MS))).toBeNull();
  });

  it('cannot be changed to open another registration', () => {
    vi.stubEnv('DOCUMENT_TOKEN_SECRET', SECRET);
    const [, signature] = createDownloadToken(ID, NOW).split('.');
    const forged = `${Buffer.from(`${OTHER}.${NOW.getTime() + DOWNLOAD_TOKEN_TTL_MS}`).toString('base64url')}.${signature}`;
    expect(verifyDownloadToken(forged, NOW)).toBeNull();
  });

  it('is refused when signed with another secret, or malformed', () => {
    vi.stubEnv('DOCUMENT_TOKEN_SECRET', SECRET);
    const token = createDownloadToken(ID, NOW);
    vi.stubEnv('DOCUMENT_TOKEN_SECRET', `${SECRET}-rotated`);
    expect(verifyDownloadToken(token, NOW)).toBeNull();
    for (const bad of ['', 'abc', 'a.b.c', null, 42]) expect(verifyDownloadToken(bad, NOW)).toBeNull();
  });

  it('fails closed in production without a secret (32+ characters)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DOCUMENT_TOKEN_SECRET', 'too-short');
    expect(documentTokenSecret()).toBeNull();
    expect(() => createDownloadToken(ID, NOW)).toThrow(DocumentTokenSecretMissingError);
    expect(verifyDownloadToken('x.y', NOW)).toBeNull();
  });

  it('works locally without a secret', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DOCUMENT_TOKEN_SECRET', '');
    expect(verifyDownloadToken(createDownloadToken(ID, NOW), NOW)).toEqual({ registrationDocumentId: ID });
  });
});
