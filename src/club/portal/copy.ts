export const PORTAL_ERRORS = {
  wrongLogin: 'E-mailul sau parola nu sunt corecte.',
  paused: 'Prea multe încercări. Încearcă din nou peste 15 minute.',
  googleNoAccount: 'Nu am găsit un cont pentru adresa asta.',
  inviteExpired: 'Invitația a expirat. Cere administratorului una nouă.',
  badCode: 'Codul nu este corect sau a expirat.',
  sendFailed: 'Nu am putut trimite e-mailul. Încearcă din nou.',
  passwordShort: 'Parola trebuie să aibă cel puțin 10 caractere.',
  passwordLong: 'Parola poate avea cel mult 128 de caractere.',
  passwordWeak: 'Parola este prea ușor de ghicit. Alege alta.',
  currentWrong: 'Parola actuală nu este corectă.',
  emailTaken: 'Adresa are deja un cont.',
  archived: 'Arhivată. Nu mai poate fi modificată.',
  noAccess: 'Nu mai ai acces la această grupă.',
  invalid: 'Cerere invalidă.',
  failed: 'Acțiunea nu a reușit. Nimic nu a fost salvat.',
  notFound: 'Nu a fost găsit.',
  loadFailed: 'Nu am putut încărca datele.',
} as const;

export const googleOtherEmail = (email: string): string => `Contul Google nu are adresa ${email}.`;

export const RESET_SENT = 'Dacă adresa are cont, am trimis un cod.';

export const PORTAL_TOASTS = { saved: 'Salvat.' } as const;

export const PORTAL_ACTIONS = {
  inviteSent: 'portal-invite-sent',
  inviteResent: 'portal-invite-resent',
  relinked: 'portal-relinked',
  activated: 'portal-activated',
  activatedGoogle: 'portal-activated-google',
  passwordChanged: 'portal-password-changed',
  passwordReset: 'portal-password-reset',
  locked: 'portal-locked',
  disabled: 'portal-disabled',
  enabled: 'portal-enabled',
  emailChanged: 'portal-email-changed',
} as const;

type Changes = Record<string, unknown>;

const HISTORY_TEXT = new Map<string, (c: Changes) => string>([
  [PORTAL_ACTIONS.inviteSent, (c) => `Invitație trimisă la ${String(c.email)}.`],
  [PORTAL_ACTIONS.inviteResent, () => 'Invitație retrimisă.'],
  [PORTAL_ACTIONS.relinked, (c) => (typeof c.name === 'string' && c.name.trim() !== '' ? `Cont refolosit pentru ${c.name}` : 'Cont refolosit')],
  [PORTAL_ACTIONS.activated, () => 'Cont activat.'],
  [PORTAL_ACTIONS.activatedGoogle, () => 'Cont activat cu Google.'],
  [PORTAL_ACTIONS.passwordChanged, () => 'Parolă schimbată.'],
  [PORTAL_ACTIONS.passwordReset, () => 'Parolă resetată.'],
  [PORTAL_ACTIONS.locked, () => 'Cont blocat 15 minute după 5 încercări greșite.'],
  [PORTAL_ACTIONS.disabled, () => 'Cont dezactivat.'],
  [PORTAL_ACTIONS.enabled, () => 'Cont activat de administrator.'],
  [PORTAL_ACTIONS.emailChanged, (c) => `E-mail schimbat din ${String(c.from)} în ${String(c.to)}.`],
]);

export function portalHistoryText(action: string, changes: Changes): string | null {
  const text = HISTORY_TEXT.get(action);
  return text ? text(changes) : null;
}

export const MAIL_COPY = {
  reset: {
    subject: 'Codul pentru parola nouă',
    code: (c: string): string => `Codul tău: ${c}`,
    valid: 'Este valabil 10 minute.',
    ignore: 'Dacă nu ai cerut tu, ignoră acest e-mail.',
  },
  lockout: {
    subject: 'Încercări de intrare în cont',
    text: 'Am oprit intrarea în contul tău pentru 15 minute după 5 parole greșite.',
    advice: 'Dacă nu ai fost tu, schimbă parola după pauză.',
  },
  newDevice: {
    subject: 'Intrare de pe un dispozitiv nou',
    line: (device: string, date: string, time: string): string => `${device}, ${date} ${time}.`,
    advice: 'Dacă nu ai fost tu, schimbă parola.',
  },
  signature: 'Echipa EduSport',
} as const;

export const DEVICE_WORDS = {
  phone: 'Telefon',
  tablet: 'Tabletă',
  computer: 'Calculator',
  unknown: 'Dispozitiv necunoscut',
} as const;

export * from './copy-admin';
