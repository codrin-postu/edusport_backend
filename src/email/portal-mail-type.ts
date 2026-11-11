/** The portal mail types, apart from portal-direct.ts (server code) so the admin type check can reach them. */
export type PortalMail =
  | { kind: 'reset'; code: string }
  | { kind: 'lockout' }
  | { kind: 'new-device'; device: string; at: Date; host?: string }
  | { kind: 'email-changed'; newEmail: string };

export type SendPortalMail = (to: string, mail: PortalMail) => Promise<boolean>;
