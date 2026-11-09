import { MAIL_COPY, PORTAL_ERRORS, RESET_SENT } from '../portal/copy';

export const SECURITY_ERRORS = {
  unavailable: '2FA nu este disponibil acum.',
  badCode: PORTAL_ERRORS.badCode,
  pendingExpired: 'Intrarea a expirat. Intră din nou.',
  paused: PORTAL_ERRORS.paused,
  passkeyFailed: 'Nu am putut folosi cheia de acces.',
  passkeyOtherKind: 'Cheia nu este pentru această pagină.',
  appAlreadyOn: 'Aplicația este deja activă.',
  passkeyLimit: 'Ai deja 10 chei de acces. Șterge una ca să adaugi alta.',
  selfReset: 'Nu poți reseta propriul 2FA.',
  wrongCurrent: PORTAL_ERRORS.currentWrong,
  noAccess: 'Nu ai acces la această pagină.',
  // Shown when adding a passkey needs a fresh confirmation (403 on the passkey options and register calls).
  reauthRequired: 'Confirmă din nou ca să continui.',
  googleNoAccount: PORTAL_ERRORS.googleNoAccount,
} as const;

export const SECURITY_TOASTS = {
  twoFactorOn: '2FA activat.',
  twoFactorOff: '2FA oprit.',
  newCodes: 'Coduri noi generate.',
  passkeyCreated: 'Cheie de acces creată.',
  passkeyDeleted: 'Cheie de acces ștearsă.',
  saved: 'Salvat.',
  passwordChanged: 'Parolă schimbată.',
  twoFactorReset: '2FA resetat.',
} as const;

export const SECURITY_COPY = {
  page: {
    title: 'Securitate',
  },
  login: {
    title: 'Intră în cont',
    brand: 'Panou de administrare',
    google: 'Continuă cu Google',
    or: 'sau',
    email: 'E-mail',
    password: 'Parolă',
    showPassword: 'Arată parola',
    hidePassword: 'Ascunde parola',
    remember: 'Ține-mă minte',
    submit: 'Intră',
    passkey: 'Folosește cheia de acces',
    forgot: 'Am uitat parola',
    wrongLogin: PORTAL_ERRORS.wrongLogin,
    sendFailed: PORTAL_ERRORS.sendFailed,
  },
  secondStep: {
    title: '2FA',
    appPrompt: 'Scrie codul din aplicația de autentificare.',
    appField: 'Cod',
    emailSent: (email: string): string => `Am trimis un cod pe ${email}.`,
    emailField: 'Cod din e-mail',
    resend: 'Trimite din nou',
    backupPrompt: 'Scrie unul dintre codurile de rezervă.',
    backupField: 'Cod de rezervă',
    remember: 'Ține minte dispozitivul 30 de zile',
    verify: 'Verifică',
    otherMethod: 'Altă metodă',
    methods: { totp: 'Aplicație de autentificare', email: 'Cod pe e-mail', backup: 'Cod de rezervă' },
    back: 'Înapoi la intrare',
  },
  invite: {
    title: 'Bun venit',
    account: (email: string): string => `Contul tău: ${email}`,
    newPassword: 'Parolă nouă',
    savePassword: 'Salvează parola',
    or: 'sau',
    google: 'Continuă cu Google',
    expired: 'Invitația a expirat. Cere administratorului una nouă.',
    emailTaken: PORTAL_ERRORS.emailTaken,
  },
  reset: {
    sendCode: 'Trimite codul',
    sent: RESET_SENT,
    codeField: 'Cod din e-mail',
    newPassword: 'Parolă nouă',
    savePassword: 'Salvează parola',
    back: 'Înapoi la intrare',
  },
  offer: {
    title: 'Creează o cheie de acces',
    line: 'Intri cu amprenta, fața sau codul telefonului, fără parolă.',
    create: 'Creează',
    notNow: 'Nu acum',
  },
  twoFactor: {
    title: '2FA',
    app: 'Aplicație de autentificare',
    email: 'Cod pe e-mail',
    active: 'Activ',
    off: 'Oprit',
    enable: 'Activează',
    disable: 'Oprește',
    appScan: 'Scanează codul cu aplicația de autentificare.',
    appKey: (key: string): string => `Sau scrie cheia: ${key}`,
    appCode: 'Cod din aplicație',
    emailSent: (email: string): string => `Am trimis un cod pe ${email}.`,
    emailCode: 'Cod din e-mail',
    turnOff: (method: string): string => `Oprești ${method}?`,
    turnOffLast: 'Oprești 2FA? Codurile de rezervă vor fi șterse.',
    confirmOff: 'Oprește',
    cancel: 'Renunță',
  },
  backup: {
    title: 'Coduri de rezervă',
    left: (n: number): string => `${n} rămase`,
    generate: 'Generează coduri noi',
    generateConfirm: 'Codurile vechi nu vor mai merge.',
    note: 'Fiecare cod merge o singură dată. Păstrează-le, nu le mai arătăm.',
    download: 'Descarcă',
    copy: 'Copiază',
    done: 'Gata',
    backupLeft: (n: number): string => {
      if (n === 1) return 'Mai ai 1 cod de rezervă.';
      const de = n % 100 === 0 || n % 100 >= 20 ? 'de ' : '';
      return `Mai ai ${n} ${de}coduri de rezervă.`;
    },
  },
  passkeys: {
    title: 'Chei de acces',
    rowSub: (created: string, used: string): string => `Creată ${created}, folosită ${used}`,
    rename: 'Redenumește',
    nameField: 'Nume',
    delete: 'Șterge',
    create: 'Creează o cheie de acces',
    old: 'Cheie veche, nu mai merge. Creează una nouă.',
    // COPY NEEDED: the three strings below were not in the approved text review (used by the Securitate list and the confirmation step).
    neverUsed: 'niciodată',
    saveName: 'Salvează',
    reauthConfirm: 'Confirmă',
  },
  devices: {
    title: 'Dispozitive',
    device: 'Dispozitiv',
    lastSeen: 'Ultima dată',
    disconnect: 'Deconectează',
    current: 'Acest dispozitiv', // controller ruling 2026-11-09
    rememberedUntil: (date: string): string => `2FA ținut minte până la ${date}.`,
  },
  password: {
    title: 'Parolă',
    current: 'Parola actuală',
    next: 'Parola nouă',
    change: 'Schimbă parola',
  },
  google: {
    title: 'Google',
    connected: (email: string): string => `Conectat: ${email}`,
    unlink: 'Elimină legătura',
    confirmUnlink: 'Elimini legătura cu Google? Nu o poți reface din pagină.', // controller ruling 2026-11-09
    confirmUnlinkYes: 'Elimină',
    notConnected: 'Neconectat.',
    hint: 'Pornește 2-Step Verification în contul Google.',
  },
  admins: {
    title: 'Administratori',
    on: '2FA activ',
    off: '2FA oprit',
    reset: 'Resetează 2FA',
    confirmReset: (name: string): string => `Resetezi 2FA pentru ${name}? Toate dispozitivele vor fi deconectate.`,
  },
  portalAccount: {
    reset: 'Resetează 2FA',
    confirmReset: (name: string): string => `Resetezi 2FA pentru ${name}? Toate dispozitivele vor fi deconectate.`,
  },
} as const;

export const SECURITY_MAIL = {
  code: {
    subject: 'Codul tău pentru 2FA',
    line: (code: string): string => `Codul tău: ${code}`,
    valid: 'Este valabil 10 minute.',
    advice: 'Dacă nu ai încercat tu să intri, schimbă parola.',
  },
  lockout: {
    subject: MAIL_COPY.lockout.subject,
    text: 'Am oprit intrarea în contul tău pentru 15 minute după 5 coduri greșite.',
    advice: MAIL_COPY.lockout.advice,
  },
  reset: {
    subject: '2FA a fost resetat',
    text: 'Administratorul a resetat 2FA pentru contul tău.',
    advice: 'Dacă nu ai cerut tu, anunță administratorul.',
  },
  changed: {
    subject: 'Setările contului tău s-au schimbat',
    twoFactorOff: '2FA a fost oprit.',
    passkey: (name: string): string => `A fost creată o cheie de acces: ${name}.`,
    advice: 'Dacă nu ai fost tu, schimbă parola.',
  },
  signature: MAIL_COPY.signature,
} as const;

export const SECURITY_ACTIONS = {
  totpOn: 'totpOn',
  emailOn: 'emailOn',
  totpOff: 'totpOff',
  emailOff: 'emailOff',
  newCodes: 'newCodes',
  backupUsed: 'backupUsed',
  passkeyCreated: 'passkeyCreated',
  passkeyDeleted: 'passkeyDeleted',
  reset: 'reset',
  locked: 'locked',
  passwordLocked: 'passwordLocked',
  passwordChanged: 'passwordChanged',
  passwordReset: 'passwordReset',
  googleLinked: 'googleLinked',
  googleUnlinked: 'googleUnlinked',
} as const;

type Changes = Record<string, unknown>;
const text = (c: Changes, key: string): string => String(c[key]);

const HISTORY_TEXT = new Map<string, (c: Changes) => string>([
  [SECURITY_ACTIONS.totpOn, () => '2FA activat: aplicație.'],
  [SECURITY_ACTIONS.emailOn, () => '2FA activat: cod pe e-mail.'],
  [SECURITY_ACTIONS.totpOff, () => '2FA oprit: aplicație.'],
  [SECURITY_ACTIONS.emailOff, () => '2FA oprit: cod pe e-mail.'],
  [SECURITY_ACTIONS.newCodes, () => 'Coduri de rezervă noi.'],
  [SECURITY_ACTIONS.backupUsed, (c) => `Cod de rezervă folosit, mai sunt ${text(c, 'left')}.`],
  [SECURITY_ACTIONS.passkeyCreated, (c) => `Cheie de acces creată: ${text(c, 'name')}.`],
  [SECURITY_ACTIONS.passkeyDeleted, (c) => `Cheie de acces ștearsă: ${text(c, 'name')}.`],
  [SECURITY_ACTIONS.reset, (c) => (c.by === 'server' ? '2FA resetat de pe server.' : `2FA resetat de ${text(c, 'by')}.`)],
  [SECURITY_ACTIONS.locked, () => 'Blocat 15 minute după 5 coduri greșite.'],
  [SECURITY_ACTIONS.passwordLocked, () => 'Blocat 15 minute după 5 parole greșite.'],
  [SECURITY_ACTIONS.passwordChanged, () => 'Parolă schimbată.'],
  [SECURITY_ACTIONS.passwordReset, () => 'Parolă resetată.'],
  [SECURITY_ACTIONS.googleLinked, () => 'Google conectat.'],
  [SECURITY_ACTIONS.googleUnlinked, () => 'Legătura cu Google eliminată.'],
]);

export function securityHistoryText(action: string, changes: Changes): string | null {
  const line = HISTORY_TEXT.get(action);
  return line ? line(changes) : null;
}
