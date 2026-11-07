import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SECURITY_ACTIONS, SECURITY_COPY, SECURITY_ERRORS, SECURITY_MAIL, SECURITY_TOASTS, securityHistoryText } from '../copy';

const TABLE: [string, string, string][] = [
  ['errors', 'unavailable', '2FA nu este disponibil acum.'],
  ['errors', 'badCode', 'Codul nu este corect sau a expirat.'],
  ['errors', 'pendingExpired', 'Intrarea a expirat. Intră din nou.'],
  ['errors', 'paused', 'Prea multe încercări. Încearcă din nou peste 15 minute.'],
  ['errors', 'passkeyFailed', 'Nu am putut folosi cheia de acces.'],
  ['errors', 'passkeyOtherKind', 'Cheia nu este pentru această pagină.'],
  ['errors', 'appAlreadyOn', 'Aplicația este deja activă.'],
  ['errors', 'passkeyLimit', 'Ai deja 10 chei de acces. Șterge una ca să adaugi alta.'],
  ['errors', 'selfReset', 'Nu poți reseta propriul 2FA.'],
  ['errors', 'wrongCurrent', 'Parola actuală nu este corectă.'],
  ['errors', 'noAccess', 'Nu ai acces la această pagină.'],
  ['errors', 'googleNoAccount', 'Nu am găsit un cont pentru adresa asta.'],
  ['toasts', 'twoFactorOn', '2FA activat.'],
  ['toasts', 'twoFactorOff', '2FA oprit.'],
  ['toasts', 'newCodes', 'Coduri noi generate.'],
  ['toasts', 'passkeyCreated', 'Cheie de acces creată.'],
  ['toasts', 'passkeyDeleted', 'Cheie de acces ștearsă.'],
  ['toasts', 'saved', 'Salvat.'],
  ['toasts', 'passwordChanged', 'Parolă schimbată.'],
  ['toasts', 'twoFactorReset', '2FA resetat.'],
];

describe('security copy', () => {
  it.each(TABLE)('%s.%s', (group, key, expected) => {
    const source: Record<string, string> = group === 'errors' ? SECURITY_ERRORS : SECURITY_TOASTS;
    expect(source[key]).toBe(expected);
  });

  it('login screen (10.1)', () => {
    const c = SECURITY_COPY.login;
    expect([c.title, c.brand, c.google, c.or, c.email, c.password, c.showPassword, c.hidePassword, c.remember, c.submit, c.passkey, c.forgot]).toEqual([
      'Intră în cont', 'Panou de administrare', 'Continuă cu Google', 'sau', 'E-mail', 'Parolă', 'Arată parola', 'Ascunde parola', 'Ține-mă minte', 'Intră',
      'Folosește cheia de acces', 'Am uitat parola',
    ]);
    expect(c.wrongLogin).toBe('E-mailul sau parola nu sunt corecte.');
    expect(c.sendFailed).toBe('Nu am putut trimite e-mailul. Încearcă din nou.');
  });

  it('second step (11.2)', () => {
    const c = SECURITY_COPY.secondStep;
    expect([c.title, c.appPrompt, c.appField, c.emailField, c.resend, c.backupPrompt, c.backupField, c.remember, c.verify, c.otherMethod, c.back]).toEqual([
      '2FA', 'Scrie codul din aplicația de autentificare.', 'Cod', 'Cod din e-mail', 'Trimite din nou', 'Scrie unul dintre codurile de rezervă.',
      'Cod de rezervă', 'Ține minte dispozitivul 30 de zile', 'Verifică', 'Altă metodă', 'Înapoi la intrare',
    ]);
    expect(c.emailSent('a@example.invalid')).toBe('Am trimis un cod pe a@example.invalid.');
    expect(c.methods).toEqual({ totp: 'Aplicație de autentificare', email: 'Cod pe e-mail', backup: 'Cod de rezervă' });
  });

  it('invite and reset (10.3, 4.7)', () => {
    const i = SECURITY_COPY.invite;
    expect([i.title, i.newPassword, i.savePassword, i.or, i.google, i.expired, i.emailTaken]).toEqual([
      'Bun venit', 'Parolă nouă', 'Salvează parola', 'sau', 'Continuă cu Google', 'Invitația a expirat. Cere administratorului una nouă.', 'Adresa are deja un cont.',
    ]);
    expect(i.account('a@example.invalid')).toBe('Contul tău: a@example.invalid');
    const r = SECURITY_COPY.reset;
    expect([r.sendCode, r.sent, r.codeField, r.newPassword, r.savePassword, r.back]).toEqual([
      'Trimite codul', 'Dacă adresa are cont, am trimis un cod.', 'Cod din e-mail', 'Parolă nouă', 'Salvează parola', 'Înapoi la intrare',
    ]);
  });

  it('offer (8.4)', () => {
    expect(SECURITY_COPY.offer).toEqual({
      title: 'Creează o cheie de acces',
      line: 'Intri cu amprenta, fața sau codul telefonului, fără parolă.',
      create: 'Creează',
      notNow: 'Nu acum',
    });
  });

  it('Securitate 2FA, backup codes, passkeys, devices (11.3, 6.3, 6.4, 8.6)', () => {
    const t = SECURITY_COPY.twoFactor;
    expect([t.title, t.app, t.email, t.active, t.off, t.enable, t.disable, t.appScan, t.appCode, t.emailCode, t.turnOffLast, t.confirmOff, t.cancel]).toEqual([
      '2FA', 'Aplicație de autentificare', 'Cod pe e-mail', 'Activ', 'Oprit', 'Activează', 'Oprește', 'Scanează codul cu aplicația de autentificare.',
      'Cod din aplicație', 'Cod din e-mail', 'Oprești 2FA? Codurile de rezervă vor fi șterse.', 'Oprește', 'Renunță',
    ]);
    expect(t.appKey('ABCD EFGH')).toBe('Sau scrie cheia: ABCD EFGH');
    expect(t.turnOff('Cod pe e-mail')).toBe('Oprești Cod pe e-mail?');
    const b = SECURITY_COPY.backup;
    expect([b.title, b.generate, b.generateConfirm, b.note, b.download, b.copy, b.done]).toEqual([
      'Coduri de rezervă', 'Generează coduri noi', 'Codurile vechi nu vor mai merge.', 'Fiecare cod merge o singură dată. Păstrează-le, nu le mai arătăm.',
      'Descarcă', 'Copiază', 'Gata',
    ]);
    expect(b.left(7)).toBe('7 rămase');
    expect(b.backupLeft(1)).toBe('Mai ai 1 cod de rezervă.');
    for (const n of [2, 3, 10, 19, 101, 119]) expect(b.backupLeft(n)).toBe(`Mai ai ${n} coduri de rezervă.`);
    for (const n of [0, 20, 21, 99, 100, 120]) expect(b.backupLeft(n)).toBe(`Mai ai ${n} de coduri de rezervă.`);
    const p = SECURITY_COPY.passkeys;
    expect([p.title, p.rename, p.nameField, p.delete, p.create, p.old]).toEqual([
      'Chei de acces', 'Redenumește', 'Nume', 'Șterge', 'Creează o cheie de acces', 'Cheie veche, nu mai merge. Creează una nouă.',
    ]);
    expect(p.rowSub('1 mai', '2 iunie')).toBe('Creată 1 mai, folosită 2 iunie');
    const d = SECURITY_COPY.devices;
    expect([d.title, d.device, d.lastSeen, d.disconnect]).toEqual(['Dispozitive', 'Dispozitiv', 'Ultima dată', 'Deconectează']);
    expect(d.rememberedUntil('5 decembrie 2026')).toBe('2FA ținut minte până la 5 decembrie 2026.');
  });

  it('admin Securitate and Cont portal (10.4, 10.5, 4.6)', () => {
    const pw = SECURITY_COPY.password;
    expect([pw.title, pw.current, pw.next, pw.change]).toEqual(['Parolă', 'Parola actuală', 'Parola nouă', 'Schimbă parola']);
    const g = SECURITY_COPY.google;
    expect([g.title, g.unlink, g.notConnected, g.hint]).toEqual(['Google', 'Elimină legătura', 'Neconectat.', 'Pornește 2-Step Verification în contul Google.']);
    expect(g.connected('a@example.invalid')).toBe('Conectat: a@example.invalid');
    const a = SECURITY_COPY.admins;
    expect([a.title, a.on, a.off, a.reset]).toEqual(['Administratori', '2FA activ', '2FA oprit', 'Resetează 2FA']);
    const confirm = 'Resetezi 2FA pentru Ana Pop? Toate dispozitivele vor fi deconectate.';
    expect(a.confirmReset('Ana Pop')).toBe(confirm);
    expect(SECURITY_COPY.portalAccount.reset).toBe('Resetează 2FA');
    expect(SECURITY_COPY.portalAccount.confirmReset('Ana Pop')).toBe(confirm);
  });

  it('mail copy (12)', () => {
    expect(SECURITY_MAIL.code.subject).toBe('Codul tău pentru 2FA');
    expect(SECURITY_MAIL.code.line('123456')).toBe('Codul tău: 123456');
    expect(SECURITY_MAIL.code.valid).toBe('Este valabil 10 minute.');
    expect(SECURITY_MAIL.code.advice).toBe('Dacă nu ai încercat tu să intri, schimbă parola.');
    expect(SECURITY_MAIL.lockout.text).toBe('Am oprit intrarea în contul tău pentru 15 minute după 5 coduri greșite.');
    expect(SECURITY_MAIL.reset.subject).toBe('2FA a fost resetat');
    expect(SECURITY_MAIL.reset.text).toBe('Administratorul a resetat 2FA pentru contul tău.');
    expect(SECURITY_MAIL.reset.advice).toBe('Dacă nu ai cerut tu, anunță administratorul.');
    expect(SECURITY_MAIL.changed.subject).toBe('Setările contului tău s-au schimbat');
    expect(SECURITY_MAIL.changed.twoFactorOff).toBe('2FA a fost oprit.');
    expect(SECURITY_MAIL.changed.passkey('Telefon')).toBe('A fost creată o cheie de acces: Telefon.');
    expect(SECURITY_MAIL.changed.advice).toBe('Dacă nu ai fost tu, schimbă parola.');
    expect(SECURITY_MAIL.signature).toBe('Echipa EduSport');
  });
});

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (typeof value === 'function') out.push(String((value as (...a: unknown[]) => unknown)('X', 'Y')));
  else if (value && typeof value === 'object') for (const v of Object.values(value)) strings(v, out);
  return out;
}

describe('copy rules', () => {
  it('no value uses verificare, a dash, a middle dot, a curly quote or Email without the hyphen', () => {
    const all = strings([SECURITY_ERRORS, SECURITY_TOASTS, SECURITY_COPY, SECURITY_MAIL]);
    const lines = Object.values(SECURITY_ACTIONS).flatMap((a) =>
      securityHistoryText(a, { left: 3, name: 'N', by: 'Ana Pop' }) ?? [],
    );
    expect(all.length).toBeGreaterThan(100);
    for (const s of [...all, ...lines]) {
      expect(s, s).not.toMatch(/verificare/i);
      expect(s, s).not.toMatch(/[—–·„”“]/);
      expect(s, s).not.toMatch(/\bEmail\b/);
    }
  });
});

describe('history lines (13)', () => {
  const cases: [keyof typeof SECURITY_ACTIONS, Record<string, unknown>, string][] = [
    ['totpOn', {}, '2FA activat: aplicație.'],
    ['emailOn', {}, '2FA activat: cod pe e-mail.'],
    ['totpOff', {}, '2FA oprit: aplicație.'],
    ['emailOff', {}, '2FA oprit: cod pe e-mail.'],
    ['newCodes', {}, 'Coduri de rezervă noi.'],
    ['backupUsed', { left: 3 }, 'Cod de rezervă folosit, mai sunt 3.'],
    ['passkeyCreated', { name: 'Telefon' }, 'Cheie de acces creată: Telefon.'],
    ['passkeyDeleted', { name: 'Telefon' }, 'Cheie de acces ștearsă: Telefon.'],
    ['reset', { by: 'Ana Pop' }, '2FA resetat de Ana Pop.'],
    ['reset', { by: 'server' }, '2FA resetat de pe server.'],
    ['locked', {}, 'Blocat 15 minute după 5 coduri greșite.'],
    ['passwordChanged', {}, 'Parolă schimbată.'],
    ['passwordReset', {}, 'Parolă resetată.'],
    ['googleLinked', {}, 'Google conectat.'],
    ['googleUnlinked', {}, 'Legătura cu Google eliminată.'],
  ];
  it.each(cases)('%s', (action, changes, expected) => {
    expect(securityHistoryText(SECURITY_ACTIONS[action], changes)).toBe(expected);
  });

  it('an unknown action has no line', () => {
    expect(securityHistoryText('nope', {})).toBeNull();
  });
});

describe('api-types.ts', () => {
  it('has no import', () => {
    const source = readFileSync(join(__dirname, '../api-types.ts'), 'utf8');
    expect(source).not.toMatch(/^\s*import\b/m);
    expect(source).not.toMatch(/\brequire\(/);
  });
});
