import { describe, expect, it } from 'vitest';
import { callerOf } from '../views-caller';

function strapiWith(user: unknown, active = true) {
  return {
    sessionManager: () => ({ validateAccessToken: () => ({ isValid: true, payload: { userId: '7', sessionId: 's' } }), isSessionActive: async () => active }),
    db: { query: () => ({ findOne: async () => user }) },
  };
}
const auth = 'Bearer token';

describe('callerOf', () => {
  it('reads the id, the name, the e-mail and the Super Admin role from the database user', async () => {
    const user = { id: 7, firstname: 'Radu', lastname: 'Super', email: 'radu@club.ro', isActive: true, roles: [{ code: 'strapi-super-admin' }] };
    expect(await callerOf(auth, strapiWith(user))).toEqual({ adminId: 7, name: 'Radu Super', email: 'radu@club.ro', superAdmin: true });
  });
  it('is no Super Admin without the role, or when blocked, and falls back to the e-mail for a name', async () => {
    const base = { id: 7, email: 'ana@club.ro', isActive: true };
    expect(await callerOf(auth, strapiWith({ ...base, roles: [{ code: 'strapi-editor' }] }))).toEqual({ adminId: 7, name: 'ana@club.ro', email: 'ana@club.ro', superAdmin: false });
    expect((await callerOf(auth, strapiWith({ ...base, blocked: true, roles: [{ code: 'strapi-super-admin' }] }))).superAdmin).toBe(false);
  });
  it('refuses a request that is not an active admin session', async () => {
    await expect(callerOf(undefined, strapiWith({ id: 7, isActive: true }))).rejects.toThrow();
    await expect(callerOf(auth, strapiWith({ id: 7, isActive: true }, false))).rejects.toThrow();
    await expect(callerOf(auth, strapiWith({ id: 7, isActive: false }))).rejects.toThrow();
  });
});
