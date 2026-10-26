import { describe, expect, it } from 'vitest';
import { INSCRIERI_ADMIN_PATH, cmsPublicUrl, registrationAdminUrl } from '../admin-link';

describe('link to a registration in the admin', () => {
  it('opens the Înscrieri page searching that number in every season', () => {
    expect(registrationAdminUrl('https://cms.example.ro', '2026-0142')).toBe(
      'https://cms.example.ro/admin/plugins/edusport-inscrieri?q=2026-0142&season=all',
    );
  });

  it('points at the Înscrieri menu route under the /admin basename', () => {
    expect(INSCRIERI_ADMIN_PATH).toBe('/admin/plugins/edusport-inscrieri');
  });

  it('is empty without a number or without a configured origin', () => {
    expect(registrationAdminUrl('https://cms.example.ro', null)).toBe('');
    expect(registrationAdminUrl('https://cms.example.ro', '  ')).toBe('');
    expect(registrationAdminUrl('', '2026-0142')).toBe('');
  });

  it('reads the origin from CMS_PUBLIC_URL without a trailing slash', () => {
    expect(cmsPublicUrl({ CMS_PUBLIC_URL: ' https://cms.example.ro/ ' })).toBe('https://cms.example.ro');
    expect(cmsPublicUrl({})).toBe('');
  });
});
