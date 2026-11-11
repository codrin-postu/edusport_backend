import { fakeAccessStore, type FakeAccess } from '../../club/portal/access/fake-store';
import { portalSessions } from '../../club/portal/sessions';
import type { PortalStore } from '../../club/portal/store';
import { fakePortalStore } from '../../club/portal/__tests__/fake-portal-store';

export const SECRET = 'test-bff-secret-000000000000000000';

/** What the policy tests' module mocks read: the portal store and the access store of the test in flight. */
export const stores = { portal: null as unknown, access: null as unknown };

const user = (id: number) => ({ id, email: `u${id}@example.invalid`, passwordHash: 'h', blocked: false, confirmed: true, username: `u${id}`, provider: 'local', role: 'authenticated' });

export type Accounts = { coach: string; both: string; holder: string; none: string };

/** Four accounts: u1 coach only, u2 coach and holder, u3 holder only, u4 with neither. Athletes at1, at3, at4, at5 are active, at2 anonymized; u2 holds at1, u3 holds at3 and at4. */
export async function portalWorld() {
  const fake = fakePortalStore({ teamMembers: { tm1: 'Andreea Pascu' } });
  fake.state.users.push(user(1), user(2), user(3), user(4));
  const store: PortalStore = fake.store;
  const acc = {
    coach: await store.createAccount({ userId: 1, email: 'u1@example.invalid', status: 'active', teamMemberId: 'tm1' }),
    both: await store.createAccount({ userId: 2, email: 'u2@example.invalid', status: 'active', teamMemberId: 'tm1', name: 'Dana Pop' }),
    holder: await store.createAccount({ userId: 3, email: 'u3@example.invalid', status: 'active', teamMemberId: null, name: 'Maria Ionescu' }),
    none: await store.createAccount({ userId: 4, email: 'u4@example.invalid', status: 'active', teamMemberId: null }),
  };
  const access: FakeAccess = fakeAccessStore({
    athletes: [
      { id: 'at1', name: 'Ana', email: 'a@example.invalid', status: 'activ', birthDate: null, contactName: null },
      { id: 'at2', name: 'Anonim', email: null, status: 'anonimizat', birthDate: null, contactName: null },
      { id: 'at3', name: 'Bogdan', email: 'a@example.invalid', status: 'activ', birthDate: null, contactName: null },
      { id: 'at4', name: 'Cezar', email: 'a@example.invalid', status: 'activ', birthDate: null, contactName: null },
      { id: 'at5', name: 'Dan', email: 'a@example.invalid', status: 'activ', birthDate: null, contactName: null },
    ],
  });
  const hold = (accountId: string, athleteId: string) => access.store.createAccess({ athleteId, accountId, email: 'a@example.invalid', invitedAt: '2026-11-11T10:00:00.000Z', invitedBy: 'admin' });
  await hold(acc.both, 'at1');
  await hold(acc.holder, 'at3');
  await hold(acc.holder, 'at4');
  stores.portal = store;
  stores.access = access.store;
  const sessions = portalSessions(store);
  const login = async (userId: number, host: string) => (await sessions.issue(userId, `dev${userId}${host}`, host)).accessToken;
  return { fake, store, access, acc, hold, sessions, login };
}

export const withToken = (token: string): Record<string, string> => ({ 'x-portal-secret': SECRET, authorization: `Bearer ${token}` });
