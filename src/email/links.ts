import type { EmailConfig } from './config';
import type { EmailLinks } from './registration-template';

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

/**
 * Links and contact lines for the e-mail. Site pages come from the public site address (`publicSiteUrl`;
 * never null here, `blockedReason` keeps jobs queued while it is unset); the WhatsApp channel, phone,
 * e-mail and Facebook from Setări site > Contact (`site-settings.contact`), as the website footer and
 * the form's success screen (plan 2C) read them. An empty WhatsApp link hides the button.
 */
export function buildEmailLinks(config: EmailConfig, contact: unknown): EmailLinks {
  const c = contact && typeof contact === 'object' ? (contact as Record<string, unknown>) : {};
  const site = config.siteUrl ?? '';
  return {
    site,
    program: `${site}/cursuri/program`,
    privacy: `${site}/protectia-datelor`,
    headerImage: config.headerImageUrl,
    whatsapp: text(c.whatsappChannelUrl),
    phone: text(c.phone),
    email: text(c.email),
    facebook: text(c.facebookUrl1),
  };
}
