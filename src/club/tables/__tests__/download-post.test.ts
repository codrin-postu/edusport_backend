import { afterEach, describe, expect, it, vi } from 'vitest';
import { blobErrorText, downloadPost } from '../../../admin/dashboard/inscrieri/downloadPdf';

/** The Strapi fetch client reads every POST answer as JSON, so a csv answer failed to parse: downloads use fetch with the token. */
describe('downloadPost', () => {
  afterEach(() => vi.unstubAllGlobals());

  function browser(res: Response) {
    const fetchMock = vi.fn(async () => res);
    const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('document', { createElement: () => link, body: { appendChild: vi.fn() } });
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() });
    return { fetchMock, link };
  }

  it('posts the body with the Bearer token and saves the file under the server name', async () => {
    const { fetchMock, link } = browser(new Response('a;b\r\n', { status: 200, headers: { 'content-disposition': 'attachment; filename="tabel-sportivi-2026-11-08.csv"' } }));
    await downloadPost('tok', '/api/club/tables/export', { format: 'csv' }, 'fallback.csv');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/club/tables/export');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(init.body).toBe('{"format":"csv"}');
    expect(link.download).toBe('tabel-sportivi-2026-11-08.csv');
    expect(link.click).toHaveBeenCalled();
  });

  it('throws an error whose body blobErrorText can read when the server refuses', async () => {
    browser(new Response(JSON.stringify({ error: { message: 'Tabelul are peste 5.000 de rânduri.' } }), { status: 422 }));
    const err = await downloadPost('tok', '/x', {}, 'f.csv').catch((e: unknown) => e);
    expect(await blobErrorText(err, 'fallback')).toBe('Tabelul are peste 5.000 de rânduri.');
  });
});
