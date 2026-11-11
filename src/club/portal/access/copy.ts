import { countWords } from '../../ro-count';

/** Texts of the athlete access feature (spec 4, 11, 13). Romanian, straight quotes, "E-mail", no em or en dash, no middle dot. */
export const ACCESS_ERRORS = {
  disabled: 'Contul acestei adrese este dezactivat.',
  needsConfirm: 'Confirmă sportivul întâi.',
  needsEmail: 'Adaugă un e-mail în Date.',
  anonymized: 'Sportivul este anonimizat.',
  noAccess: 'Nu mai ai acces la acest sportiv.',
} as const;

export const ACCESS_COPY = {
  none: 'Fără acces în portal.',
  adult: 'Sportiv 18+',
  invited: 'Invitat',
  active: 'Activ',
  disabled: 'Cont dezactivat',
  inviteSent: 'Invitație trimisă.',
  accessAdded: 'Acces adăugat.',
  accessRemoved: 'Acces scos.',
  accountDisabled: 'Cont dezactivat.',
  inviteSubject: 'Acces la portalul EduSport',
  accessSubject: 'Acces nou în portalul EduSport',
  validDays: 'Linkul este valabil 7 zile.',
  enter: 'Intră în portal',
  disableAllConfirm: (name: string): string => `Dezactivezi tot contul lui ${name}? Toate dispozitivele vor fi deconectate, și pe sportiv.`,
  removeConfirm: (email: string, athlete: string): string => `Scoți accesul lui ${email} la ${athlete}?`,
  moveHint: (email: string): string => `Accesul în portal trece la ${email}.`,
  stopHint: 'Accesul în portal se oprește.',
  bulkPreview: (invites: number, addresses: number): string => `${countWords(invites, 'invitație', 'invitații')} către ${countWords(addresses, 'adresă', 'adrese')}`,
  bulkToast: (n: number): string => `${countWords(n, 'invitație trimisă', 'invitații trimise')}.`,
  forChildren: (names: string[]): string => `pentru ${names.join(' și ')}`,
} as const;

export const ACCESS_ACTIONS = {
  invite: 'Invită în portal',
  resend: 'Retrimite invitația',
  remove: 'Scoate accesul',
  send: 'Trimite',
  disableAll: 'Dezactivează tot',
} as const;

/** History lines (spec 13). */
export const ACCESS_HISTORY = {
  athleteInvited: (email: string): string => `Acces portal: invitație trimisă la ${email}`,
  athleteAdded: (email: string): string => `Acces portal adăugat: ${email}`,
  athleteRemoved: (email: string): string => `Acces portal scos: ${email}`,
  athleteMoved: (email: string): string => `Acces portal mutat la ${email}`,
  athleteStopped: 'Acces portal oprit (anonimizat)',
  accountAccess: (athlete: string): string => `Acces la ${athlete}`,
  coachSideOff: 'Partea de antrenor dezactivată',
  accountOff: 'Cont dezactivat complet',
  coachRoleAdded: 'Rol de antrenor adăugat',
} as const;

/** The parent invite and "access added" mails (spec 11). The coach invite mail keeps its own copy in `copy-admin.ts`. */
export const ACCESS_MAIL = {
  greeting: (name: string): string => `Bună, ${name},`,
  inviteLine: (children: string[]): string => `Ai primit acces la portalul EduSport ${ACCESS_COPY.forChildren(children)}.`,
  childLine: (child: string): string => `Ai acces și la ${child} în portalul EduSport.`,
  coachLine: (host: string): string => `Poți intra și pe ${host} cu același cont.`,
  signature: 'Echipa EduSport',
} as const;
