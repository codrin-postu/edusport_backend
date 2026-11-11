import { portalSessions, type PortalSessions } from '../../sessions';
import { fakePortalStore, type FakePortal } from '../../__tests__/fake-portal-store';
import type { NewPortalInviteJob } from '../../../../email/portal-email';
import type { PortalMail } from '../../../../email/portal-direct';
import type { AccountContext } from '../read';

export const NOW = new Date('2026-11-06T10:00:00.000Z');
export const HASH = '$2a$10$abcdefghijklmnopqrstuuAbCdEfGhIjKlMnOpQrStUvWxYz012345';

export type Harness = {
  fake: FakePortal; c: AccountContext; cancelled: string[]; jobs: NewPortalInviteJob[]; after: string[]; mails: { to: string; mail: PortalMail }[]; logs: string[];
};

export function harness(over: Partial<AccountContext> = {}, mailOk = true): Harness {
  const fake = fakePortalStore({ now: () => NOW, teamMembers: { tm1: 'Andreea Pascu', tm2: 'Virgil Ion' } });
  const jobs: NewPortalInviteJob[] = [];
  const after: string[] = [];
  const mails: Harness['mails'] = [];
  const logs: string[] = [];
  const cancelled: string[] = [];
  const sessions: PortalSessions = portalSessions(fake.store, () => NOW);
  const c: AccountContext = {
    store: fake.store, sessions, actor: 'admin@edusport.ro', now: () => NOW, log: (m) => logs.push(m),
    queueInvite: async (job) => {
      jobs.push(job);
      return `job${jobs.length}`;
    },
    afterCommit: (id) => after.push(id),
    cancelInvites: async (accountId) => {
      cancelled.push(accountId);
    },
    mail: async (to, mail) => {
      mails.push({ to, mail });
      return mailOk;
    },
    hash: async (p) => `hash:${p}`,
    siteUrl: 'https://scoaladepatinaj.com',
    ...over,
  };
  return { fake, c, cancelled, jobs, after, mails, logs };
}

/** An account of tm1 in the given status, with a user, an invite token, a reset token, a device and a session. */
export async function seedAccount(h: Harness, status: 'invited' | 'active' | 'disabled', email = 'andreea@example.com'): Promise<{ id: string; userId: number }> {
  const { store } = h.fake;
  const userId = await store.createUser(email, status === 'invited' ? null : HASH);
  const at = NOW.toISOString();
  const id = await store.createAccount({
    userId, email, status, teamMemberId: 'tm1', invitedAt: at,
    ...(status !== 'invited' ? { activatedAt: at } : {}), ...(status === 'disabled' ? { disabledAt: at, disabledBy: 'x' } : {}),
  });
  const later = new Date(NOW.getTime() + 86_400_000).toISOString();
  await store.createToken({ accountId: id, host: 'antrenor', kind: 'invite', secretHash: 'inv', expiresAt: later });
  await store.createToken({ accountId: id, host: 'antrenor', kind: 'reset', secretHash: 'rst', expiresAt: later });
  if (status === 'active') {
    const dev = await store.createDevice({ accountId: id, host: 'antrenor', deviceKeyHash: 'k', sessionId: null, label: 'Telefon, Chrome', firstSeenAt: at, lastSeenAt: at });
    await store.createSession({ accountId: id, deviceId: dev, host: 'antrenor', refreshHash: 'r', accessHash: 'a', accessExpiresAt: later, familyStartedAt: at, lastUsedAt: at });
  }
  return { id, userId };
}
