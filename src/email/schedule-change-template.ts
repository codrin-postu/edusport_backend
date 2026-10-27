import { EMAIL_COPY } from '../club/groups/copy/email';
import { dayMonth, weekdayName } from '../club/groups/dates';
import type { ScheduleChangePayload } from '../club/groups/types';
import { brandHtml, emailPage, escapeHtml, footerText, type EmailLinks, type RenderedEmail } from './registration-template';

/** Parent e-mail on a schedule change (spec 6.5): approved texts in the E1 letter (decided 2). Pure. */
export type ScheduleEmailInput = { payload: ScheduleChangePayload; links: EmailLinks };

const when = (date: string) => ({ day: weekdayName(date), date: dayMonth(date) });

export function scheduleSubject(p: ScheduleChangePayload): string {
  const w = when(p.date);
  return p.mode === 'move' ? EMAIL_COPY.subjectMove(p.groupName, w.day, w.date) : EMAIL_COPY.subjectCancel(p.groupName, w.day, w.date);
}

function changeLine(p: ScheduleChangePayload): string {
  const w = when(p.date);
  if (p.mode === 'cancel' || !p.newDate || !p.newStartTime) return EMAIL_COPY.cancelled(p.groupName, w.day, w.date, p.startTime);
  const n = when(p.newDate);
  return EMAIL_COPY.moved(p.groupName, w.day, w.date, p.startTime, n.day, n.date, p.newStartTime);
}

/** Paragraphs in order; the lines of one paragraph are joined by a line break. */
export function scheduleParagraphs(p: ScheduleChangePayload): string[][] {
  const change = p.reason ? [changeLine(p), EMAIL_COPY.reason(p.reason)] : [changeLine(p)];
  const next = p.mode === 'cancel' && p.nextDate && p.nextStartTime ? [[EMAIL_COPY.next(weekdayName(p.nextDate), dayMonth(p.nextDate), p.nextStartTime)]] : [];
  return [[EMAIL_COPY.greeting], change, ...next, [EMAIL_COPY.signature]];
}

const paragraphHtml = (lines: string[]): string => `<p style="margin:0 0 14px;">${lines.map(escapeHtml).join('<br>')}</p>`;

export function renderScheduleEmail(input: ScheduleEmailInput): RenderedEmail {
  const paragraphs = scheduleParagraphs(input.payload);
  const body = `<div style="margin:0 0 28px;">${brandHtml(input.links.headerImage)}</div>${paragraphs.map(paragraphHtml).join('')}`;
  return {
    subject: scheduleSubject(input.payload),
    html: emailPage(body, input.links),
    text: [...paragraphs.map((lines) => lines.join('\n')), ...footerText(input.links)].join('\n\n') + '\n',
  };
}
