import { SUBJECT } from '../../subjects';
import { SESSION_FAMILY_MS, SESSION_IDLE_MS } from '../sessions-own';
import type { LimitState } from '../limits';
import type { AccountRow, DeviceRow, LimitRow, PortalStore, SessionRow, TokenRow, UserAuth } from '../store';

export type FakeUser = UserAuth & { username: string; provider: string; role: string; };
export type FakePortalState = {
  accounts: AccountRow[]; users: FakeUser[]; tokens: TokenRow[]; limits: LimitRow[]; devices: DeviceRow[]; sessions: SessionRow[];
  teamMembers: Record<string, string>; history: { subjectType: string; subjectId: string; action: string; changes: Record<string, unknown>; actor: string }[];
  locks: string[]; now: () => Date; nextId: number;
};
export type FakePortal = { store: PortalStore; state: FakePortalState; failOn(method: keyof PortalStore): void };

const EMPTY = (): FakePortalState => ({
  accounts: [], users: [], tokens: [], limits: [], devices: [], sessions: [], teamMembers: {}, history: [], locks: [], now: () => new Date(), nextId: 1,
});

const copy = <T>(v: T): T => structuredClone(v);
const defined = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

function must<T extends { id: string }>(rows: T[], id: string): T {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`fake: no row ${id}`);
  return row;
}

const SNAPSHOT_KEYS = ['accounts', 'users', 'tokens', 'limits', 'devices', 'sessions', 'history'] as const;

function withFailures(store: PortalStore, failing: Set<string>): PortalStore {
  const wrapped: Record<string, unknown> = {};
  for (const [key, fn] of Object.entries(store) as [string, (...args: unknown[]) => Promise<unknown>][]) {
    wrapped[key] = (...args: unknown[]) => (failing.delete(key) ? Promise.reject(new Error(`fake failure in ${key}`)) : fn(...args));
  }
  return wrapped as unknown as PortalStore;
}

function lockers(state: FakePortalState, depth: { n: number }): Pick<PortalStore, 'transaction' | 'lockAccount' | 'lockSession' | 'lockLimit' | 'saveLimit' | 'purgeLimits'> {
  const inTx = (what: string) => {
    if (depth.n === 0) throw new Error(`lock on ${what} taken outside a transaction`);
  };
  const next = (prefix: string) => `${prefix}${state.nextId++}`;
  return {
    async transaction<T>(work: () => Promise<T>): Promise<T> {
      const snap = depth.n === 0 ? copy(Object.fromEntries(SNAPSHOT_KEYS.map((k) => [k, state[k]]))) : null;
      depth.n += 1;
      try {
        return await work();
      } catch (e) {
        if (snap) Object.assign(state, snap);
        throw e;
      } finally {
        depth.n -= 1;
      }
    },
    lockAccount: async (id) => {
      inTx('portal_accounts');
      state.locks.push(`account:${id}`);
    },
    lockSession: async (id) => {
      inTx('portal_sessions');
      state.locks.push(`session:${id}`);
    },
    lockLimit: async (key) => {
      inTx('portal_auth_limits');
      let row = state.limits.find((l) => l.key === key);
      if (!row) {
        row = { id: next('lim'), key, count: 0, windowStart: state.now().toISOString(), lockedUntil: null, notifiedAt: null };
        state.limits.push(row);
      }
      state.locks.push(`limit:${key}`);
      return copy(row);
    },
    saveLimit: async (id, s: LimitState) => {
      Object.assign(must(state.limits, id), s);
    },
    purgeLimits: async (olderThan, now) => {
      const keep = (l: LimitRow) => Date.parse(l.windowStart) >= olderThan.getTime() || (l.lockedUntil !== null && Date.parse(l.lockedUntil) > now.getTime());
      const before = state.limits.length;
      state.limits = state.limits.filter(keep);
      return before - state.limits.length;
    },
  };
}

function purges(state: FakePortalState): Pick<PortalStore, 'purgeDevices' | 'purgeTokens' | 'purgeSessions'> {
  const t = (v: string | null): number => (v === null ? Number.POSITIVE_INFINITY : Date.parse(v));
  const drop = <T>(rows: T[], gone: (r: T) => boolean): [T[], number] => {
    const kept = rows.filter((r) => !gone(r));
    return [kept, rows.length - kept.length];
  };
  return {
    purgeDevices: async (before) => {
      const [kept, n] = drop(state.devices, (d) => d.revokedAt !== null && t(d.revokedAt) < before.getTime());
      state.devices = kept;
      return n;
    },
    purgeTokens: async (before) => {
      const [kept, n] = drop(state.tokens, (k) => (k.usedAt !== null && t(k.usedAt) < before.getTime()) || t(k.expiresAt) < before.getTime());
      state.tokens = kept;
      return n;
    },
    purgeSessions: async (before) => {
      const b = before.getTime();
      const [kept, n] = drop(state.sessions, (s) => (s.revokedAt !== null && t(s.revokedAt) < b) || t(s.lastUsedAt) < b - SESSION_IDLE_MS || t(s.familyStartedAt) < b - SESSION_FAMILY_MS);
      state.sessions = kept;
      return n;
    },
  };
}

function accounts(state: FakePortalState): Pick<PortalStore, 'account' | 'accountByEmail' | 'accountByGoogleSub' | 'accountByTeamMember' | 'accountByUser' | 'createAccount' | 'updateAccount'> {
  const find = (p: (a: AccountRow) => boolean) => async () => {
    const row = state.accounts.find(p);
    return row ? copy(row) : null;
  };
  return {
    account: (id) => find((a) => a.id === id)(),
    accountByEmail: (email) => find((a) => a.email === email)(),
    accountByGoogleSub: (sub) => find((a) => a.googleSub === sub)(),
    accountByTeamMember: (id) => find((a) => a.teamMemberId === id)(),
    accountByUser: (userId) => find((a) => a.userId === userId)(),
    createAccount: async (a) => {
      const id = `acc${state.nextId++}`;
      state.accounts.push({
        id, teamMemberId: null, phone: null, googleSub: null, invitedAt: null, invitedBy: null, activatedAt: null, disabledAt: null, disabledBy: null, lastLoginAt: null,
        ...defined(a), userId: a.userId, status: a.status, email: a.email.toLowerCase(),
      });
      return id;
    },
    updateAccount: async (id, a) => {
      Object.assign(must(state.accounts, id), defined(a), a.email !== undefined ? { email: a.email.toLowerCase() } : {});
    },
  };
}

function users(state: FakePortalState): Pick<PortalStore, 'user' | 'createUser' | 'updateUser'> {
  return {
    user: async (id) => {
      const u = state.users.find((x) => x.id === id);
      return u ? { id: u.id, email: u.email, passwordHash: u.passwordHash, blocked: u.blocked, confirmed: u.confirmed } : null;
    },
    createUser: async (email, passwordHash) => {
      const id = state.nextId++;
      state.users.push({ id, email, passwordHash, blocked: false, confirmed: false, username: email, provider: 'local', role: 'authenticated' });
      return id;
    },
    updateUser: async (id, u) => {
      const row = state.users.find((x) => x.id === id);
      if (!row) throw new Error(`fake: no user ${id}`);
      Object.assign(row, defined(u));
    },
  };
}

function tokens(state: FakePortalState): Pick<PortalStore, 'tokens' | 'tokenByHash' | 'createToken' | 'updateToken'> {
  return {
    tokens: async (accountId, kind) => copy(state.tokens.filter((t) => t.accountId === accountId && t.kind === kind)),
    tokenByHash: async (hash) => {
      const t = state.tokens.find((x) => x.secretHash === hash);
      return t ? copy(t) : null;
    },
    createToken: async (t) => {
      const id = `tok${state.nextId++}`;
      state.tokens.push({ ...t, id, usedAt: null, tries: 0, createdAt: state.now().toISOString() });
      return id;
    },
    updateToken: async (id, t) => {
      Object.assign(must(state.tokens, id), defined(t));
    },
  };
}

function devices(state: FakePortalState): Pick<PortalStore, 'devices' | 'deviceByKey' | 'createDevice' | 'updateDevice'> {
  return {
    devices: async (accountId) => copy(state.devices.filter((d) => d.accountId === accountId)),
    deviceByKey: async (accountId, keyHash) => {
      const d = state.devices.find((x) => x.accountId === accountId && x.deviceKeyHash === keyHash);
      return d ? copy(d) : null;
    },
    createDevice: async (d) => {
      const id = `dev${state.nextId++}`;
      state.devices.push({ ...d, id, revokedAt: null });
      return id;
    },
    updateDevice: async (id, d) => {
      Object.assign(must(state.devices, id), defined(d));
    },
  };
}

function sessions(state: FakePortalState): Pick<PortalStore, 'session' | 'sessionByAccess' | 'activeSessions' | 'createSession' | 'updateSession'> {
  const find = (p: (x: SessionRow) => boolean) => async () => {
    const row = state.sessions.find(p);
    return row ? copy(row) : null;
  };
  return {
    session: (id) => find((x) => x.id === id)(),
    sessionByAccess: (hash) => find((x) => x.accessHash === hash)(),
    activeSessions: async (accountId) => copy(state.sessions.filter((x) => x.accountId === accountId && x.revokedAt === null)),
    createSession: async (n) => {
      const id = `ses${state.nextId++}`;
      state.sessions.push({ ...n, id, previousRefreshHash: null, revokedAt: null });
      return id;
    },
    updateSession: async (id, w) => {
      Object.assign(must(state.sessions, id), defined(w));
    },
  };
}

export function fakePortalStore(seed: Partial<FakePortalState> = {}): FakePortal {
  const state: FakePortalState = { ...EMPTY(), ...copy({ ...seed, now: undefined }), now: seed.now ?? EMPTY().now };
  const failing = new Set<string>();
  const base: PortalStore = {
    ...lockers(state, { n: 0 }), ...purges(state), ...accounts(state), ...users(state), ...tokens(state), ...devices(state), ...sessions(state),
    teamMemberName: async (id) => state.teamMembers[id] ?? null,
    record: async (line) => {
      state.history.push({ subjectType: SUBJECT.portalAccount, ...copy(line) });
    },
  };
  return { store: withFailures(base, failing), state, failOn: (method) => failing.add(method) };
}
