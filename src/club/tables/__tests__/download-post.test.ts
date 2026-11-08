import { afterEach, describe, expect, it, vi } from 'vitest';
import { blobErrorText, downloadGet, downloadPost } from '../../../admin/dashboard/inscrieri/downloadPdf';

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

  it('prefixes the backend URL', async () => {
    const { fetchMock } = browser(new Response('a', { status: 200 }));
    await downloadPost('tok', '/api/club/tables/export', {}, 'f.csv', { backendURL: 'https://admin.example.ro' });
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe('https://admin.example.ro/api/club/tables/export');
  });

  it('on 401 refreshes the token once and retries with the new one', async () => {
    const answers = [new Response('{}', { status: 401 }), new Response('a;b', { status: 200 })];
    const { fetchMock, link } = browser(answers[1]);
    fetchMock.mockImplementation(async () => answers.shift() as Response);
    const refresh = vi.fn(async () => 'fresh');
    await downloadPost('old', '/x', {}, 'f.csv', { refresh });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const auth = (i: number) => ((fetchMock.mock.calls[i] as unknown as [string, RequestInit])[1].headers as Record<string, string>).Authorization;
    expect([auth(0), auth(1)]).toEqual(['Bearer old', 'Bearer fresh']);
    expect(link.click).toHaveBeenCalled();
  });

  it('does not retry twice: a second 401 is the error', async () => {
    const { fetchMock } = browser(new Response('{}', { status: 401 }));
    fetchMock.mockImplementation(async () => new Response('{}', { status: 401 }));
    const err = await downloadPost('old', '/x', {}, 'f.csv', { refresh: async () => 'fresh' }).catch((e: unknown) => e);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((err as Error).message).toBe('HTTP 401');
  });

  it('downloadGet sends a GET with the token and hands the refusal text on (the accounting .xlsx answers 501)', async () => {
    const { fetchMock } = browser(new Response(JSON.stringify({ error: { message: 'xlsx nu e disponibil' } }), { status: 501 }));
    const err = await downloadGet('tok', '/api/club/money/accounting.xlsx?month=2026-11', 'f.xlsx').catch((e: unknown) => e);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(init.body).toBeUndefined();
    expect(await blobErrorText(err, 'fallback')).toBe('xlsx nu e disponibil');
  });
});
