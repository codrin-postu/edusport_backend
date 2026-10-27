import { PAYMENT_EMAIL_COPY } from '../club/presence/copy/email';
import { METHOD_WORDS } from '../club/presence/copy/core';
import { longDate } from '../club/presence/dates';
import { isIsoDate } from '../club/groups/dates';
import { isRecord } from '../club/narrow';
import type { PaymentEmailJob, PaymentEmailPayload, PaymentMethod } from '../club/presence/types';
import { brandHtml, emailPage, escapeHtml, footerText, type EmailLinks, type RenderedEmail } from './registration-template';

/** Parent e-mail on a recorded payment (spec 9): the E1 letter, no attachment. Pure. */
export const PAYMENT_HOLD_MS = 15_000;

const isMethod = (v: unknown): v is PaymentMethod => typeof v === 'string' && Object.keys(METHOD_WORDS).includes(v);

/** A payload the letter can be built from; never a broken sentence. */
export function isPaymentPayload(v: unknown): v is PaymentEmailPayload {
  return isRecord(v) && typeof v.athleteName === 'string' && typeof v.amount === 'number' && Number.isFinite(v.amount)
    && isMethod(v.method) && isIsoDate(v.paidOn) && typeof v.purposeText === 'string';
}

/** Paragraphs in order; the lines of one paragraph are joined by a line break. */
export function paymentParagraphs(p: PaymentEmailPayload): string[][] {
  return [
    [PAYMENT_EMAIL_COPY.greeting],
    [PAYMENT_EMAIL_COPY.recorded(p.amount, p.athleteName)],
    [PAYMENT_EMAIL_COPY.details(p.purposeText, METHOD_WORDS[p.method], longDate(p.paidOn))],
    [PAYMENT_EMAIL_COPY.notFiscal],
    [PAYMENT_EMAIL_COPY.signature],
  ];
}

const paragraphHtml = (lines: string[]): string => `<p style="margin:0 0 14px;">${lines.map(escapeHtml).join('<br>')}</p>`;

export function renderPaymentEmail(input: { payload: PaymentEmailPayload; links: EmailLinks }): RenderedEmail {
  const paragraphs = paymentParagraphs(input.payload);
  const body = `<div style="margin:0 0 28px;">${brandHtml(input.links.headerImage)}</div>${paragraphs.map(paragraphHtml).join('')}`;
  return {
    subject: PAYMENT_EMAIL_COPY.subject(input.payload.athleteName),
    html: emailPage(body, input.links),
    text: [...paragraphs.map((lines) => lines.join('\n')), ...footerText(input.links)].join('\n\n') + '\n',
  };
}

/** Held 15 s so the undo can cancel it (3.7); the address is trimmed and lower case. */
export function paymentEmailJob(i: { recipient: string; paymentId: string; payload: PaymentEmailPayload }, now: Date): PaymentEmailJob {
  return {
    recipient: i.recipient.trim().toLowerCase(),
    subject: PAYMENT_EMAIL_COPY.subject(i.payload.athleteName),
    paymentId: i.paymentId,
    notBefore: new Date(now.getTime() + PAYMENT_HOLD_MS).toISOString(),
    payload: i.payload,
  };
}
