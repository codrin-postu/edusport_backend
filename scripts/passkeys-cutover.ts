/**
 * Passkey domain move (spec 8.6 step 2): `npm run passkeys:cutover -- --dry-run` prints the keys per rpId and how many subjects would see the
 * offer again; without the flag it clears `passkeyOfferedAt` for them and prints the same. Deletes nothing. The current rpId is `WEBAUTHN_RP_ID`.
 * Compiled with the app (`dist/scripts/passkeys-cutover.js`), so a build comes first; in the container `dist` is already there.
 */
import { compileStrapi, createStrapi } from '@strapi/strapi';
import { applyCutover, cutoverReport, planCutover } from '../src/club/security/cutover';
import { strapiSecurityStore } from '../src/club/security/strapi-store';

async function main(): Promise<number> {
  const rpId = process.env.WEBAUTHN_RP_ID?.trim();
  if (!rpId) {
    console.log('WEBAUTHN_RP_ID is not set.');
    return 1;
  }
  const dry = process.argv.includes('--dry-run');
  const app = await createStrapi(await compileStrapi()).load();
  try {
    const store = strapiSecurityStore(app);
    const plan = await planCutover(store, rpId);
    for (const line of cutoverReport(plan)) console.log(line);
    if (dry) {
      console.log('dry run: nothing changed');
      return 0;
    }
    console.log(`offer cleared for ${await applyCutover(store, plan)} subjects`);
    return 0;
  } finally {
    await app.destroy();
  }
}

main().then((code) => process.exit(code), (err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
