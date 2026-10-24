import { expiredLinkUrl } from '../club/documents/requests';
import { cmsPublicUrl } from '../sheets/admin-link';

/**
 * E-mail settings, read from the environment (see .env.example, "E-mail (Brevo)").
 * The header image is served by this CMS at CMS_PUBLIC_URL + HEADER_IMAGE_PATH (CMS_PUBLIC_URL is
 * shared with the Sheet links, plan 2E); without CMS_PUBLIC_URL the header falls back to text.
 * The site address ("Vezi programul", privacy, footer) is the one plan 2D sends expired links to: the
 * first FRONTEND_ORIGIN entry, http://localhost:3000 outside production, none in production without it.
 *
 * Real recipients only in production with EMAIL_LIVE=true. Everywhere else every e-mail
 * goes to EMAIL_TEST_RECIPIENT, so a local or test run never reaches a parent, even with
 * a copy of the production database and a real Brevo key.
 */
export type Sender = { email: string; name: string };

export type EmailConfig = {
  apiKey: string | null;
  live: boolean;
  testRecipient: string | null;
  sender: Sender | null;
  replyTo: string | null;
  siteUrl: string | null;
  headerImageUrl: string | null;
};

export type BlockedReason = 'no-key' | 'no-sender' | 'no-site-url' | 'no-test-recipient';
export type Delivery = { ok: true; to: string } | { ok: false; reason: BlockedReason };

export const DEFAULT_SENDER_NAME = 'Școala de Patinaj EduSport';
export const HEADER_IMAGE_PATH = '/email/edusport-header.png';

const clean = (v: string | undefined): string | null => (v && v.trim() ? v.trim() : null);

/** The public site's origin, by plan 2D's rule (`expiredLinkUrl`), so the site address is configured once. */
export function publicSiteUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const link = expiredLinkUrl(env);
  return link ? new URL(link).origin : null;
}

export function readEmailConfig(env: NodeJS.ProcessEnv = process.env): EmailConfig {
  const from = clean(env.EMAIL_FROM_ADDRESS);
  const cms = cmsPublicUrl(env);
  return {
    apiKey: clean(env.BREVO_API_KEY),
    live: env.NODE_ENV === 'production' && env.EMAIL_LIVE === 'true',
    testRecipient: clean(env.EMAIL_TEST_RECIPIENT),
    sender: from ? { email: from, name: clean(env.EMAIL_FROM_NAME) ?? DEFAULT_SENDER_NAME } : null,
    replyTo: clean(env.EMAIL_REPLY_TO),
    siteUrl: publicSiteUrl(env),
    headerImageUrl: cms ? `${cms}${HEADER_IMAGE_PATH}` : null,
  };
}

/** Why no e-mail can be sent from this server right now, or null when it can. */
export function blockedReason(config: EmailConfig): BlockedReason | null {
  if (!config.apiKey) return 'no-key';
  if (!config.sender) return 'no-sender';
  if (!config.siteUrl) return 'no-site-url';
  if (!config.live && !config.testRecipient) return 'no-test-recipient';
  return null;
}

/** Where an e-mail for `recipient` really goes, or why it cannot be sent now (the job then stays queued). */
export function deliveryTarget(config: EmailConfig, recipient: string): Delivery {
  const reason = blockedReason(config);
  if (reason) return { ok: false, reason };
  if (config.live) return { ok: true, to: recipient };
  return { ok: true, to: config.testRecipient ?? '' }; // never the parent: blockedReason guarantees a test address
}
