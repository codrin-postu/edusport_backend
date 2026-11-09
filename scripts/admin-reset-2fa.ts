/**
 * Server-side 2FA reset of one admin (spec 6.6): `npm run admin:reset-2fa -- <e-mail>`. Boots Strapi without the HTTP server, clears the
 * admin's methods, backup codes and remembered devices, ends every session and tells the admin. Passkeys stay. Compiled with the app
 * (`dist/scripts/admin-reset-2fa.js`), so a build comes first; in the container `dist` is already there.
 */
import { compileStrapi, createStrapi } from '@strapi/strapi';
import { adminByEmail } from '../src/club/admin-login/admins';
import { serverSecurityContext } from '../src/club/admin-login/context';
import { resetTwoFactor } from '../src/club/security/reset';

async function main(): Promise<number> {
  const email = process.argv[2]?.trim();
  if (!email) {
    console.log('Usage: npm run admin:reset-2fa -- <e-mail>');
    return 1;
  }
  const app = await createStrapi(await compileStrapi()).load();
  try {
    const admin = await adminByEmail(app, email);
    if (!admin) {
      console.log(`No admin: ${email}`);
      return 1;
    }
    await resetTwoFactor(serverSecurityContext(app), { type: 'admin', id: String(admin.id) }, admin.email, 'server');
    console.log(`2FA reset: ${admin.email}`);
    return 0;
  } finally {
    await app.destroy();
  }
}

main().then((code) => process.exit(code), (err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
