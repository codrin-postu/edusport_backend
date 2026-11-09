/** The 2FA mails (spec 12): the code, the 2FA lockout, a reset by an administrator, an account change. Layout E1 as the portal mails. */
import type { Core } from '@strapi/strapi';
import { SECURITY_MAIL } from '../club/security/copy';
import { directMailSender, renderLetter } from './portal-direct';
import type { EmailLinks, RenderedEmail } from './registration-template';

export type SecurityMailData = {
  code: { code: string };
  lockout2fa: Record<string, never>;
  reset2fa: Record<string, never>;
  changed: { twoFactorOff: true } | { passkey: string };
};
export type SecurityMailKind = keyof SecurityMailData;
export type SecurityMail = { [K in SecurityMailKind]: { kind: K; data: SecurityMailData[K] } }[SecurityMailKind];
export type SendSecurityMail = (to: string, mail: SecurityMail) => Promise<boolean>;

type Letter = { subject: string; lines: string[] };

function letter(mail: SecurityMail): Letter {
  const m = SECURITY_MAIL;
  if (mail.kind === 'code') return { subject: m.code.subject, lines: [m.code.line(mail.data.code), m.code.valid, m.code.advice] };
  if (mail.kind === 'lockout2fa') return { subject: m.lockout.subject, lines: [m.lockout.text, m.lockout.advice] };
  if (mail.kind === 'reset2fa') return { subject: m.reset.subject, lines: [m.reset.text, m.reset.advice] };
  const change = 'passkey' in mail.data ? m.changed.passkey(mail.data.passkey) : m.changed.twoFactorOff;
  return { subject: m.changed.subject, lines: [change, m.changed.advice] };
}

export function renderSecurityMail<K extends SecurityMailKind>(kind: K, data: SecurityMailData[K], links: EmailLinks): RenderedEmail {
  const { subject, lines } = letter({ kind, data } as SecurityMail);
  return renderLetter(subject, [...lines.map((line) => [line]), [SECURITY_MAIL.signature]], links);
}

export const securityMailSender = (strapi: Core.Strapi): SendSecurityMail =>
  directMailSender(strapi, (mail, links) => renderSecurityMail(mail.kind, mail.data, links));
