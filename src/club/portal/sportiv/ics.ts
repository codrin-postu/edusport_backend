import type { CalendarItem } from './api-types';

const MAX_EVENTS = 300;
const TZID = 'Europe/Bucharest';
const FOLD_OCTETS = 75;

/** Europe/Bucharest: EET, summer time from the last Sunday of March to the last Sunday of October (EU rule). */
const VTIMEZONE = [
  'BEGIN:VTIMEZONE', `TZID:${TZID}`,
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0300', 'TZNAME:EEST', 'DTSTART:19700329T030000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0300', 'TZOFFSETTO:+0200', 'TZNAME:EET', 'DTSTART:19701025T040000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'END:VTIMEZONE',
];

const escapeText = (s: string): string => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** A content line cut into lines of at most 75 octets, each continuation starting with one space; never inside a character. */
function fold(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let octets = 0;
  for (const ch of line) {
    const size = Buffer.byteLength(ch, 'utf8');
    const limit = out.length === 0 ? FOLD_OCTETS : FOLD_OCTETS - 1;
    if (octets + size > limit) {
      out.push(current);
      current = '';
      octets = 0;
    }
    current += ch;
    octets += size;
  }
  out.push(current);
  return out.map((l, i) => (i === 0 ? l : ` ${l}`));
}

const compactDate = (iso: string): string => iso.replace(/-/g, '');
const compactTime = (hhmm: string): string => `${hhmm.slice(0, 2)}${hhmm.slice(3, 5)}00`;
const stamp = (d: Date): string => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const slug = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The calendar day in Bucharest, `YYYY-MM-DD`. */
const dayInBucharest = (d: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: TZID, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

/** Stable across downloads: `<kind>-<id>-<date>@edusport`, the id being the title and the start time (an item has no other identity). */
const uidOf = (i: CalendarItem): string => `${i.kind}-${slug(i.title)}${i.startTime ? `-${i.startTime.replace(':', '')}` : ''}-${i.date}@edusport`;

function eventLines(i: CalendarItem, now: Date): string[] {
  const lines = ['BEGIN:VEVENT', `UID:${uidOf(i)}`, `DTSTAMP:${stamp(now)}`];
  if (i.startTime) {
    lines.push(`DTSTART;TZID=${TZID}:${compactDate(i.date)}T${compactTime(i.startTime)}`);
    if (i.endTime) lines.push(`DTEND;TZID=${TZID}:${compactDate(i.date)}T${compactTime(i.endTime)}`);
  } else lines.push(`DTSTART;VALUE=DATE:${compactDate(i.date)}`);
  lines.push(`SUMMARY:${escapeText(i.title)}`);
  if (i.location) lines.push(`LOCATION:${escapeText(i.location)}`);
  if (i.coaches.length > 0) lines.push(`DESCRIPTION:${escapeText(`cu ${i.coaches.join(', ')}`)}`);
  lines.push('END:VEVENT');
  return lines;
}

/**
 * The phone calendar file (spec 6.5): one event per own item that is not cancelled, from today (Bucharest) on, at most 300; the caller passes the items up to the season end.
 * Times are local with `TZID`; lines end CRLF and are folded at 75 octets.
 */
export function toIcs(items: CalendarItem[], now: Date, athleteFirstName: string): string {
  const today = dayInBucharest(now);
  const own = items.filter((i) => !i.cancelled && i.date >= today).slice(0, MAX_EVENTS);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EduSport//Sportiv//RO', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${escapeText(`EduSport ${athleteFirstName}`)}`, `X-WR-TIMEZONE:${TZID}`,
    ...VTIMEZONE, ...own.flatMap((i) => eventLines(i, now)), 'END:VCALENDAR',
  ];
  return `${lines.flatMap(fold).join('\r\n')}\r\n`;
}
