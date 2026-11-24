import { describe, expect, it } from 'vitest';
import { attemptJob } from '../email-jobs';
import { fakeDeps, queuedJob } from './helpers';

const paymentPayload = { childName: 'Ana Ionescu', amount: 320, currency: 'RON' } as never;

describe('e-mail send-time feature guard', () => {
  it('cancels a queued payment job while abonamente is off, never sending', async () => {
    const deps = { ...fakeDeps(), featureOn: async (f: string) => f !== 'abonamente' };
    deps.stored.row = queuedJob({ kind: 'payment', registrationDocumentId: null, paymentDocumentId: 'p1', payload: paymentPayload });
    const row = await attemptJob(deps, deps.stored.row);
    expect(row).toMatchObject({ status: 'cancelled', lastError: 'featureOff' });
    expect(deps.sent).toEqual([]);
  });

  it('cancels portal jobs while their portal is off', async () => {
    for (const [kind, off] of [['portal-invite', 'portalAntrenori'], ['portal-access', 'portalParinti']] as const) {
      const deps = { ...fakeDeps(), featureOn: async (f: string) => f !== off };
      deps.stored.row = queuedJob({ kind, registrationDocumentId: null });
      expect(await attemptJob(deps, deps.stored.row)).toMatchObject({ status: 'cancelled', lastError: 'featureOff' });
      expect(deps.sent).toEqual([]);
    }
  });

  it('sends as before while the feature is on', async () => {
    const deps = { ...fakeDeps(), featureOn: async () => true };
    deps.stored.row = queuedJob({ kind: 'payment', registrationDocumentId: null, paymentDocumentId: 'p1', payload: paymentPayload });
    const row = await attemptJob(deps, deps.stored.row);
    expect(row.status).not.toBe('cancelled');
  });

  it('never asks about registration or schedule-change jobs', async () => {
    const asked: string[] = [];
    const deps = { ...fakeDeps(), featureOn: async (f: string) => { asked.push(f); return false; } };
    for (const kind of ['registration', 'schedule-change'] as const) {
      deps.stored.row = queuedJob({ kind, registrationDocumentId: null });
      await attemptJob(deps, deps.stored.row);
    }
    expect(asked).toEqual([]);
  });
});
