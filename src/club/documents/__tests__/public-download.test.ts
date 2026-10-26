import { afterEach, expect, it, vi } from 'vitest';
import controller from '../../../api/club/controllers/documents';

afterEach(() => vi.unstubAllEnvs());

function fakeCtx(query: Record<string, unknown>) {
  const ctx = {
    query,
    params: {},
    status: 200,
    body: undefined as unknown,
    redirected: null as string | null,
    set: () => undefined,
    redirect(url: string) {
      ctx.redirected = url;
      ctx.status = 302;
    },
  };
  return ctx;
}

it('redirects an expired or forged link to the site page, never streams anything', async () => {
  vi.stubEnv('FRONTEND_ORIGIN', 'https://scoaladepatinaj.com');
  for (const token of ['x.y', '', undefined]) {
    const ctx = fakeCtx({ token, kind: 'acord' });
    await controller.publicDownload(ctx);
    expect(ctx.status).toBe(302);
    expect(ctx.redirected).toBe('https://scoaladepatinaj.com/inscrieri/link-expirat');
    expect(ctx.body).toBeUndefined();
  }
});

it('answers 400 for an unknown kind, and 410 when no site address is configured in production', async () => {
  const unknown = fakeCtx({ token: 'x.y', kind: 'contract' });
  await controller.publicDownload(unknown);
  expect(unknown).toMatchObject({ status: 400, body: { error: 'invalid' }, redirected: null });
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('FRONTEND_ORIGIN', '');
  vi.stubEnv('DOCUMENT_TOKEN_SECRET', 'a-test-secret-that-is-at-least-32-characters-long');
  const bare = fakeCtx({ token: 'x.y', kind: 'acord' });
  await controller.publicDownload(bare);
  expect(bare).toMatchObject({ status: 410, body: { error: 'expired' }, redirected: null });
});
