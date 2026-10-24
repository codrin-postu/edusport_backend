import { expect, it } from 'vitest';
import cronTasks from '../../../config/cron-tasks';

it('retries queued registration e-mails once an hour', () => {
  expect(cronTasks.registrationEmailRetry.options).toEqual({ rule: '30 * * * *', tz: 'Europe/Bucharest' });
  expect(typeof cronTasks.registrationEmailRetry.task).toBe('function');
});

it('keeps the Sheets reconcile task', () => {
  expect(cronTasks.sheetsReconcile.options.rule).toBe('0 * * * *');
});
