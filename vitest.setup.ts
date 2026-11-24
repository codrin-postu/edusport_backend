// The portal second factor and passkeys are off by default in production (PORTAL_2FA); the suite runs with them on so the built code stays tested.
// Tests of the off switch set `process.env.PORTAL_2FA = 'off'` themselves.
process.env.PORTAL_2FA = 'on';
// Portals are opt-in (PORTAL_HOSTS empty means none); the suite runs with both on and their invite origins set.
// Tests of the off switch clear `process.env.PORTAL_HOSTS` themselves.
process.env.PORTAL_HOSTS = 'antrenor,sportiv';
process.env.PORTAL_ANTRENOR_URL = 'https://antrenor.scoaladepatinaj.com';
process.env.PORTAL_SPORTIV_URL = 'https://sportiv.scoaladepatinaj.com';

// The switches are stored in a Strapi row; the suite has none, so by default every switch is on and the portals follow PORTAL_HOSTS.
// A test that needs a switch off sets `globalThis.__features` (see src/club/features/__tests__/portal-gate.test.ts) or mocks the module itself.
import { vi } from 'vitest';

vi.mock('./src/club/features/strapi-store', async () => {
  const { installedPortals, readFeatures } = await import('./src/club/features/features');
  const { PORTAL_HOSTS } = await import('./src/club/portal/auth/bff');
  return {
    loadFeatures: async () => {
      const override = (globalThis as { __features?: Partial<Record<string, boolean>> }).__features ?? {};
      return readFeatures({ features: override }, installedPortals(PORTAL_HOSTS()));
    },
  };
});
