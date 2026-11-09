/**
 * Ends every admin session once: `npm run admin:end-sessions`. Run it right after `ADMIN_GATE` is switched on (runbook 6, step 7), so that
 * sessions opened through Strapi's own password-only login during the window end and every admin signs in again on /login. Also forgets
 * their remembered 2FA devices. Compiled with the app (`dist/scripts/admin-end-sessions.js`), so a build comes first.
 */
import { compileStrapi, createStrapi } from '@strapi/strapi';
import { endEveryAdminSession } from '../src/club/admin-login/end-all-sessions';
import { endAdminSessions } from '../src/club/admin-login/session';
import { strapiSecurityStore } from '../src/club/security/strapi-store';

async function main(): Promise<number> {
  const app = await createStrapi(await compileStrapi()).load();
  try {
    const rows = (await app.db.query('admin::user').findMany({ select: ['id'] })) as Array<{ id: number }>;
    const store = strapiSecurityStore(app);
    const out = await endEveryAdminSession(rows.map((r) => r.id), (id) => endAdminSessions({ strapi: app, store }, id, {}), console.error);
    console.log(`Sessions ended for ${out.ended} admins, ${out.failed} failed`);
    return out.failed === 0 ? 0 : 1;
  } finally {
    await app.destroy();
  }
}

main().then((code) => process.exit(code), (err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
