import type { Core } from '@strapi/strapi';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendNow, type OutgoingEmail } from '../brevo';
import { portalMailSender, renderPortalMail } from '../portal-direct';

const links = {
  site: 'https://scoaladepatinaj.com',
  program: 'https://scoaladepatinaj.com/cursuri/program',
  privacy: 'https://scoaladepatinaj.com/protectia-datelor',
  headerImage: null,
  whatsapp: null,
  phone: '0255 000 000',
  email: 'inscrieri@scoaladepatinaj.com',
  facebook: null,
};

const MESSAGE: OutgoingEmail = { to: 'parinte@example.com', subject: 'Test', html: '<p>x</p>', text: 'x', attachments: [] };
const SENDER = { email: 'inscrieri@scoaladepatinaj.com', name: 'Școala de Patinaj EduSport' };

function okResponse(): Response {
  return new Response(JSON.stringify({ messageId: '<id@relay>' }), { status: 201 });
}

function failResponse(): Response {
  return new Response('{"code":"internal_error"}', { status: 500 });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('sendNow', () => {
  it('retries once after 2000 ms and answers ok when the retry succeeds', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(failResponse()).mockResolvedValueOnce(okResponse());
    const wait = vi.fn(async () => undefined);
    const result = await sendNow(MESSAGE, { apiKey: 'k', sender: SENDER, replyTo: null, fetchFn: fetchFn as unknown as typeof fetch }, wait);
    expect(result).toEqual({ ok: true, messageId: '<id@relay>' });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
    expect(wait).toHaveBeenCalledWith(2000);
  });

  it('answers not ok when both tries fail', async () => {
    const fetchFn = vi.fn().mockResolvedValue(failResponse());
    const wait = vi.fn(async () => undefined);
    const result = await sendNow(MESSAGE, { apiKey: 'k', sender: SENDER, replyTo: null, fetchFn: fetchFn as unknown as typeof fetch }, wait);
    expect(result.ok).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

describe('renderPortalMail', () => {
  it('renders the reset code mail', () => {
    const rendered = renderPortalMail({ kind: 'reset', code: '042517' }, links);
    expect(rendered.subject).toBe('Codul pentru parola nouă');
    expect(rendered.text).toContain('Codul tău: 042517\n\nEste valabil 10 minute.\n\nDacă nu ai cerut tu, ignoră acest e-mail.');
  });

  it('renders the lockout mail', () => {
    expect(renderPortalMail({ kind: 'lockout' }, links).subject).toBe('Încercări de intrare în cont');
  });

  it('renders the new device mail in Bucharest time', () => {
    const nd = renderPortalMail({ kind: 'new-device', device: 'Telefon, Chrome', at: new Date('2026-11-04T16:05:00Z') }, links);
    expect(nd.subject).toBe('Intrare de pe un dispozitiv nou');
    expect(nd.text).toContain('Telefon, Chrome, 4 noi 2026 18:05.');
    expect(nd.text).toContain('Dacă nu ai fost tu, schimbă parola.');
  });
});

describe('portalMailSender', () => {
  const strapi = {
    documents: () => ({ findFirst: async () => null }),
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  } as unknown as Core.Strapi;

  it('sends to the test recipient only when e-mail is not live', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('EMAIL_LIVE', 'true');
    vi.stubEnv('BREVO_API_KEY', 'k');
    vi.stubEnv('EMAIL_FROM_ADDRESS', SENDER.email);
    vi.stubEnv('EMAIL_TEST_RECIPIENT', 'test@codrin.space');
    const fetchMock = vi.fn(async () => okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const sent = await portalMailSender(strapi)('parinte@example.com', { kind: 'lockout' });

    expect(sent).toBe(true);
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.to).toEqual([{ email: 'test@codrin.space' }]);
  });
});
