/**
 * Spreadsheet presentation: real date values, and the visual formatting of a tab.
 *
 * Two jobs, both driven entirely by the column TYPES that `matrix.ts` resolves,
 * so nothing here hardcodes a column index and a new custom question is styled
 * the moment it exists.
 *
 *
 * 1. DATES AS REAL DATES
 * ----------------------
 * A date written as text sorts alphabetically and cannot be filtered by range.
 * Two mechanisms could fix that:
 *
 *   a) `valueInputOption: 'USER_ENTERED'` and a locale-shaped string. Google
 *      then PARSES the string — and which of "03.04.2026" and "04.03.2026" it
 *      believes depends on the SPREADSHEET's locale, which the user can change
 *      from the Sheets UI at any time and which we never see. It would also
 *      start parsing every other cell: a phone number "0722123456" would become
 *      the number 722123456, and "1-2" would become a date.
 *
 *   b) Keep `valueInputOption: 'RAW'` — so every text cell stays exactly the
 *      text we sent — and write dates as Sheets SERIAL NUMBERS (days since
 *      1899-12-30), then attach an explicit `numberFormat` to the column.
 *
 * (b) is what this module does. A serial number has one meaning everywhere, the
 * pattern is ours rather than the locale's, and phone numbers, ids and leading
 * zeros survive untouched.
 *
 * The value model therefore has two shapes per cell, both produced here from
 * the same parse so they can never disagree:
 *   - the API value  (`cellApi`):  a number for a date, the string otherwise
 *   - the shown text (`cellText`): what a correctly formatted sheet DISPLAYS
 * The second is what `sync.ts` diffs against, because `values.get` returns
 * FORMATTED_VALUE — so a date cell reads back as "13.09.2026 15:30", never as
 * a serial, and the reconcile diff stays stable instead of rewriting forever.
 *
 * TIMEZONE. Submissions are stored as UTC instants; the admin shows them in
 * Europe/Bucharest (EET/EEST, +02:00 winter, +03:00 summer). A serial number
 * carries no zone, so the conversion must happen HERE: the instant is resolved
 * to its Bucharest wall clock via the ICU timezone database (`Intl`, so DST is
 * correct for every historic date) and that wall clock becomes the serial.
 * Date-ONLY values (`2015-04-12`, a birth date) are never zone-converted — they
 * are calendar dates, and shifting them by a few hours is exactly how a birth
 * date ends up one day early.
 *
 *
 * 2. TAB FORMATTING
 * -----------------
 * `formatRequests()` returns the `spreadsheets.batchUpdate` requests that make
 * a tab readable: a frozen, bold, navy header row; per-type column widths; the
 * date number formats from (1); and one conditional-format rule per status
 * value. Conditional rules rather than painted cells, so a row appended next
 * month is coloured with no extra API call.
 *
 * Every request is idempotent EXCEPT `addConditionalFormatRule`, which would
 * stack a duplicate on every run — so the caller passes the rules currently on
 * the sheet and this module emits the matching `deleteConditionalFormatRule`s
 * first. Re-running a sync therefore leaves the rule count unchanged.
 */
import type { Cell } from './client';
import type { ColumnType } from './matrix';
import type { FormKey } from './registry';

/* ------------------------------------------------------------------ colours */

interface Rgb {
  red: number;
  green: number;
  blue: number;
}

/** "#0e1a3c" -> the Sheets API's 0..1 float triple. */
function rgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return {
    red: parseInt(h.slice(0, 2), 16) / 255,
    green: parseInt(h.slice(2, 4), 16) / 255,
    blue: parseInt(h.slice(4, 6), 16) / 255,
  };
}

/** The project's brand navy, used for the header band. */
export const HEADER_BG = '#0e1a3c';
const HEADER_FG = '#ffffff';

/**
 * Status colours, copied from the admin's own status configs so a sheet and the
 * dashboard never disagree about what "Confirmat" looks like:
 *   Înscrieri -> src/admin/dashboard/InscrieriPage.tsx  (CFG.statuses)
 *   Voluntari -> src/admin/dashboard/VoluntariPage.tsx  (CFG.statuses)
 * Parteneri and Contact have no admin status config; their enum values
 * (partner-submission / contact-submission schema.json) are mapped onto the
 * same four-colour scale: new = blue, in progress = teal, settled = green,
 * rejected = red, archived = grey.
 */
interface StatusStyle {
  /** The exact cell text the rule matches. */
  value: string;
  /** Text colour. */
  color: string;
  /** Cell background. */
  soft: string;
}

const BLUE = { color: '#2138b8', soft: '#eef1fb' };
const TEAL = { color: '#00757f', soft: '#e2f4f5' };
const GREEN = { color: '#1f7a4d', soft: '#e5f3ec' };
const RED = { color: '#be3330', soft: '#fbeeed' };
const GREY = { color: '#6a6e7a', soft: '#eceef2' };

export const STATUS_STYLES: Record<FormKey, StatusStyle[]> = {
  // The admin also shows an "Arhivat" tag, but that comes from the separate
  // `archived` boolean — the exported `Stare` column only ever holds the four
  // enum values below, so a fifth rule would never fire.
  inscrieri: [
    { value: 'Nou', ...BLUE },
    { value: 'Contactat', ...TEAL },
    { value: 'Confirmat', ...GREEN },
    { value: 'Respins', ...RED },
  ],
  voluntari: [
    { value: 'Nou', ...BLUE },
    { value: 'Contactat', ...TEAL },
    { value: 'Acceptat', ...GREEN },
    { value: 'Respins', ...RED },
  ],
  parteneri: [
    { value: 'Nou', ...BLUE },
    { value: 'In discutii', ...TEAL },
    { value: 'Confirmat', ...GREEN },
    { value: 'Respins', ...RED },
  ],
  // Contact keeps its state in `triageStatus`, whose enum is English.
  contact: [
    { value: 'new', ...BLUE },
    { value: 'read', ...TEAL },
    { value: 'replied', ...GREEN },
    { value: 'archived', ...GREY },
  ],
};

/* ------------------------------------------------------------ date handling */

/** Every date is rendered in the club's own timezone, matching the admin. */
export const DISPLAY_TZ = 'Europe/Bucharest';

/** Google Sheets counts days from 1899-12-30; 1970-01-01 is serial 25569. */
const UNIX_EPOCH_SERIAL = 25569;
const MS_PER_DAY = 86_400_000;

/** The Sheets number-format patterns. `mm` is month after `dd`, minutes after `hh`. */
export const DATE_PATTERN = 'dd.mm.yyyy';
export const DATETIME_PATTERN = 'dd.mm.yyyy hh:mm';

/**
 * Wall-clock parts of an instant in Europe/Bucharest. `Intl` carries the full
 * IANA rules, so a submission from July is +03:00 and one from January +02:00
 * without a single hardcoded offset.
 */
const zoned = new Intl.DateTimeFormat('en-GB', {
  timeZone: DISPLAY_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

interface Wall {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
  s: number;
}

function wallClockIn(instant: Date): Wall {
  const parts = zoned.formatToParts(instant);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // Some ICU builds still emit hour 24 for midnight under h23.
  const h = get('hour') % 24;
  return { y: get('year'), mo: get('month'), d: get('day'), h, mi: get('minute'), s: get('second') };
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** A parsed date cell: the serial Sheets stores, and the text it then shows. */
interface ParsedDate {
  serial: number;
  text: string;
}

function serialOf(w: Wall): number {
  const days = Date.UTC(w.y, w.mo - 1, w.d) / MS_PER_DAY + UNIX_EPOCH_SERIAL;
  const frac = (w.h * 3600 + w.mi * 60 + w.s) / 86_400;
  // 8 decimals is ~1ms; it only keeps the stored double tidy.
  return Math.round((days + frac) * 1e8) / 1e8;
}

const showDate = (w: Wall) => `${pad(w.d)}.${pad(w.mo)}.${pad(w.y, 4)}`;
const showDateTime = (w: Wall) => `${showDate(w)} ${pad(w.h)}:${pad(w.mi)}`;

// "2026-09-13T12:30:00.000Z", "2026-09-13 12:30:00+03", "2026-09-13T12:30"
const ISO_DATETIME =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;
// "2015-04-12"
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
// "12.04.2015", "12/04/2015" — free-text birth dates typed by hand.
const DMY = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/;
// "1 ianuarie 2018" — the shape the public form's date picker actually submits
// into `childBirthDate`, which is a free STRING column, not a date one. Without
// this the real data would stay text and the column would sort alphabetically,
// which is precisely the bug the date typing exists to fix.
const RO_MONTHS = [
  'ianuarie',
  'februarie',
  'martie',
  'aprilie',
  'mai',
  'iunie',
  'iulie',
  'august',
  'septembrie',
  'octombrie',
  'noiembrie',
  'decembrie',
];
const RO_LONG = /^(\d{1,2})\s+([a-zăâîșşțţ]+)\s+(\d{4})$/i;

/** Strip Romanian diacritics so "decembrie"/"decembrie" both match. */
const deaccent = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ăâ]/g, 'a')
    .replace(/[șş]/g, 's')
    .replace(/[țţ]/g, 't')
    .replace(/î/g, 'i');

/** 1-based month number for a Romanian month name, or 0. */
function roMonth(name: string): number {
  const want = deaccent(name);
  return RO_MONTHS.findIndex((m) => deaccent(m) === want) + 1;
}

/**
 * Turn one raw cell into a date, or null when it is not one (empty, free text,
 * "nu stiu"). `kind` decides whether the result keeps a time of day.
 *
 * A value carrying an explicit zone (or a bare ISO datetime, which Strapi
 * stores as UTC) is an INSTANT and gets converted to Bucharest. A calendar date
 * is taken literally: no conversion, so it can never slide to the previous day.
 */
export function parseDateCell(raw: string, kind: 'date' | 'datetime'): ParsedDate | null {
  const v = String(raw ?? '').trim();
  if (!v) return null;

  const dt = ISO_DATETIME.exec(v);
  if (dt) {
    // No zone suffix: the column is a UTC timestamp, so read it as UTC.
    const instant = new Date(dt[7] ? v.replace(' ', 'T') : `${v.replace(' ', 'T')}Z`);
    if (Number.isNaN(instant.getTime())) return null;
    const w = wallClockIn(instant);
    if (kind === 'date') {
      const day: Wall = { ...w, h: 0, mi: 0, s: 0 };
      return { serial: serialOf(day), text: showDate(day) };
    }
    return { serial: serialOf(w), text: showDateTime(w) };
  }

  const cal = ISO_DATE.exec(v);
  const dmy = cal ? null : DMY.exec(v);
  const long = cal || dmy ? null : RO_LONG.exec(v);
  if (!cal && !dmy && !long) return null;

  let w: Wall;
  if (cal) w = { y: +cal[1], mo: +cal[2], d: +cal[3], h: 0, mi: 0, s: 0 };
  else if (dmy) w = { y: +dmy[3], mo: +dmy[2], d: +dmy[1], h: 0, mi: 0, s: 0 };
  else w = { y: +long![3], mo: roMonth(long![2]), d: +long![1], h: 0, mi: 0, s: 0 };

  if (w.mo < 1 || w.mo > 12 || w.d < 1 || w.d > 31) return null;

  return kind === 'date'
    ? { serial: serialOf(w), text: showDate(w) }
    : { serial: serialOf(w), text: showDateTime(w) };
}

const dateKind = (t: ColumnType): 'date' | 'datetime' | null =>
  t === 'date' ? 'date' : t === 'datetime' ? 'datetime' : null;

/**
 * A rendered row -> the cells the API is given. Date columns become tagged
 * date cells (serial + the text they will display); everything else stays the
 * exact string `matrix.ts` produced, because the write is still RAW.
 */
export function toCells(types: ColumnType[], row: string[]): Cell[] {
  return row.map((value, i) => {
    const kind = dateKind(types[i]);
    if (!kind) return value;
    const parsed = parseDateCell(value, kind);
    return parsed ? { kind: 'date' as const, serial: parsed.serial, text: parsed.text } : value;
  });
}

/**
 * The same row as the SHEET WILL SHOW IT. `values.get` returns formatted
 * values, so this is what a reconcile compares against — not the raw ISO
 * string, which the sheet no longer contains.
 */
export function toDisplay(types: ColumnType[], row: string[]): string[] {
  return row.map((value, i) => {
    const kind = dateKind(types[i]);
    if (!kind) return value;
    const parsed = parseDateCell(value, kind);
    return parsed ? parsed.text : value;
  });
}

/* ------------------------------------------------------------ column widths */

/**
 * Pixel widths per column TYPE. Derived from the resolved plan, never from a
 * hand-kept list of column names — a custom question added tomorrow gets the
 * width of its own type with no code change.
 */
const WIDTH: Record<ColumnType, number> = {
  datetime: 130,
  date: 120,
  status: 130,
  email: 220,
  tel: 140,
  text: 150,
  longtext: 260,
  bool: 110,
  list: 200,
  id: 190,
};

export const widthFor = (t: ColumnType): number => WIDTH[t] ?? WIDTH.text;

/* -------------------------------------------------- conditional format rules */

/** One tab's formatting-relevant state, as read back from `spreadsheets.get`. */
export interface TabState {
  sheetId: number;
  frozenRowCount: number;
  /** `sheets.conditionalFormats`, in rule-index order. */
  conditionalFormats: any[];
}

const ruleColumn = (rule: any): number | null => {
  const range = rule?.ranges?.[0];
  return typeof range?.startColumnIndex === 'number' ? range.startColumnIndex : null;
};

const ruleValue = (rule: any): string =>
  String(rule?.booleanRule?.condition?.values?.[0]?.userEnteredValue ?? '');

/** Indices (ascending) of the rules currently sitting on the status column. */
function statusRuleIndices(state: TabState | undefined, statusIndex: number): number[] {
  if (!state || statusIndex < 0) return [];
  const out: number[] = [];
  state.conditionalFormats.forEach((rule, i) => {
    if (ruleColumn(rule) === statusIndex) out.push(i);
  });
  return out;
}

/**
 * Is this tab already formatted the way we want? Used by the cheap paths
 * (reconcile) to skip a batchUpdate entirely in the steady state. The probe is
 * the frozen header plus the exact status rule set, both of which come from the
 * `spreadsheets.get` the operation already made — so checking costs nothing.
 */
export function formatIsCurrent(
  state: TabState | undefined,
  form: FormKey,
  statusIndex: number,
): boolean {
  if (!state) return false;
  if (state.frozenRowCount !== 1) return false;
  const want = statusIndex < 0 ? [] : STATUS_STYLES[form].map((s) => s.value);
  const have = statusRuleIndices(state, statusIndex).map((i) => ruleValue(state.conditionalFormats[i]));
  return have.length === want.length && want.every((v, i) => have[i] === v);
}

/* ------------------------------------------------------------- the requests */

export interface FormatSpec {
  form: FormKey;
  sheetId: number;
  /** Column types of the CURRENT plan, in order. */
  types: ColumnType[];
  /** The tab's state before this batch, or undefined for a tab just created. */
  state?: TabState;
}

/**
 * Every `spreadsheets.batchUpdate` request needed to bring one tab up to date.
 * Safe to send repeatedly: the existing status rules are deleted in the same
 * batch that re-adds them, so the rule count is stable across runs.
 */
export function formatRequests(spec: FormatSpec): any[] {
  const { form, sheetId, types, state } = spec;
  const columns = types.length;
  if (columns === 0) return [];

  const statusIndex = types.indexOf('status');
  const requests: any[] = [];

  // --- frozen header row
  requests.push({
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
      fields: 'gridProperties.frozenRowCount',
    },
  });

  // --- header band: bold white on brand navy, a little taller than a data row
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: columns },
      cell: {
        userEnteredFormat: {
          backgroundColor: rgb(HEADER_BG),
          horizontalAlignment: 'LEFT',
          verticalAlignment: 'MIDDLE',
          wrapStrategy: 'CLIP',
          textFormat: { foregroundColor: rgb(HEADER_FG), bold: true, fontSize: 10 },
        },
      },
      fields:
        'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)',
    },
  });
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 32 },
      fields: 'pixelSize',
    },
  });

  // --- data rows: one line each, left aligned, so a long "Motivatie" cannot
  //     stretch a row to half the screen. Deliberately does NOT touch
  //     numberFormat (different field mask), so the date formats below stand.
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: columns },
      cell: {
        userEnteredFormat: {
          horizontalAlignment: 'LEFT',
          verticalAlignment: 'TOP',
          wrapStrategy: 'CLIP',
        },
      },
      fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment,wrapStrategy)',
    },
  });

  // --- column widths, straight off the column types
  types.forEach((type, i) => {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: widthFor(type) },
        fields: 'pixelSize',
      },
    });
  });

  // --- real date columns: DATE / DATE_TIME with an explicit pattern, so the
  //     serial numbers we write render the same in every spreadsheet locale.
  types.forEach((type, i) => {
    const kind = dateKind(type);
    if (!kind) return;
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: i, endColumnIndex: i + 1 },
        cell: {
          userEnteredFormat: {
            numberFormat: {
              type: kind === 'date' ? 'DATE' : 'DATE_TIME',
              pattern: kind === 'date' ? DATE_PATTERN : DATETIME_PATTERN,
            },
          },
        },
        fields: 'userEnteredFormat.numberFormat',
      },
    });
  });

  // --- status colours. A form with no status column (none today, but a future
  //     one is cheap to allow) simply gets no rules.
  if (statusIndex >= 0) {
    // Drop what is already there FIRST, descending so earlier deletes cannot
    // shift the index of a later one. This is the whole idempotency story:
    // without it every sync would stack another copy of all four rules.
    const existing = statusRuleIndices(state, statusIndex);
    for (const index of [...existing].sort((a, b) => b - a)) {
      requests.push({ deleteConditionalFormatRule: { sheetId, index } });
    }

    // How many unrelated rules survive on this sheet decides where ours land.
    const kept = (state?.conditionalFormats.length ?? 0) - existing.length;
    STATUS_STYLES[form].forEach((style, i) => {
      requests.push({
        addConditionalFormatRule: {
          index: kept + i,
          rule: {
            ranges: [
              // No endRowIndex: the rule covers every row added later too, so a
              // submission arriving next month is coloured with no API call.
              { sheetId, startRowIndex: 1, startColumnIndex: statusIndex, endColumnIndex: statusIndex + 1 },
            ],
            booleanRule: {
              condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: style.value }] },
              format: {
                backgroundColor: rgb(style.soft),
                textFormat: { foregroundColor: rgb(style.color), bold: true },
              },
            },
          },
        },
      });
    });
  }

  return requests;
}
