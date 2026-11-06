/** Istoric subject types. A leaf module, so phase 4 history lines can read it without an import cycle with history-text. */
export const SUBJECT = {
  registration: 'registration-submission',
  athlete: 'athlete',
  session: 'session',
  lesson: 'lesson',
  subscription: 'subscription',
  payment: 'payment',
  portalAccount: 'portal-account',
} as const;
