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

  const PARENT_INVITE = { name: 'Ana', link: 'https://sportiv.example.com/invite/x', host: 'sportiv.example.com' };
  const COACH_INVITE = { name: 'Ion', link: 'https://antrenor.example.com/invite/x', host: 'antrenor.example.com' };
  const COACH_ACCESS = { name: 'Ion', variant: 'coach', childName: null, link: 'https://antrenor.example.com/', host: 'antrenor.example.com' };
  const CHILD_ACCESS = { name: 'Ana', variant: 'child', childName: 'Mara', link: 'https://sportiv.example.com/', host: 'sportiv.example.com' };

  it('cancels each portal job only when the portal it belongs to is off', async () => {
    const cases = [
      ['portal-invite', PARENT_INVITE, 'portalParinti'], ['portal-invite', COACH_INVITE, 'portalAntrenori'],
      ['portal-access', COACH_ACCESS, 'portalAntrenori'], ['portal-access', CHILD_ACCESS, 'portalParinti'],
    ] as const;
    for (const [kind, payload, feature] of cases) {
      for (const off of ['portalAntrenori', 'portalParinti']) {
        const deps = { ...fakeDeps(), featureOn: async (f: string) => f !== off };
        deps.stored.row = queuedJob({ kind, registrationDocumentId: null, payload: payload as never });
        const row = await attemptJob(deps, deps.stored.row);
        if (off === feature) expect(row, `${kind} ${feature}`).toMatchObject({ status: 'cancelled', lastError: 'featureOff' });
        else expect(row.status, `${kind} ${feature} while ${off} off`).not.toBe('cancelled');
      }
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
