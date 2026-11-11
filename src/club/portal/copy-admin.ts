/** Admin side of the coach portal: invite and e-mail change mails, the "Cont portal" block. Server-free. */
export const INVITE_MAIL = {
  subject: 'Contul tău EduSport de antrenor',
  greeting: (name: string): string => `Bună ziua, ${name},`,
  line: (host: string): string => `Ai un cont pe ${host}.`,
  button: 'Intră în cont',
  valid: 'Linkul este valabil 7 zile.',
  signature: 'Echipa EduSport',
} as const;

export const EMAIL_CHANGED_MAIL = {
  subject: 'Adresa contului tău de antrenor s-a schimbat',
  line: (email: string): string => `Adresa contului tău a fost schimbată în ${email}.`,
  advice: 'Dacă nu ai fost tu, anunță administratorul.',
} as const;

export const ACCOUNT_BLOCK = {
  title: 'Cont portal',
  emailLabel: 'E-mail pentru cont',
  invite: 'Trimite invitația',
  invited: (date: string): string => `Invitație trimisă pe ${date}.`,
  resend: 'Retrimite invitația',
  active: (date: string): string => `Cont activ din ${date}.`,
  disable: 'Dezactivează contul',
  disabled: 'Cont dezactivat.',
  enable: 'Activează contul',
  coachSideOff: 'Partea de antrenor e dezactivată. Accesul de părinte rămâne activ.',
  changeEmail: 'Schimbă e-mailul',
  newEmail: 'E-mail nou',
  saveEmail: 'Salvează e-mailul',
} as const;

/** Which buttons the account block shows (a coach side switched off keeps the account active for the parent access). */
export function accountBlockActions(block: { state: string; hasSportiv: boolean; coachDisabled: boolean }) {
  const active = block.state === 'active';
  return {
    disable: active && !block.coachDisabled,
    enable: block.state === 'disabled' || (active && block.coachDisabled),
    disableAll: active && block.hasSportiv,
  };
}

export const ACCOUNT_TOASTS = {
  invited: 'Invitație trimisă.',
  disabled: 'Cont dezactivat.',
  enabled: 'Cont activat.',
  emailChanged: 'E-mail schimbat.',
} as const;

/** The "Dezactivează contul" confirmation; the name is the team member's (empty when unknown). */
export function accountDisableConfirmText(name: string): string {
  const who = name.trim();
  return who === '' ? 'Dezactivezi contul? Toate dispozitivele vor fi deconectate.' : `Dezactivezi contul lui ${who}? Toate dispozitivele vor fi deconectate.`;
}
