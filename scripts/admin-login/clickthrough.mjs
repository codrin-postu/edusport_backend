// Click-through renders of the admin login, Securitate and roles (phase 6b-3, task 29).
//
//   node scripts/admin-login/clickthrough.mjs <base> <out dir> --ids <ids.json> --pg <postgres container> [--only 01,02]
//
// Needs a Strapi booted on a throwaway Postgres with the fixtures scripts/fixtures/phase4..6b-shape.js (base is the Strapi
// address, e.g. http://localhost:1418). Playwright is not a dependency of this repo: set PLAYWRIGHT_FROM to a folder whose
// node_modules holds @playwright/test (the frontend repo). Synthetic data only. The screenshots are for a person to look at:
// the script asserts only that each screen loaded (the status of the page and one visible text), never how it looks.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const require = createRequire(join(process.env.PLAYWRIGHT_FROM ?? process.cwd(), 'package.json'));
const { chromium } = require('@playwright/test');

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const BASE = args[0];
const OUT = args[1];
const IDS = flag('--ids');
const PG = flag('--pg');
const ONLY = flag('--only')?.split(',') ?? null;
if (!BASE || !OUT || !IDS || !PG) { console.error('usage: clickthrough.mjs <base> <out dir> --ids ids.json --pg <container> [--only 01,02]'); process.exit(2); }
mkdirSync(OUT, { recursive: true });

const ids = JSON.parse(readFileSync(IDS, 'utf8'));
const PASSWORD = 'Throwaway-Admin-1';
const VIEWPORTS = { desktop: { width: 1280, height: 900 }, phone: { width: 390, height: 844 } };
const root = resolve(new URL('../..', import.meta.url).pathname);
const dist = (p) => require(join(root, 'dist', 'src', p));

let octet = 20;
const nextIp = () => `10.${(octet += 1)}.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
const sql = (q) => execFileSync('docker', ['exec', PG, 'psql', '-U', 'strapi', '-d', 'strapi', '-At', '-c', q]).toString().trim();

// ---- TOTP (RFC 6238) for the fixture secret, so the second step and the app setup can be completed -------------------------
const base32decode = (s) => { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, val = 0; const out = []; for (const ch of s.replace(/\s/g, '')) { val = (val << 5) | A.indexOf(ch); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); };
const totp = (secret, step) => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(step)); const m = createHmac('sha1', secret).update(b).digest(); const o = m[m.length - 1] & 15; return String((m.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0'); };
const nowCode = (secret, offset = 0) => totp(secret, Math.floor(Date.now() / 30000) + offset);

const manifest = [];
const SIMULATED = { '11c': 'the "code sent" state: the mail cannot go (Brevo unset), the answer of the request is a stand-in' };
function writeIndex(all) {
  const rows = all.map((m) => `<figure><a href="${m.file}"><img src="${m.file}" loading="lazy" alt="${m.file}"></a><figcaption>${m.file}${m.ok ? '' : ` (did not load: ${m.note})`}${SIMULATED[m.id] ? ` (${SIMULATED[m.id]})` : ''}</figcaption></figure>`).join('\n');
  writeFileSync(join(OUT, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Phase 6b click-through</title><style>body{font:14px system-ui;margin:24px;background:#f4f5f7}figure{display:inline-block;vertical-align:top;margin:0 16px 24px 0}img{max-width:420px;max-height:560px;border:1px solid #ccc;display:block}figcaption{margin-top:4px}</style></head><body><h1>Phase 6b click-through</h1><p>Throwaway data, for looking at, not baselines.</p>\n${rows}\n</body></html>`);
}
const failures = [];
const wanted = (id) => !ONLY || ONLY.includes(id);

async function newContext(browser, vp, { storageState, webauthn = true } = {}) {
  const context = await browser.newContext({
    viewport: VIEWPORTS[vp], locale: 'ro-RO', colorScheme: 'light', reducedMotion: 'reduce', baseURL: BASE,
    extraHTTPHeaders: { 'x-real-ip': nextIp() }, storageState,
  });
  const page = await context.newPage();
  if (webauthn) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  }
  return { context, page };
}

async function settle(page, ms = 350) {
  await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('[role="progressbar"], .ui-spinner, .animate-spin'), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

/** One screenshot. `text` must be visible (the only assertion); `status` is the status of the last navigation when the step gave it. */
async function shot(page, id, name, vp, text, { status = null, full = false } = {}) {
  const file = `${id}-${name}-${vp}.png`;
  let ok = true;
  let note = '';
  try {
    if (text) await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout: 12000 });
    if (status !== null && status >= 400) { ok = false; note = `status ${status}`; }
  } catch (e) { ok = false; note = `text not visible: ${text}`; }
  await settle(page, 200);
  await page.screenshot({ path: join(OUT, file), fullPage: full });
  manifest.push({ id, name, vp, file, ok, note });
  if (!ok) failures.push(`${file}: ${note}`);
  console.log(ok ? 'ok  ' : 'FAIL', file, note);
}

async function go(page, path) {
  const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
  await settle(page);
  return res?.status() ?? null;
}

const clickText = (page, name, opts = {}) => page.getByRole('button', { name, exact: true, ...opts }).click();

/** Signs in through the page (password, then the app code for a 2FA admin) and answers the storage state of the session. */
async function signIn(browser, email, { secret = null } = {}) {
  const { context, page } = await newContext(browser, 'desktop');
  await go(page, '/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await clickText(page, 'Intră');
  if (secret) {
    await page.getByLabel('Cod', { exact: true }).fill(nowCode(secret));
    await clickText(page, 'Verifică');
  }
  await page.waitForURL(/\/admin|\/login\/passkey/, { timeout: 20000 });
  if (/\/login\/passkey/.test(page.url())) { await clickText(page, 'Nu acum'); await page.waitForURL(/\/admin/, { timeout: 20000 }); }
  await settle(page);
  const state = await context.storageState();
  await context.close();
  return state;
}

// ---------------------------------------------------------------------------------------------------------------------
// A fresh start for admin1 (a second run finds the app, the codes and the keys of the first one).
for (const table of ['auth_factors', 'auth_backup_codes', 'auth_passkeys']) sql(`delete from ${table} where subject_type='admin' and subject_id='${ids.admins.admin1}'`);
sql('update admin_accounts set passkey_offered_at = null');
const browser = await chromium.launch();
try {
  // 01 to 03: the password page.
  for (const vp of ['desktop', 'phone']) {
    if (wanted('01')) {
      const { context, page } = await newContext(browser, vp);
      await shot(page, '01', 'login', vp, 'Intră în cont', { status: await go(page, '/login') });
      await context.close();
    }
    if (wanted('02')) {
      const { context, page } = await newContext(browser, vp);
      await go(page, '/login');
      await page.getByLabel('E-mail').fill('admin3@example.invalid');
      await page.getByLabel('Parolă', { exact: true }).fill('parola-gresita-1');
      await clickText(page, 'Intră');
      await shot(page, '02', 'parola-gresita', vp, 'E-mailul sau parola');
      await context.close();
    }
    if (wanted('03')) {
      const { context, page } = await newContext(browser, vp);
      await go(page, '/login');
      for (let i = 0; i < 6; i += 1) {
        await page.getByLabel('E-mail').fill('pauza@example.invalid');
        await page.getByLabel('Parolă', { exact: true }).fill(`gresit-${i}-parola`);
        await clickText(page, 'Intră');
        await page.waitForTimeout(500);
      }
      await shot(page, '03', 'pauza', vp, 'Prea multe încercări');
      await context.close();
    }
  }

  // 04 to 08: the second step of admin2 (app on, backup codes).
  for (const vp of ['desktop', 'phone']) {
    if (['04', '05', '06', '07', '08'].some(wanted)) {
      const { context, page } = await newContext(browser, vp);
      await go(page, '/login');
      await page.getByLabel('E-mail').fill('admin2@example.invalid');
      await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
      await clickText(page, 'Intră');
      await page.waitForURL(/\/login\/2fa/);
      if (wanted('04')) await shot(page, '04', 'al-doilea-pas-aplicatie', vp, 'Scrie codul din aplicația');
      if (wanted('07')) {
        await clickText(page, 'Altă metodă');
        await shot(page, '07', 'alta-metoda', vp, 'Cod de rezervă');
        await clickText(page, 'Altă metodă').catch(() => {});
      }
      if (wanted('06')) {
        await page.goto('/login/2fa?last=backup&methods=totp,backup', { waitUntil: 'domcontentloaded' }).catch(() => {});
        await settle(page);
        await shot(page, '06', 'al-doilea-pas-rezerva', vp, 'Scrie unul dintre codurile de rezervă');
      }
      if (wanted('05')) {
        // The e-mail method as its screen shows it (a code is not sent from this page load).
        await page.goto('/login/2fa?last=email&methods=email,totp,backup', { waitUntil: 'domcontentloaded' });
        await settle(page);
        await shot(page, '05', 'al-doilea-pas-email', vp, 'Cod din e-mail');
      }
      if (wanted('08')) {
        // The pending login ends (its cookie is gone): the next code answers 401 and the page goes back to the password form with the text.
        await context.clearCookies();
        await page.goto('/login/2fa?last=totp&methods=totp,backup', { waitUntil: 'domcontentloaded' });
        await settle(page);
        await page.getByLabel('Cod', { exact: true }).fill('123456');
        await clickText(page, 'Verifică');
        await shot(page, '08', 'pending-expirat', vp, 'Intrarea a expirat');
      }
      await context.close();
    }
  }

  // 09: the passkey offer after a password login of an admin without a key (Editor site, a software authenticator).
  for (const vp of ['desktop', 'phone']) {
    if (wanted('09')) {
      const { context, page } = await newContext(browser, vp, { webauthn: true });
      await go(page, '/login');
      await page.getByLabel('E-mail').fill('admin4@example.invalid');
      await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
      await clickText(page, 'Intră');
      await page.waitForURL(/\/login\/passkey/);
      await shot(page, '09', 'oferta-cheie', vp, 'Creează o cheie de acces');
      await context.close();
    }
  }

  // 10 and 11: invite and forgot-password.
  const inviteToken = 'ct-invite-token-synthetic-0123456789';
  if (wanted('10')) {
    sql(`delete from admin_users where email='invitat@example.invalid'`);
    sql(`insert into admin_users (firstname, lastname, email, registration_token, is_active, blocked, prefered_language, created_at, updated_at) values ('Invitat','Fixture','invitat@example.invalid','${inviteToken}',false,false,'ro',now(),now())`);
  }
  for (const vp of ['desktop', 'phone']) {
    if (wanted('10')) {
      const { context, page } = await newContext(browser, vp);
      await shot(page, '10', 'invitatie', vp, 'invitat@example.invalid', { status: await go(page, `/invite?registrationToken=${inviteToken}`) });
      await context.close();
    }
    if (wanted('11')) {
      const { context, page } = await newContext(browser, vp);
      await shot(page, '11a', 'parola-uitata-email', vp, 'Am uitat parola', { status: await go(page, '/forgot-password') });
      await page.getByLabel('E-mail').fill('admin3@example.invalid');
      await clickText(page, 'Trimite codul');
      // Brevo is unset in this stack, so the mail cannot go: the page shows its real send error.
      await shot(page, '11b', 'parola-uitata-trimitere-esuata', vp, 'Nu am putut trimite');
      // The "code sent" state needs a mail; this one answers the request as a sent mail would (a stand-in, only for the picture).
      await page.route('**/api/admin-auth/reset/request', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { message: 'ok' } }) }));
      await clickText(page, 'Trimite codul');
      await shot(page, '11c', 'parola-uitata-cod-simulat', vp, 'Cod din e-mail');
      await page.unroute('**/api/admin-auth/reset/request');
      await page.getByLabel('Cod din e-mail').fill('000000');
      await page.getByLabel('Parolă nouă', { exact: true }).fill('Alta-Parola-Throwaway-9');
      await clickText(page, 'Salvează parola');
      await shot(page, '11d', 'parola-uitata-cod-gresit', vp, 'Codul nu este corect');
      await context.close();
    }
  }

  // 19 to 23 and the role checks: the three roles.
  const states = {};
  const roleSteps = ['19', '20', '21', '22', '23', '28', '29', '30', '31', '32', '33'];
  // The access token lasts 30 minutes: sessions are made again before each group of screens.
  const freshStates = async () => {
    states.super = await signIn(browser, 'admin1@example.invalid');
    states.club = await signIn(browser, 'admin3@example.invalid');
    states.site = await signIn(browser, 'admin4@example.invalid');
  };
  const ROLES = [
    { key: 'super', label: 'super-admin', menuId: '19' },
    { key: 'club', label: 'administrator-club', menuId: '20' },
    { key: 'site', label: 'editor-site', menuId: '21' },
  ];
  for (const vp of ['desktop', 'phone']) {
    if (roleSteps.some(wanted)) await freshStates();
    for (const role of ROLES) {
      const open = async () => newContext(browser, vp, { storageState: states[role.key] });
      if (wanted(role.menuId)) {
        const { context, page } = await open();
        await go(page, '/admin/plugins/edusport-dashboard');
        if (vp === 'phone') {
          // The phone shows the same entries in its menu sheet (a tall viewport, so the whole list is in the picture).
          await page.setViewportSize({ width: 390, height: 1700 });
          await page.getByRole('button', { name: /meniu|navigare/i }).first().click().catch(() => {});
          await settle(page, 400);
        } else {
          // Every group of the sidebar open, in a tall window, so each entry the role has is in the picture.
          await page.setViewportSize({ width: 1280, height: 1500 });
          for (const toggle of await page.locator('nav [aria-expanded="false"]').all()) await toggle.click().catch(() => {});
          await page.locator('nav').first().evaluate((el) => { el.scrollTop = 0; for (let p = el.parentElement; p; p = p.parentElement) p.scrollTop = 0; });
          await settle(page, 300);
        }
        await shot(page, role.menuId, `meniu-${role.label}`, vp, null);
        await context.close();
      }
      if (wanted('22')) {
        const { context, page } = await open();
        const target = role.key === 'site' ? '/admin/plugins/edusport-sportivi' : null;
        if (target) {
          await go(page, target);
          await shot(page, '22', `fara-acces-${role.label}`, vp, 'Nu ai acces la această pagină.');
        }
        await context.close();
      }
      if (wanted('23') && role.key !== 'site') {
        const { context, page } = await open();
        await go(page, '/admin/plugins/edusport-contabilitate');
        await shot(page, '23', `contabilitate-${role.label}`, vp, 'Pe scurt');
        await context.close();
      }
      if (wanted('30') && role.key !== 'site') {
        const { context, page } = await open();
        await go(page, '/admin/plugins/edusport-tabele');
        await shot(page, '30', `tabele-${role.label}`, vp, 'Exportă');
        await context.close();
      }
      if (wanted('31') && role.key === 'site') {
        const { context, page } = await open();
        await go(page, '/admin/plugins/edusport-tabele');
        await shot(page, '31', `tabele-${role.label}`, vp, 'Nu ai acces la această pagină.');
        await go(page, '/admin/plugins/edusport-contabilitate');
        await shot(page, '31b', `contabilitate-${role.label}`, vp, 'Nu ai acces la această pagină.');
        await context.close();
      }
      if (wanted('32') && role.key === 'site') {
        // The dashboard of a site editor: no spinner left, no error.
        const { context, page } = await open();
        await go(page, '/admin/plugins/edusport-dashboard');
        await page.waitForTimeout(1500);
        await settle(page, 500);
        const spinner = await page.locator('[role="progressbar"], .ui-spinner, .animate-spin').count();
        const error = await page.getByText(/nu am putut|eroare|a apărut o problemă/i).count();
        if (spinner > 0 || error > 0) failures.push(`32 dashboard site editor: spinner ${spinner}, error ${error}`);
        await shot(page, '32', `panou-${role.label}`, vp, 'Bună,');
        await context.close();
      }
    }
  }

  // 33: a site editor edits a website content type field in the Content Manager (fields editable, the save goes through).
  if (wanted('33')) {
    for (const vp of ['desktop', 'phone']) {
      states.site = await signIn(browser, 'admin4@example.invalid');
      const { context, page } = await newContext(browser, vp, { storageState: states.site });
      const puts = [];
      page.on('response', (r) => { if (r.request().method() === 'PUT' && r.url().includes('/content-manager/')) puts.push(r.status()); });
      const status = await go(page, '/admin/content-manager/collection-types/api::article.article/create');
      const first = page.locator('main input[name]:not([type=hidden]), main textarea[name]').first();
      await first.waitFor({ state: 'visible', timeout: 20000 }).catch(async () => { await page.screenshot({ path: join(OUT, `33-debug-${vp}.png`) }); throw new Error('33: no editable field appeared'); });
      const editable = await first.isEditable();
      if (!editable) failures.push('33 content manager field is not editable');
      await first.fill('Articol de verificare');
      await shot(page, '33', 'content-manager-editor-site', vp, null, { status });
      if (vp === 'desktop') {
        // The write goes through too (the role has create on the type): the save answers 2xx.
        const saved = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/content-manager/collection-types/api::article.article'), { timeout: 15000 });
        await page.getByRole('button', { name: 'Salvează' }).first().click();
        const answer = await saved.then((r) => r.status()).catch(() => 0);
        if (answer < 200 || answer >= 300) failures.push(`33 content manager save answered ${answer}`);
        console.log('33 save status', answer);
        await settle(page, 600);
        await shot(page, '33b', 'content-manager-salvat-editor-site', vp, null);
      }
      await context.close();
    }
  }

  // 12 to 17: Securitate of a Super Admin (admin1, no 2FA at the start): the app setup, the backup codes, a key, devices, Administratori.
  if (['12', '13', '14', '15', '16', '17'].some(wanted)) {
    const state = await signIn(browser, 'admin1@example.invalid');
    for (const vp of ['phone', 'desktop']) {
      const { context, page } = await newContext(browser, vp, { storageState: state });
      await go(page, '/admin/plugins/edusport-securitate');
      await shot(page, '12', 'securitate-2fa-oprit', vp, 'Aplicație de autentificare', { full: true });
      // The app can be switched on once: 13 and 14 on the desktop pass, the phone only shows the setup.
      await page.getByRole('button', { name: 'Activează' }).first().click();
      await shot(page, '13', 'aplicatie-qr', vp, 'Scanează codul', { full: true });
      if (vp === 'desktop') {
        const line = await page.getByText('Sau scrie cheia:').first().innerText();
        const key = line.replace('Sau scrie cheia:', '').replace(/\s/g, '');
        await page.getByLabel('Cod din aplicație').fill(nowCode(base32decode(key)));
        await page.getByRole('button', { name: 'Activează' }).last().click();
        await shot(page, '14', 'coduri-rezerva', vp, 'Fiecare cod merge o singură dată');
        await clickText(page, 'Gata');
      } else await clickText(page, 'Renunță');
      await context.close();
    }
    // The rest with the app on: the keys, the devices, Administratori.
    for (const vp of ['desktop', 'phone']) {
      const { context, page } = await newContext(browser, vp, { storageState: state, webauthn: true });
      await go(page, '/admin/plugins/edusport-securitate');
      if (vp === 'desktop') {
        await page.getByRole('button', { name: 'Creează o cheie de acces' }).first().click();
        await page.getByText('Chei de acces').first().waitFor();
        await page.waitForTimeout(1500);
        await settle(page);
      }
      await shot(page, '15', 'securitate-chei-acces', vp, 'Aplicație de autentificare', { full: true });
      await page.getByText('Dispozitive', { exact: false }).first().scrollIntoViewIfNeeded();
      await shot(page, '16', 'dispozitive', vp, 'Deconectează');
      await page.getByRole('button', { name: 'Resetează 2FA' }).first().scrollIntoViewIfNeeded();
      await shot(page, '17a', 'administratori', vp, 'Administratori');
      await page.getByRole('button', { name: 'Resetează 2FA' }).first().click();
      await shot(page, '17', 'administratori-resetare', vp, 'Renunță');
      await clickText(page, 'Renunță').catch(() => {});
      await context.close();
    }
  }

  // 24 to 27: the four admin e-mails as the server renders them.
  if (['24', '25', '26', '27'].some(wanted)) {
    const { renderSecurityMail } = dist('email/security-mail');
    const links = { site: 'https://scoaladepatinaj.com', program: 'https://scoaladepatinaj.com/cursuri/program', privacy: 'https://scoaladepatinaj.com/protectia-datelor', headerImage: null, whatsapp: null, phone: '0255 000 000', email: 'inscrieri@scoaladepatinaj.com', facebook: null };
    const mails = [
      ['24', 'email-cod', renderSecurityMail('code', { code: '123456' }, links), 'Codul tău'],
      ['25', 'email-blocare', renderSecurityMail('lockout2fa', {}, links), 'Am oprit intrarea'],
      ['26', 'email-resetare', renderSecurityMail('reset2fa', {}, links), 'Administratorul a resetat'],
      ['27', 'email-schimbare', renderSecurityMail('changed', { twoFactorOff: true }, links), '2FA a fost oprit'],
    ];
    for (const vp of ['desktop', 'phone']) {
      const { context, page } = await newContext(browser, vp);
      for (const [id, name, mail, text] of mails) {
        await page.setContent(mail.html);
        await shot(page, id, name, vp, text);
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  // A partial run (--only) keeps the entries of the screens it did not take.
  const previous = existsSync(join(OUT, 'manifest.json')) ? JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8')) : [];
  const taken = new Set(manifest.map((m) => m.file));
  const all = [...previous.filter((m) => !taken.has(m.file)), ...manifest].sort((a, b) => a.file.localeCompare(b.file, 'en', { numeric: true }));
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(all, null, 2));
  writeIndex(all);
  console.log(failures.length ? `FAILED (${failures.length}):\n${failures.join('\n')}` : `all ${manifest.length} screens loaded`);
  process.exitCode = failures.length ? 1 : 0;
}
