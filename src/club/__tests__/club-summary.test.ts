import { afterEach, expect, it, vi } from 'vitest';
import club from '../../api/club/controllers/club';

afterEach(() => {
  delete (globalThis as { strapi?: unknown }).strapi;
});

it('counts the active athletes for the dashboard tile "Sportivi" (spec 7)', async () => {
  const count = vi.fn(async (args: { filters?: Record<string, unknown> }) => (args.filters?.status === 'activ' ? 7 : 1));
  (globalThis as { strapi?: unknown }).strapi = { documents: () => ({ count }) };
  const ctx: { body: unknown } = { body: null };
  await club.summary(ctx);
  expect(ctx.body).toMatchObject({ data: { athletes: 1, activeAthletes: 7 } });
});
