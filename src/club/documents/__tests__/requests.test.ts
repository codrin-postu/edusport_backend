import { afterEach, describe, expect, it, vi } from 'vitest';
import { expiredLinkUrl, pdfHeaders, readAdminRequest, readPublicRequest, touchesDocuments } from '../requests';
import { createDownloadToken } from '../token';

const ID = 'reg0000000000000000000001';
const NOW = new Date('2026-10-20T10:00:00.000Z');
afterEach(() => vi.unstubAllEnvs());

describe('document requests', () => {
  it('public: a valid token and a known kind', () => {
    vi.stubEnv('DOCUMENT_TOKEN_SECRET', 'a-test-secret-that-is-at-least-32-characters-long');
    const token = createDownloadToken(ID, NOW);
    expect(readPublicRequest({ token, kind: 'adeziune' }, NOW)).toEqual({ ok: true, registrationDocumentId: ID, kind: 'adeziune' });
    expect(readPublicRequest({ token, kind: 'contract' }, NOW)).toEqual({ ok: false, status: 400 });
    expect(readPublicRequest({ token: 'x.y', kind: 'acord' }, NOW)).toEqual({ ok: false, status: 410 });
    expect(readPublicRequest({ kind: 'acord' }, NOW)).toEqual({ ok: false, status: 410 });
  });

  it('admin: a safe id and a known kind', () => {
    expect(readAdminRequest({ documentId: ID, kind: 'acord' })).toEqual({ ok: true, registrationDocumentId: ID, kind: 'acord' });
    expect(readAdminRequest({ documentId: '../etc', kind: 'acord' })).toEqual({ ok: false, status: 400 });
    expect(readAdminRequest({ documentId: ID, kind: 'x' })).toEqual({ ok: false, status: 400 });
  });

  it('downloads are attachments, never cached or indexed', () => {
    expect(pdfHeaders('Maria_Pop_Acord_2026-2027.pdf')).toEqual({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="Maria_Pop_Acord_2026-2027.pdf"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex',
    });
    expect(pdfHeaders('a"b\r\n.pdf')['Content-Disposition']).toBe('attachment; filename="a_b__.pdf"');
  });

  it('sends an expired or invalid link to the site page /inscrieri/link-expirat', () => {
    expect(expiredLinkUrl({ FRONTEND_ORIGIN: 'https://scoaladepatinaj.com, https://www.scoaladepatinaj.com' })).toBe(
      'https://scoaladepatinaj.com/inscrieri/link-expirat',
    );
    expect(expiredLinkUrl({ NODE_ENV: 'development' })).toBe('http://localhost:3000/inscrieri/link-expirat');
    expect(expiredLinkUrl({ NODE_ENV: 'production' })).toBeNull();
  });

  it('only edits of printed fields rebuild the PDFs', () => {
    expect(touchesDocuments({ childName: 'Ana' })).toBe(true);
    expect(touchesDocuments({ membershipAnswer: 'nu' })).toBe(true);
    expect(touchesDocuments({ status: 'Contactat', internalNote: 'x', archived: true })).toBe(false);
  });
});
