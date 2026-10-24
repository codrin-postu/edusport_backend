import { describe, expect, it } from 'vitest';
import { MAX_ATTEMPTS, isDue, nextJobState } from '../job-state';

const NOW = new Date('2026-10-20T09:00:00.000Z');

describe('nextJobState', () => {
  it('marks a successful attempt sent', () => {
    expect(nextJobState({ attempts: 0 }, { ok: true }, NOW)).toEqual({
      status: 'sent',
      attempts: 1,
      lastError: null,
      sentAt: '2026-10-20T09:00:00.000Z',
      alert: false,
    });
  });

  it('keeps a failed job queued below the cap, with its error', () => {
    expect(nextJobState({ attempts: 3 }, { ok: false, error: 'Brevo 500: down' }, NOW)).toEqual({
      status: 'queued',
      attempts: 4,
      lastError: 'Brevo 500: down',
      sentAt: null,
      alert: false,
    });
  });

  it('fails the job and raises an alert on the fifth failed attempt', () => {
    expect(MAX_ATTEMPTS).toBe(5);
    expect(nextJobState({ attempts: 4 }, { ok: false, error: 'Brevo 401: bad key' }, NOW)).toEqual({
      status: 'failed',
      attempts: 5,
      lastError: 'Brevo 401: bad key',
      sentAt: null,
      alert: true,
    });
  });

  it('still sends on the fifth attempt when it succeeds', () => {
    expect(nextJobState({ attempts: 4 }, { ok: true }, NOW)).toMatchObject({ status: 'sent', attempts: 5, alert: false });
  });

  it('cuts very long errors', () => {
    expect(nextJobState({ attempts: 0 }, { ok: false, error: 'x'.repeat(900) }, NOW).lastError).toHaveLength(500);
  });
});

describe('isDue', () => {
  const quiet = 5 * 60_000;
  it('takes queued jobs untouched for the quiet period', () => {
    expect(isDue({ status: 'queued', updatedAt: '2026-10-20T08:50:00.000Z' }, NOW, quiet)).toBe(true);
    expect(isDue({ status: 'queued', updatedAt: null }, NOW, quiet)).toBe(true);
  });
  it('skips a job touched moments ago, and sent or failed jobs', () => {
    expect(isDue({ status: 'queued', updatedAt: '2026-10-20T08:58:00.000Z' }, NOW, quiet)).toBe(false);
    expect(isDue({ status: 'sent', updatedAt: '2026-10-19T08:00:00.000Z' }, NOW, quiet)).toBe(false);
    expect(isDue({ status: 'failed', updatedAt: '2026-10-19T08:00:00.000Z' }, NOW, quiet)).toBe(false);
  });
});
