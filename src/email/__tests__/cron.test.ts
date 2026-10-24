import type { Core } from '@strapi/strapi';
import { afterEach, expect, it, vi } from 'vitest';
import cronTasks from '../../../config/cron-tasks';

const { retry } = vi.hoisted(() => ({ retry: vi.fn() }));
vi.mock('../strapi-email', () => ({ retryRegistrationEmails: retry }));

function fakeStrapi() {
  const logs: string[] = [];
  const at = (level: string) => (m: string) => {
    logs.push(`${level} ${m}`);
  };
  const strapi = { log: { debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error') } } as unknown as Core.Strapi;
  return { strapi, logs };
}

afterEach(() => {
  vi.unstubAllEnvs();
  retry.mockReset();
});

it('retries queued registration e-mails once an hour', () => {
  expect(cronTasks.registrationEmailRetry.options).toEqual({ rule: '30 * * * *', tz: 'Europe/Bucharest' });
  expect(typeof cronTasks.registrationEmailRetry.task).toBe('function');
});

it('keeps the Sheets reconcile task', () => {
  expect(cronTasks.sheetsReconcile.options.rule).toBe('0 * * * *');
});

it('warns once per tick when delivery is blocked in production', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  retry.mockResolvedValue({ attempted: 0, skipped: 'no-key' });
  const { strapi, logs } = fakeStrapi();
  await cronTasks.registrationEmailRetry.task({ strapi });
  expect(logs).toEqual(['warn [email-job][cron] skipped: no-key']);
});

it('keeps a blocked delivery at debug outside production', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  retry.mockResolvedValue({ attempted: 0, skipped: 'no-sender' });
  const { strapi, logs } = fakeStrapi();
  await cronTasks.registrationEmailRetry.task({ strapi });
  expect(logs).toEqual(['debug [email-job][cron] skipped: no-sender']);
});
