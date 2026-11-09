import { describe, expect, it } from 'vitest';
import { memorySecurityStore } from './memory-security-store';
import { storeContract, type StoreHarness } from './store-contract';

let n = 0;
const harness = async (): Promise<StoreHarness> => {
  const mem = memorySecurityStore();
  return {
    store: mem.store,
    dump: async () => mem.dump(),
    fresh: () => ({ type: 'portal', id: `acct-${(n += 1)}` }),
    adminUser: () => 1000 + (n += 1),
  };
};

describe('memory security store', () => {
  storeContract(harness);

  it('record keeps the history line and portal account extras merge', async () => {
    const mem = memorySecurityStore();
    await mem.store.record({ subjectType: 'admin', subjectId: '7', action: 'totpOn', changes: {}, actor: 'Ana' });
    expect(mem.history).toHaveLength(1);
    await mem.store.updatePortalAccountExtra('p1', { webauthnUserId: 'w' });
    await mem.store.updatePortalAccountExtra('p1', { lastMethod: 'email', passkeyOfferedAt: '2026-01-01T00:00:00.000Z' });
    expect(await mem.store.portalAccountExtra('p1')).toEqual({ webauthnUserId: 'w', lastMethod: 'email', passkeyOfferedAt: '2026-01-01T00:00:00.000Z' });
    await mem.store.setPortalDeviceTwoFactor('d1', 'x');
    expect(mem.portalDeviceUntil.get('d1')).toBe('x');
  });
});
