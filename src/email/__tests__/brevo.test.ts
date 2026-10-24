import { describe, expect, it } from 'vitest';
import { BREVO_URL, brevoBody, sendWithBrevo, type OutgoingEmail } from '../brevo';

const MESSAGE: OutgoingEmail = {
  to: 'test@codrin.space',
  subject: 'Înscriere înregistrată: Maria Pop (nr. 2026-0008)',
  html: '<p>html</p>',
  text: 'text',
  attachments: [{ name: 'Maria_Pop_Acord_2026-2027.pdf', content: 'JVBERi0=' }],
};
const SENDER = { email: 'inscrieri@scoaladepatinaj.com', name: 'Școala de Patinaj EduSport' };

type Call = { url: string; init: RequestInit };

function fakeFetch(response: Response | Error) {
  const calls: Call[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (response instanceof Error) throw response;
    return response;
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe('brevoBody', () => {
  it('maps the message to the Brevo JSON body', () => {
    expect(brevoBody(MESSAGE, SENDER, 'edusporttrophy@gmail.com')).toEqual({
      sender: SENDER,
      to: [{ email: 'test@codrin.space' }],
      subject: MESSAGE.subject,
      htmlContent: '<p>html</p>',
      textContent: 'text',
      attachment: MESSAGE.attachments,
      replyTo: { email: 'edusporttrophy@gmail.com' },
    });
  });

  it('leaves out an empty attachment list and a missing reply-to', () => {
    const body = brevoBody({ ...MESSAGE, attachments: [] }, SENDER, null);
    expect(body).not.toHaveProperty('attachment');
    expect(body).not.toHaveProperty('replyTo');
  });
});

describe('sendWithBrevo', () => {
  it('posts with the api-key header and returns the message id', async () => {
    const { fn, calls } = fakeFetch(new Response(JSON.stringify({ messageId: '<id@relay>' }), { status: 201 }));
    await expect(sendWithBrevo(MESSAGE, { apiKey: 'k', sender: SENDER, replyTo: null, fetchFn: fn })).resolves.toEqual({ ok: true, messageId: '<id@relay>' });
    expect(calls[0].url).toBe(BREVO_URL);
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>)['api-key']).toBe('k');
    expect(JSON.parse(String(calls[0].init.body)).subject).toBe(MESSAGE.subject);
  });

  it('reports a non-2xx answer with its status and body', async () => {
    const { fn } = fakeFetch(new Response('{"code":"unauthorized","message":"Key not found"}', { status: 401 }));
    const result = await sendWithBrevo(MESSAGE, { apiKey: 'bad', sender: SENDER, replyTo: null, fetchFn: fn });
    expect(result).toEqual({ ok: false, error: 'Brevo 401: {"code":"unauthorized","message":"Key not found"}' });
  });

  it('reports a network failure instead of throwing', async () => {
    const { fn } = fakeFetch(new Error('getaddrinfo ENOTFOUND api.brevo.com'));
    const result = await sendWithBrevo(MESSAGE, { apiKey: 'k', sender: SENDER, replyTo: null, fetchFn: fn });
    expect(result).toEqual({ ok: false, error: 'Brevo request failed: getaddrinfo ENOTFOUND api.brevo.com' });
  });
});
