// @ts-nocheck  (Playwright is not a dependency of this repo; the spec runs in the T28 boot instance only)
import { test, expect } from '@playwright/test';

const base = process.env.ADMIN_E2E_BASE;
const email = process.env.ADMIN_E2E_EMAIL ?? '';
const password = process.env.ADMIN_E2E_PASSWORD ?? '';

test.skip(!base, 'ADMIN_E2E_BASE is not set');

/** A software authenticator: CTAP2, internal, discoverable keys, user verification on and answered. */
async function addAuthenticator(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
}

test('password login, offer "Creează", logout, sign in by the button, then by autofill', async ({ page }) => {
  await addAuthenticator(page);
  await page.goto(`${base}/intrare`);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Intră', exact: true }).click();
  await expect(page.getByText('Creează o cheie de acces')).toBeVisible();
  await page.getByRole('button', { name: 'Creează', exact: true }).click();
  await page.waitForURL(`${base}/admin**`);

  await page.evaluate(() => { localStorage.clear(); document.cookie = 'jwtToken=; Path=/admin; Max-Age=0'; });
  await page.context().clearCookies();

  await page.goto(`${base}/intrare`);
  await page.getByRole('button', { name: 'Folosește cheia de acces' }).click();
  await page.waitForURL(`${base}/admin**`);

  await page.evaluate(() => { localStorage.clear(); });
  await page.context().clearCookies();
  await page.goto(`${base}/intrare`);
  await page.getByLabel('E-mail').focus();
  await page.waitForURL(`${base}/admin**`, { timeout: 15000 }).catch(async () => {
    await page.getByLabel('E-mail').click();
    await page.waitForURL(`${base}/admin**`);
  });
});
