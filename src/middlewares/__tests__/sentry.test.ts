import { errors } from '@strapi/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => [] as unknown[]);
vi.mock('../../sentry', () => ({ sentryEnabled: () => true, captureException: (err: unknown) => captured.push(err) }));

import sentry from '../sentry';

const run = async (err: unknown) => {
  await expect(sentry()({}, () => Promise.reject(err))).rejects.toBe(err);
};

describe('global::sentry reporting', () => {
  beforeEach(() => {
    captured.length = 0;
  });

  it('does not report the admin policies\' 401 and 403, and still re-throws them', async () => {
    await run(new errors.UnauthorizedError('Missing or invalid credentials'));
    await run(new errors.PolicyError());
    await run(new errors.ForbiddenError());
    expect(captured).toEqual([]);
  });

  it('still reports server faults and keeps skipping 4xx with a status', async () => {
    const fault = new Error('db down');
    await run(fault);
    await run(Object.assign(new Error('Malicious Path'), { status: 400 }));
    expect(captured).toEqual([fault]);
  });
});
