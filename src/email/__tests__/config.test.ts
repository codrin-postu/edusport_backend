import { describe, expect, it } from 'vitest';
import { DEFAULT_SENDER_NAME, blockedReason, deliveryTarget, publicSiteUrl, readEmailConfig } from '../config';

const BASE = {
  BREVO_API_KEY: 'xkeysib-test',
  EMAIL_FROM_ADDRESS: 'inscrieri@scoaladepatinaj.com',
  EMAIL_TEST_RECIPIENT: 'test@codrin.space',
};

describe('readEmailConfig', () => {
  it('reads the sender, defaults and trims', () => {
    const c = readEmailConfig({ ...BASE, FRONTEND_ORIGIN: 'https://scoaladepatinaj.com, https://www.scoaladepatinaj.com' });
    expect(c.sender).toEqual({ email: 'inscrieri@scoaladepatinaj.com', name: DEFAULT_SENDER_NAME });
    expect(c.siteUrl).toBe('https://scoaladepatinaj.com');
    expect(c.replyTo).toBeNull();
  });

  it('serves the header image from CMS_PUBLIC_URL, or none without it', () => {
    expect(readEmailConfig({ ...BASE, CMS_PUBLIC_URL: 'https://cms.scoaladepatinaj.com/' }).headerImageUrl).toBe(
      'https://cms.scoaladepatinaj.com/email/edusport-header.png',
    );
    expect(readEmailConfig(BASE).headerImageUrl).toBeNull();
  });

  it('takes the site address from FRONTEND_ORIGIN, like the expired-link redirect', () => {
    expect(publicSiteUrl({ FRONTEND_ORIGIN: ' https://scoaladepatinaj.com/ ,https://www.scoaladepatinaj.com' })).toBe('https://scoaladepatinaj.com');
    expect(publicSiteUrl({ NODE_ENV: 'development' })).toBe('http://localhost:3000');
    expect(publicSiteUrl({ NODE_ENV: 'production' })).toBeNull();
  });

  it('is live only in production with EMAIL_LIVE=true', () => {
    expect(readEmailConfig({ ...BASE, NODE_ENV: 'production', EMAIL_LIVE: 'true' }).live).toBe(true);
    expect(readEmailConfig({ ...BASE, NODE_ENV: 'production' }).live).toBe(false);
    expect(readEmailConfig({ ...BASE, NODE_ENV: 'development', EMAIL_LIVE: 'true' }).live).toBe(false);
    expect(readEmailConfig({ ...BASE, NODE_ENV: 'test', EMAIL_LIVE: 'true' }).live).toBe(false);
  });
});

describe('deliveryTarget', () => {
  it('sends to the parent only when live', () => {
    const live = readEmailConfig({ ...BASE, NODE_ENV: 'production', EMAIL_LIVE: 'true', FRONTEND_ORIGIN: 'https://scoaladepatinaj.com' });
    expect(deliveryTarget(live, 'parinte@example.ro')).toEqual({ ok: true, to: 'parinte@example.ro' });
  });

  it('replaces every recipient with the test address outside production', () => {
    const local = readEmailConfig({ ...BASE, NODE_ENV: 'development' });
    expect(deliveryTarget(local, 'parinte@example.ro')).toEqual({ ok: true, to: 'test@codrin.space' });
    const prodNotLive = readEmailConfig({ ...BASE, NODE_ENV: 'production', FRONTEND_ORIGIN: 'https://scoaladepatinaj.com' });
    expect(deliveryTarget(prodNotLive, 'parinte@example.ro')).toEqual({ ok: true, to: 'test@codrin.space' });
  });

  it('cannot send without a key, a sender, or (outside production) a test address', () => {
    expect(deliveryTarget(readEmailConfig({ ...BASE, BREVO_API_KEY: '' }), 'p@example.ro')).toEqual({ ok: false, reason: 'no-key' });
    expect(deliveryTarget(readEmailConfig({ ...BASE, EMAIL_FROM_ADDRESS: ' ' }), 'p@example.ro')).toEqual({ ok: false, reason: 'no-sender' });
    expect(deliveryTarget(readEmailConfig({ ...BASE, EMAIL_TEST_RECIPIENT: undefined }), 'p@example.ro')).toEqual({ ok: false, reason: 'no-test-recipient' });
  });
});

describe('blockedReason', () => {
  it('is null when e-mail can go out', () => {
    expect(blockedReason(readEmailConfig(BASE))).toBeNull();
    expect(blockedReason(readEmailConfig({ ...BASE, EMAIL_TEST_RECIPIENT: '', NODE_ENV: 'production', EMAIL_LIVE: 'true', FRONTEND_ORIGIN: 'https://scoaladepatinaj.com' }))).toBeNull();
  });
  it('names the first missing setting', () => {
    expect(blockedReason(readEmailConfig({}))).toBe('no-key');
    expect(blockedReason(readEmailConfig({ ...BASE, NODE_ENV: 'production', EMAIL_LIVE: 'true' }))).toBe('no-site-url');
  });
});
