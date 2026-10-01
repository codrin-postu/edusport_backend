import type { CalendarCategory } from '../../../../../admin/ui';

/**
 * Data model of the admin calendar (ProgramOverviewEditor): categories, the
 * event form, its validation, the request body and the local series
 * expansion. No React here.
 */

// Admin-authenticated CRUD (routes/02-admin.ts). The content-manager routes
// 403 on this hidden type, so the editor uses these dedicated admin endpoints.
export const CM_EVENT = '/api/calendar/events';

// Per-occurrence states for the Școala de patinaj recurring event.
// Colours are the shared calendar category tokens (--theme-cat-*), the same
// fills the website uses.
export const SCOALA_STATES = [
  { key: 'curs', label: 'Curs', cat: 'scoala' },
  { key: 'liber', label: 'Liber', cat: 'liber' },
  { key: 'anulat', label: 'Anulat', cat: 'anulat' },
] as const;
export const SCOALA_CAT: Record<string, CalendarCategory> = Object.fromEntries(SCOALA_STATES.map((s) => [s.key, s.cat]));
export const SCOALA_LABEL: Record<string, string> = Object.fromEntries(SCOALA_STATES.map((s) => [s.key, s.label]));
export const SCOALA_STATE_OPTIONS = SCOALA_STATES.map((s) => ({ value: s.key as string, label: s.label }));

export const CATEGORIES = [
  { key: 'curs', label: 'Antrenament', cat: 'antrenament' },
  { key: 'scoala', label: 'Școala de patinaj', cat: 'scoala' },
  { key: 'concurs', label: 'Competiție', cat: 'eveniment' },
  { key: 'cantonament', label: 'Cantonament', cat: 'eveniment' },
  { key: 'spectacol', label: 'Spectacol', cat: 'eveniment' },
  { key: 'eveniment', label: 'Eveniment', cat: 'eveniment' },
  { key: 'vacanta', label: 'Vacanță', cat: 'liber' },
  { key: 'sarbatoare', label: 'Sărbătoare', cat: 'liber' },
  { key: 'liber', label: 'Pauză / zi liberă', cat: 'liber' },
] as const;
export const CAT_OF: Record<string, CalendarCategory> = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.cat]));
export const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({ value: c.key, label: c.label }));

/**
 * The category filters above the calendar: one chip per colour. A chip hides
 * every event type of its colour.
 */
export const FILTER_GROUPS: ReadonlyArray<{ cat: CalendarCategory; label: string }> = [
  { cat: 'antrenament', label: 'Antrenament' },
  { cat: 'scoala', label: 'Școala de patinaj' },
  { cat: 'eveniment', label: 'Competiție, cantonament, spectacol, eveniment' },
  { cat: 'liber', label: 'Liber, vacanță, sărbătoare' },
];

/** CSS fill of a calendar category, from the theme tokens. */
export const catFill = (c: CalendarCategory) => `var(--theme-cat-${c})`;

export const FREQ_OPTIONS = [
  { value: 'weekly', label: 'Săptămânal' },
  { value: 'biweekly', label: 'La 2 săptămâni' },
  { value: 'monthly', label: 'Lunar' },
];
export const WEEK_OF_MONTH_OPTIONS = [
  { value: 'first', label: 'Prima' },
  { value: 'second', label: 'A doua' },
  { value: 'third', label: 'A treia' },
  { value: 'fourth', label: 'A patra' },
  { value: 'last', label: 'Ultima' },
];
// General recurring events, one date: no change, cancelled, or changed.
export const OCC_MODE_OPTIONS = [
  { value: 'keep', label: 'Neschimbat' },
  { value: 'cancel', label: 'Anulat' },
  { value: 'override', label: 'Modifică' },
];
export const EX_KIND_OPTIONS = [
  { value: 'cancel', label: 'Anulat' },
  { value: 'override', label: 'Mutat' },
];

export const RO_MONTHS = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];
export const RO_MON_SHORT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
/** Week columns, Monday first. */
export const RO_DOW = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'];
/** One letter per column, for the phone grid. */
export const RO_DOW_LETTER = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
// Indexed by JS getDay(): 0 = duminică.
export const RO_DOW_FULL = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];
export const WD: Array<[string, string]> = [['mon', 'L'], ['tue', 'M'], ['wed', 'Mi'], ['thu', 'J'], ['fri', 'V'], ['sat', 'S'], ['sun', 'D']];
// Form day keys mapped to JS getDay() numbers, for expanding a series locally.
const WD_JS: Array<[string, number]> = [['sun', 0], ['mon', 1], ['tue', 2], ['wed', 3], ['thu', 4], ['fri', 5], ['sat', 6]];

export interface Occurrence {
  eventId: number; documentId?: string; title: string; type: string; label: string | null;
  color: string | null; date: string; startTime: string | null; endTime: string | null;
  status: 'scheduled' | 'cancelled' | 'override'; cancelReason: 'exception' | 'blackout' | null;
  /** Școala only: curs | liber | anulat. */
  state?: string | null;
  /** Per-occurrence note (reason for Liber / Anulat). */
  note?: string | null;
}
export interface Exception { date: string; kind: 'cancel' | 'override' | 'liber' | 'anulat'; newStartTime?: string | null; newEndTime?: string | null; newTitle?: string | null; newDate?: string | null; }
export interface FormState {
  documentId: string | null;
  title: string; type: string; label: string;
  description: string; imageUrl: string; linkUrl: string; linkLabel: string;
  freq: string; days: Record<string, boolean>; weekOfMonth: string; allDay: boolean;
  startTime: string; endTime: string; endsNextDay: boolean; singleDate: string; endDate: string; seasonStart: string; seasonEnd: string;
  exceptions: Exception[];
  // Set when editing a single occurrence of a recurring event (per-date).
  scoalaDate: string | null;
  scoalaState: string;   // Școala: curs | liber | anulat
  scoalaNote: string;
  // General recurring events: what to do with this one date.
  occMode: string;       // keep | cancel | override
  occNewDate: string;
  occNewStart: string;
  occNewEnd: string;
  occNewTitle: string;
}

export const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : '');
const toTime = (v: string) => (v ? `${v}:00.000` : null);
export const parseYMD = (s: string): Date => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

// "2026-03-14" -> "14 mar"
export function fmtShort(d?: string): string {
  if (!d) return '';
  const p = d.split('-');
  if (p.length < 3) return '';
  return `${Number(p[2])} ${RO_MON_SHORT[Number(p[1]) - 1]}`;
}

// "2026-03-15" -> "15 martie 2026" (for the delete confirmation wording).
export const fmtRoDate = (iso: string): string => {
  const p = String(iso).slice(0, 10).split('-');
  if (p.length < 3) return String(iso);
  const m = RO_MONTHS[Number(p[1]) - 1];
  if (!m) return String(iso);
  return `${Number(p[2])} ${m.toLowerCase()} ${p[0]}`;
};

/** "2026-10-03" -> "sâmbătă, 3 octombrie" */
export const fmtRoLong = (iso: string): string => {
  const p = iso.split('-');
  if (p.length < 3) return iso;
  const d = parseYMD(iso);
  return `${RO_DOW_FULL[d.getDay()]}, ${Number(p[2])} ${RO_MONTHS[Number(p[1]) - 1].toLowerCase()}`;
};

/** "2026-10-03" -> "sâmbătă 3 oct" (drawer title of one date). */
export const fmtRoDay = (iso: string): string => {
  const d = parseYMD(iso);
  return `${RO_DOW_FULL[d.getDay()]} ${d.getDate()} ${RO_MON_SHORT[d.getMonth()]}`;
};

// --- series bounds rules (mirrored server-side in
// src/api/calendar-event/services/validate-recurrence.ts).
const MAX_SPAN_DAYS = 366;
const daysBetween = (a: string, b: string): number => {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
};
// "2026-03-14" -> "14.03"
const fmtDM = (d: string): string => {
  const p = String(d || '').slice(0, 10).split('-');
  return p.length < 3 ? '' : `${p[2]}.${p[1]}`;
};
const addDayYMD = (d: string): string => {
  const [y, m, dd] = d.split('-').map(Number);
  return ymd(new Date(y, m - 1, dd + 1));
};

// --- local series expansion, for the date list of a Școala series. Mirrors
// src/api/calendar-event/services/expand.ts (weekly / biweekly parity
// anchored on seasonStart, monthly nth-weekday). Kept client-side so the list
// reacts to unsaved changes of the recurrence fields; the server stays the
// authority on what actually shows in the calendar.
const startOfWeek = (x: Date): Date => new Date(x.getFullYear(), x.getMonth(), x.getDate() - ((x.getDay() + 6) % 7));
const weekIndex = (d: Date, anchor: Date): number =>
  Math.round((startOfWeek(d).getTime() - startOfWeek(anchor).getTime()) / (7 * 86_400_000));

function nthWeekdayOfMonth(year: number, month: number, weekday: number, which: string): Date | null {
  const first = new Date(year, month, 1);
  const firstMatch = 1 + ((7 + weekday - first.getDay()) % 7);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  if (which === 'last') {
    let day = firstMatch;
    while (day + 7 <= daysInMonth) day += 7;
    return new Date(year, month, day);
  }
  const nth = ({ first: 0, second: 1, third: 2, fourth: 3 } as Record<string, number>)[which] ?? 0;
  const day = firstMatch + nth * 7;
  return day > daysInMonth ? null : new Date(year, month, day);
}

/** Every date the series generates across its season, chronologically. */
export function seriesDates(f: FormState): string[] {
  if (f.freq === 'none' || !f.seasonStart || !f.seasonEnd) return [];
  const lo = parseYMD(f.seasonStart);
  const hi = parseYMD(f.seasonEnd);
  if (hi < lo) return [];
  if (daysBetween(f.seasonStart, f.seasonEnd) > MAX_SPAN_DAYS) return [];
  const wdays = WD_JS.filter(([k]) => f.days[k]).map(([, n]) => n);
  if (wdays.length === 0) return [];
  const out: string[] = [];
  if (f.freq === 'monthly') {
    let cursor = new Date(lo.getFullYear(), lo.getMonth(), 1);
    const last = new Date(hi.getFullYear(), hi.getMonth(), 1);
    while (cursor <= last) {
      for (const wd of wdays) {
        const d = nthWeekdayOfMonth(cursor.getFullYear(), cursor.getMonth(), wd, f.weekOfMonth);
        if (d && d >= lo && d <= hi) out.push(ymd(d));
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  } else {
    const step = f.freq === 'biweekly' ? 2 : 1;
    for (const d = new Date(lo); d <= hi; d.setDate(d.getDate() + 1)) {
      if (!wdays.includes(d.getDay())) continue;
      if (step === 2 && weekIndex(d, lo) % 2 !== 0) continue;
      out.push(ymd(d));
    }
  }
  out.sort();
  return out;
}

/**
 * Validate the whole series before saving. Returns a Romanian message, or null
 * when the form is fine. The server enforces the same rules; this only spares
 * the round trip and points at the field that is wrong.
 */
export function validateForm(f: FormState): string | null {
  if (!f.allDay && f.startTime && f.endTime && !f.endsNextDay && f.endTime <= f.startTime) {
    return 'Ora de sfârșit trebuie să fie după ora de început. Bifează „Se termină a doua zi" dacă evenimentul trece de miezul nopții.';
  }
  if (f.freq === 'none') return null;
  if (!f.seasonStart || !f.seasonEnd) {
    return 'Un eveniment care se repetă are nevoie de prima și ultima dată a seriei.';
  }
  const span = daysBetween(f.seasonStart, f.seasonEnd);
  if (span < 0) return 'Ultima dată a seriei nu poate fi înaintea primei date.';
  if (span > MAX_SPAN_DAYS) return 'O serie poate dura cel mult un an. Alege o ultimă dată mai apropiată.';
  return null;
}

/**
 * "22:00 (13.09) – 02:00 (14.09)": spells out which calendar day each end of
 * the span lands on, so an overnight event is unambiguous at a glance. The
 * reference day is the first date of the series (or the one-off's date).
 */
export function spanHint(f: FormState): string {
  const ref = (f.freq === 'none' ? f.singleDate : f.seasonStart) || ymd(new Date());
  // An all-day event saves null hours, so the summary must not quote times
  // that will never reach the database. It states the day instead.
  if (f.allDay) return `Toată ziua (${fmtDM(ref)})`;
  const endRef = f.endsNextDay ? addDayYMD(ref) : ref;
  return `${f.startTime} (${fmtDM(ref)}) – ${f.endTime} (${fmtDM(endRef)})`;
}

export function emptyForm(date?: string): FormState {
  return {
    documentId: null, title: '', type: 'curs', label: '',
    description: '', imageUrl: '', linkUrl: '', linkLabel: '',
    freq: 'weekly', days: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false },
    weekOfMonth: 'first', allDay: false, startTime: '', endTime: '', endsNextDay: false,
    // A click on a day in the grid seeds both the one-off date and the first
    // date of a series, so whichever frequency is picked starts from that day.
    singleDate: date ?? '', endDate: '', seasonStart: date ?? '', seasonEnd: '',
    exceptions: [],
    scoalaDate: null, scoalaState: 'curs', scoalaNote: '',
    occMode: 'keep', occNewDate: '', occNewStart: '', occNewEnd: '', occNewTitle: '',
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any -- the admin API returns the raw event record */
/** The form for a loaded event; `clickedDate` opens one occurrence of a series. */
export function formFromEvent(documentId: string, e: any, clickedDate?: string): FormState {
  const r = e.recurrence ?? {};
  const recurring = (r.freq ?? 'weekly') !== 'none';
  const occDate = recurring ? (clickedDate ?? null) : null;
  const exs: Exception[] = Array.isArray(e.exceptions)
    ? e.exceptions.map((x: any) => ({ date: x.date, kind: x.kind, newStartTime: hhmm(x.newStartTime), newEndTime: hhmm(x.newEndTime), newTitle: x.newTitle ?? '', newDate: x.newDate ?? '' }))
    : [];
  let scoalaState = 'curs';
  let scoalaNote = '';
  let occMode = 'keep', occNewDate = '', occNewStart = '', occNewEnd = '', occNewTitle = '';
  if (occDate) {
    const hit = exs.find((x) => x.date === occDate);
    if (e.type === 'scoala') {
      if (hit?.kind === 'anulat') scoalaState = 'anulat';
      else if (hit?.kind === 'liber') scoalaState = 'liber';
      if (hit) scoalaNote = hit.newTitle ?? '';
    } else if (hit?.kind === 'cancel') {
      occMode = 'cancel';
    } else if (hit?.kind === 'override') {
      occMode = 'override';
      occNewDate = hit.newDate ?? '';
      occNewStart = hhmm(hit.newStartTime) ?? '';
      occNewEnd = hhmm(hit.newEndTime) ?? '';
      occNewTitle = hit.newTitle ?? '';
    }
  }
  return {
    documentId,
    title: e.title ?? '', type: e.type ?? 'curs', label: e.label ?? '',
    description: e.description ?? '', imageUrl: e.imageUrl ?? '', linkUrl: e.linkUrl ?? '', linkLabel: e.linkLabel ?? '',
    freq: r.freq ?? 'weekly',
    days: { mon: !!r.mon, tue: !!r.tue, wed: !!r.wed, thu: !!r.thu, fri: !!r.fri, sat: !!r.sat, sun: !!r.sun },
    weekOfMonth: r.weekOfMonth ?? 'first', allDay: !r.startTime,
    startTime: hhmm(r.startTime), endTime: hhmm(r.endTime), endsNextDay: !!r.endsNextDay,
    singleDate: r.singleDate ?? '', endDate: r.endDate ?? '',
    seasonStart: r.seasonStart ?? '', seasonEnd: r.seasonEnd ?? '',
    exceptions: exs,
    scoalaDate: occDate,
    scoalaState,
    scoalaNote,
    occMode, occNewDate, occNewStart, occNewEnd, occNewTitle,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Editing one occurrence: fold its per-date fields into the exceptions list. */
export function withOccurrenceEdit(form: FormState): FormState {
  if (!form.scoalaDate) return form;
  const exs = form.exceptions.filter((x) => x.date !== form.scoalaDate);
  if (form.type === 'scoala') {
    if (form.scoalaState !== 'curs') exs.push({ date: form.scoalaDate, kind: form.scoalaState as Exception['kind'], newTitle: form.scoalaNote || null });
  } else if (form.occMode === 'cancel') {
    exs.push({ date: form.scoalaDate, kind: 'cancel' });
  } else if (form.occMode === 'override') {
    exs.push({ date: form.scoalaDate, kind: 'override', newDate: (form.occNewDate && form.occNewDate !== form.scoalaDate) ? form.occNewDate : null, newStartTime: form.occNewStart || null, newEndTime: form.occNewEnd || null, newTitle: form.occNewTitle || null });
  }
  return { ...form, exceptions: exs };
}

export const buildBody = (f: FormState) => ({
  // No `color` here: the admin has no input for it and the website ignores
  // it, so colour comes only from category / state. Omitting the key
  // leaves any existing stored value untouched on update.
  title: f.title, type: f.type, label: f.label || null,
  description: f.description || null, imageUrl: f.imageUrl || null, linkUrl: f.linkUrl || null, linkLabel: f.linkLabel || null,
  recurrence: {
    freq: f.freq, mon: f.days.mon, tue: f.days.tue, wed: f.days.wed, thu: f.days.thu, fri: f.days.fri, sat: f.days.sat, sun: f.days.sun,
    weekOfMonth: f.freq === 'monthly' ? f.weekOfMonth : null,
    startTime: f.allDay ? null : toTime(f.startTime), endTime: f.allDay ? null : toTime(f.endTime),
    endsNextDay: !f.allDay && !!f.endsNextDay,
    singleDate: f.freq === 'none' ? (f.singleDate || null) : null,
    endDate: f.freq === 'none' ? (f.endDate || null) : null,
    seasonStart: f.seasonStart || null, seasonEnd: f.seasonEnd || null,
  },
  exceptions: f.exceptions.map((x) => ({ date: x.date, kind: x.kind, newStartTime: toTime(x.newStartTime || ''), newEndTime: toTime(x.newEndTime || ''), newTitle: x.newTitle || null, newDate: x.newDate || null })),
});

/* ---- how an occurrence shows in the calendar --------------------------- */

export interface OccView {
  cat: CalendarCategory;
  /** Bold lead: the start time, or "" for all-day entries. */
  time: string;
  text: string;
  /** Struck through (a cancelled Școala date). */
  struck: boolean;
  /** Tooltip. */
  title: string;
}

/**
 * Colour comes only from category / state, never the per-event color field:
 * the website ignores it and the admin has no input for it.
 */
export function occView(o: Occurrence): OccView {
  const isScoala = o.type === 'scoala';
  const state = o.state ?? undefined;
  const cancelled = o.status === 'cancelled' || state === 'anulat' || state === 'liber';
  const cat: CalendarCategory = isScoala
    ? (SCOALA_CAT[state ?? ''] ?? SCOALA_CAT.curs)
    : cancelled
      ? 'anulat'
      : (CAT_OF[o.type] ?? 'scoala');
  const text = isScoala ? `Școala: ${SCOALA_LABEL[state ?? ''] ?? 'Curs'}` : o.label || o.title;
  const time = hhmm(o.startTime);
  const title = isScoala ? `${time ? `${time} ` : ''}${text}${o.note ? `, ${o.note}` : ''}` : o.title;
  return { cat, time, text, struck: state === 'anulat', title };
}

/** Filter colour of an occurrence's type; undefined (never hidden) for unknown types. */
export const filterCatOf = (o: Occurrence): CalendarCategory | undefined => CAT_OF[o.type];

/** The 6 x 7 days of the month grid, Monday first. */
export function monthWeeks(y: number, m: number): Date[][] {
  const first = new Date(y, m, 1);
  const startDow = (first.getDay() + 6) % 7;
  const cursor = new Date(y, m, 1 - startDow);
  const out: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: Date[] = [];
    for (let i = 0; i < 7; i++) {
      row.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    out.push(row);
  }
  return out;
}

/** "Săpt. 28 sep - 4 oct", or "Săpt. 5 - 11 oct" inside one month. */
export function weekLabel(monday: Date): string {
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const a = monday.getMonth() === sunday.getMonth() ? `${monday.getDate()}` : `${monday.getDate()} ${RO_MON_SHORT[monday.getMonth()]}`;
  return `Săpt. ${a} - ${sunday.getDate()} ${RO_MON_SHORT[sunday.getMonth()]}`;
}
