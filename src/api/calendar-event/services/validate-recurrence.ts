/**
 * Server-side guard rails for calendar-event recurrence rules.
 *
 * The custom Program editor checks the same rules in the browser, but that is
 * only a convenience — this module is the authority. It is wired in two places:
 *
 *  1. a document-service middleware registered in `src/index.ts`, which covers
 *     EVERY write path that goes through `strapi.documents(...)` — the
 *     `/api/calendar/events` admin routes, the core content-api router, the
 *     content-manager and any seed script;
 *  2. directly in the admin controller, so the editor gets a clean 400 with the
 *     Romanian message on the exact route it posts to.
 *
 * It is deliberately NOT a db lifecycle: by the time `beforeCreate` fires on
 * `api::calendar-event.calendar-event`, Strapi v5 has already written the
 * component row and `data.recurrence` is only `{ id, __pivot }` — the rule
 * fields are gone.
 *
 * Legacy rows are untouched: only the recurrence of the write in progress is
 * inspected, so existing events with null seasonStart / seasonEnd keep
 * expanding exactly as before until someone edits and saves them.
 */
import { errors } from '@strapi/utils';

const { ValidationError } = errors;

/** Longest allowed series window, in days (one year, leap year included). */
const MAX_SPAN_DAYS = 366;
const MS_DAY = 86_400_000;

interface RecurrencePayload {
  freq?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  endsNextDay?: boolean | null;
  seasonStart?: string | null;
  seasonEnd?: string | null;
}

/** Accepts "YYYY-MM-DD" (Strapi dates may arrive with a time part attached). */
function toYMD(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Strapi time values arrive as "HH:mm", "HH:mm:ss" or "HH:mm:ss.SSS". */
function toHHMM(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.slice(0, 5);
  return /^\d{2}:\d{2}$/.test(s) ? s : null;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / MS_DAY);
}

export function validateRecurrence(recurrence: unknown): void {
  if (!recurrence || typeof recurrence !== 'object' || Array.isArray(recurrence)) return;
  const r = recurrence as RecurrencePayload;

  // Times apply to every frequency, including one-off events.
  const start = toHHMM(r.startTime);
  const end = toHHMM(r.endTime);
  if (start && end && !r.endsNextDay && end <= start) {
    throw new ValidationError(
      'Ora de sfârșit trebuie să fie după ora de început. Bifează „Se termină a doua zi" dacă evenimentul trece de miezul nopții.',
    );
  }

  // Series bounds are required for recurring events only. A one-off carries its
  // own singleDate / endDate instead.
  const freq = r.freq ?? 'weekly';
  if (freq === 'none') return;

  const from = toYMD(r.seasonStart);
  const to = toYMD(r.seasonEnd);
  if (!from || !to) {
    throw new ValidationError(
      'Un eveniment care se repetă are nevoie de prima și ultima dată a seriei.',
    );
  }

  const span = daysBetween(from, to);
  if (span < 0) {
    throw new ValidationError('Ultima dată a seriei nu poate fi înaintea primei date.');
  }
  if (span > MAX_SPAN_DAYS) {
    throw new ValidationError(
      'O serie poate dura cel mult un an. Alege o ultimă dată mai apropiată.',
    );
  }
}

/**
 * Document-service middleware: validates the recurrence payload of every
 * create / update on api::calendar-event.calendar-event, before Strapi splits
 * the component out of `data`.
 */
export function registerRecurrenceValidation(strapi: any): void {
  strapi.documents?.use?.(async (context: any, next: () => Promise<unknown>) => {
    if (
      context.uid === 'api::calendar-event.calendar-event' &&
      (context.action === 'create' || context.action === 'update')
    ) {
      const data = context.params?.data;
      // A partial update that does not touch the recurrence leaves it alone.
      if (data && 'recurrence' in data) validateRecurrence(data.recurrence);
    }
    return next();
  });
}
