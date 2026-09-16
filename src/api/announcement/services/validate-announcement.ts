/**
 * Server-side guard rails for scheduled announcements.
 *
 * The custom Anunțuri admin page checks the same rules in the browser, but that
 * is only a convenience — this module is the authority. It is wired in two
 * places, exactly like `validate-recurrence.ts` for calendar events:
 *
 *  1. a document-service middleware registered in `src/index.ts`, which covers
 *     EVERY write path that goes through `strapi.documents(...)` — the
 *     `/api/anunturi` admin routes, the content-manager and any seed script;
 *  2. directly in the admin controller, so the editor gets a clean 400 with the
 *     Romanian message on the exact route it posts to.
 *
 * Partial updates are tolerated: a PUT that only touches `priority` (the
 * reorder endpoint does exactly that) carries no dates, so the window check is
 * skipped rather than failing on absent fields. Only the fields present in the
 * write in progress are inspected, so legacy rows are never retro-validated.
 */
import { errors } from '@strapi/utils';

const { ValidationError } = errors;

/** Longest dismissal a visitor can be asked to remember, in days. */
const MAX_DISMISS_DAYS = 365;

export interface AnnouncementPayload {
  title?: unknown;
  message?: unknown;
  startAt?: unknown;
  endAt?: unknown;
  dismissDays?: unknown;
}

/** Strapi datetime values arrive as ISO strings (or Date objects from seeds). */
function toTime(v: unknown): number | null {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  if (typeof v !== 'string' || !v.trim()) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

function isBlank(v: unknown): boolean {
  return typeof v !== 'string' || v.trim() === '';
}

/**
 * Validates whatever announcement fields are present on `data`.
 *
 * `full` = true is used on create, where title / message must actually be
 * there; on update they are only checked when the caller sends them (sending
 * an empty title is still rejected).
 */
export function validateAnnouncement(data: unknown, full = false): void {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return;
  const d = data as AnnouncementPayload;

  if (full || 'title' in d) {
    if (isBlank(d.title)) {
      throw new ValidationError('Titlul anunțului este obligatoriu.');
    }
  }
  if (full || 'message' in d) {
    if (isBlank(d.message)) {
      throw new ValidationError('Mesajul anunțului este obligatoriu.');
    }
  }

  const start = toTime(d.startAt);
  const end = toTime(d.endAt);
  if (full && (start === null || end === null)) {
    throw new ValidationError('Un anunț are nevoie de o dată de început și una de final.');
  }
  if (start !== null && end !== null && end <= start) {
    throw new ValidationError('Data de final trebuie să fie după data de început.');
  }

  if (d.dismissDays !== undefined && d.dismissDays !== null) {
    const n = typeof d.dismissDays === 'number' ? d.dismissDays : Number(d.dismissDays);
    if (!Number.isInteger(n) || n < 0 || n > MAX_DISMISS_DAYS) {
      throw new ValidationError('Numărul de zile trebuie să fie între 0 și 365.');
    }
  }
}

/**
 * Document-service middleware: validates every create / update on
 * api::announcement.announcement, whichever route or script issued it.
 */
export function registerAnnouncementValidation(strapi: any): void {
  strapi.documents?.use?.(async (context: any, next: () => Promise<unknown>) => {
    if (
      context.uid === 'api::announcement.announcement' &&
      (context.action === 'create' || context.action === 'update')
    ) {
      validateAnnouncement(context.params?.data, context.action === 'create');
    }
    return next();
  });
}
