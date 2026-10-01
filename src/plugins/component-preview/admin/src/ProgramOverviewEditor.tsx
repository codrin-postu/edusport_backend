import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
// Shared admin UI (src/admin/ui) on the --theme-* tokens; same bundle as the
// admin panel, like the ConfirmDialog import below.
import {
  AddButton,
  Button,
  DateInput,
  Field,
  FieldRow,
  ImagePicker,
  Input,
  Notice,
  RepeatableList,
  SegmentedControl,
  Select,
  StatusBadge,
  Switch,
  Tabs,
  Textarea,
  TimeInput,
  Checkbox,
  ensureAdminUi,
  toastAutosaved,
  type CalendarCategory,
} from '../../../../admin/ui';
import { IconClose, IconPlus } from '../../../../admin/ui/icons';
// Canonical shared confirm dialog: src/admin/ConfirmDialog.tsx. The admin panel
// and this local plugin compile into the same vite bundle (src/admin/app.tsx
// imports this plugin by relative path), so importing across the boundary is
// safe. Edit the canonical file, not a copy.
import { ConfirmDialog } from '../../../../admin/ConfirmDialog';

// Per-occurrence states for the Școala de patinaj recurring event.
// Colours are the shared calendar category tokens (--theme-cat-*), the same
// fills the website uses.
const SCOALA_STATES = [
  { key: 'curs', label: 'Curs', cat: 'scoala' },
  { key: 'liber', label: 'Liber', cat: 'liber' },
  { key: 'anulat', label: 'Anulat', cat: 'anulat' },
] as const;
const SCOALA_CAT: Record<string, CalendarCategory> = Object.fromEntries(SCOALA_STATES.map((s) => [s.key, s.cat]));
const SCOALA_LABEL: Record<string, string> = Object.fromEntries(SCOALA_STATES.map((s) => [s.key, s.label]));

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

// Admin-authenticated CRUD (routes/02-admin.ts). The content-manager routes
// 403 on this hidden type, so the editor uses these dedicated admin endpoints.
const CM_EVENT = '/api/calendar/events';

const RO_MON_SHORT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
// "2026-03-14" -> "14 mar"
function fmtShort(d?: string): string {
  if (!d) return '';
  const p = d.split('-');
  if (p.length < 3) return '';
  return `${Number(p[2])} ${RO_MON_SHORT[Number(p[1]) - 1]}`;
}

const CATEGORIES = [
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
const CAT_OF: Record<string, CalendarCategory> = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.cat]));
/** CSS fill of a calendar category, from the theme tokens. */
const catFill = (c: CalendarCategory) => `var(--theme-cat-${c})`;
const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({ value: c.key, label: c.label }));
const FREQ_OPTIONS = [
  { value: 'weekly', label: 'Săptămânal' },
  { value: 'biweekly', label: 'La 2 săptămâni' },
  { value: 'monthly', label: 'Lunar' },
  { value: 'none', label: 'Nu se repetă (o dată)' },
];
const WEEK_OF_MONTH_OPTIONS = [
  { value: 'first', label: 'Prima' },
  { value: 'second', label: 'A doua' },
  { value: 'third', label: 'A treia' },
  { value: 'fourth', label: 'A patra' },
  { value: 'last', label: 'Ultima' },
];
const SCOALA_STATE_OPTIONS = SCOALA_STATES.map((s) => ({ value: s.key as string, label: s.label }));
// General recurring events, one date: no change, cancelled, or changed.
const OCC_MODE_OPTIONS = [
  { value: 'keep', label: 'Neschimbat' },
  { value: 'cancel', label: 'Anulat' },
  { value: 'override', label: 'Modifică' },
];
const EX_KIND_OPTIONS = [
  { value: 'cancel', label: 'Anulat' },
  { value: 'override', label: 'Mutat' },
];
const RO_MONTHS = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];
const RO_DOW = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'];
// Indexed by JS getDay(): 0 = duminică.
const RO_DOW_FULL = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];
const WD: Array<[string, string]> = [['mon', 'L'], ['tue', 'M'], ['wed', 'Mi'], ['thu', 'J'], ['fri', 'V'], ['sat', 'S'], ['sun', 'D']];
// Form day keys mapped to JS getDay() numbers, for expanding a series locally.
const WD_JS: Array<[string, number]> = [['sun', 0], ['mon', 1], ['tue', 2], ['wed', 3], ['thu', 4], ['fri', 5], ['sat', 6]];

interface Occurrence {
  eventId: number; documentId?: string; title: string; type: string; label: string | null;
  color: string | null; date: string; startTime: string | null; endTime: string | null;
  status: 'scheduled' | 'cancelled' | 'override'; cancelReason: 'exception' | 'blackout' | null;
}
interface Exception { date: string; kind: 'cancel' | 'override' | 'liber' | 'anulat'; newStartTime?: string | null; newEndTime?: string | null; newTitle?: string | null; newDate?: string | null; }
interface FormState {
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

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : '');

// "2026-03-15" -> "15 martie 2026" (for the delete confirmation wording).
const fmtRoDate = (iso: string): string => {
  const p = String(iso).slice(0, 10).split('-');
  if (p.length < 3) return String(iso);
  const m = RO_MONTHS[Number(p[1]) - 1];
  if (!m) return String(iso);
  return `${Number(p[2])} ${m.toLowerCase()} ${p[0]}`;
};
const toTime = (v: string) => (v ? `${v}:00.000` : null);

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

// --- local series expansion, for the date table in the "Toată seria" tab.
// Mirrors src/api/calendar-event/services/expand.ts (weekly / biweekly parity
// anchored on seasonStart, monthly nth-weekday). Kept client-side so the table
// reacts to unsaved changes of the recurrence fields; the server stays the
// authority on what actually shows in the calendar.
const parseYMD = (s: string): Date => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
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
function seriesDates(f: FormState): string[] {
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

/** "2026-10-03" -> "sâmbătă, 3 octombrie" */
const fmtRoLong = (iso: string): string => {
  const p = iso.split('-');
  if (p.length < 3) return iso;
  const d = parseYMD(iso);
  return `${RO_DOW_FULL[d.getDay()]}, ${Number(p[2])} ${RO_MONTHS[Number(p[1]) - 1].toLowerCase()}`;
};

/**
 * Validate the whole series before saving. Returns a Romanian message, or null
 * when the form is fine. The server enforces the same rules — this only spares
 * the round trip and points at the field that is wrong.
 */
function validateForm(f: FormState): string | null {
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
 * "22:00 (13.09) – 02:00 (14.09)" — spells out which calendar day each end of
 * the span lands on, so an overnight event is unambiguous at a glance. The
 * reference day is the first date of the series (or the one-off's date).
 */
function spanHint(f: FormState): string {
  const ref = (f.freq === 'none' ? f.singleDate : f.seasonStart) || ymd(new Date());
  // An all-day event saves null hours, so the summary must not quote times
  // that will never reach the database. It states the day instead.
  if (f.allDay) return `Toată ziua (${fmtDM(ref)})`;
  const endRef = f.endsNextDay ? addDayYMD(ref) : ref;
  return `${f.startTime} (${fmtDM(ref)}) – ${f.endTime} (${fmtDM(endRef)})`;
}

function emptyForm(date?: string): FormState {
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

export default function ProgramOverviewEditor(_props: Props) {
  const { get, post, put, del } = useFetchClient();
  const today = new Date();
  const [ym, setYm] = React.useState({ y: today.getFullYear(), m: today.getMonth() });
  const [occurrences, setOccurrences] = React.useState<Occurrence[]>([]);
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(false);
  const [form, setForm] = React.useState<FormState | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [mediaOpen, setMediaOpen] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);
  // For a Școala occurrence: edit just this date's state, or the whole series.
  const [scoalaView, setScoalaView] = React.useState<'date' | 'series'>('date');
  const dtScroll = React.useRef<HTMLDivElement>(null);
  const dtAnchors = React.useRef<Record<string, HTMLTableRowElement | null>>({});
  // The edit panel sits below the calendar, so opening it can happen entirely
  // off screen. Scroll to it, but only when it opens from closed: swapping
  // between events with the panel already open should not yank the page.
  const panelRef = React.useRef<HTMLDivElement>(null);
  const scrollOnOpen = React.useRef(false);

  React.useEffect(() => {
    const first = new Date(ym.y, ym.m, 1);
    const last = new Date(ym.y, ym.m + 1, 0);
    let cancelled = false;
    setLoading(true);
    fetch(`/api/calendar/occurrences?from=${ymd(first)}&to=${ymd(last)}`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => { if (!cancelled) setOccurrences(Array.isArray(j?.data) ? j.data : []); })
      .catch(() => { if (!cancelled) setOccurrences([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ym, reloadKey]);

  const byDate = React.useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    for (const o of occurrences) {
      if (hidden.has(o.type)) continue;
      const arr = map.get(o.date) ?? [];
      arr.push(o);
      map.set(o.date, arr);
    }
    return map;
  }, [occurrences, hidden]);

  const weeks = React.useMemo(() => {
    const first = new Date(ym.y, ym.m, 1);
    const startDow = (first.getDay() + 6) % 7;
    const cursor = new Date(ym.y, ym.m, 1 - startDow);
    const out: Date[][] = [];
    for (let w = 0; w < 6; w++) {
      const row: Date[] = [];
      for (let i = 0; i < 7; i++) { row.push(new Date(cursor)); cursor.setDate(cursor.getDate() + 1); }
      out.push(row);
    }
    return out;
  }, [ym]);

  const prevMonth = () => setYm(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }));
  const nextMonth = () => setYm(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }));
  const toggleCat = (k: string) => setHidden((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const openCreate = (date?: string) => {
    scrollOnOpen.current = true;
    setDirty(true);
    setSaveError(null);
    setScoalaView('date');
    setForm(emptyForm(date));
  };

  const openEdit = async (documentId?: string, clickedDate?: string) => {
    if (!documentId) return;
    // Always scroll the panel into view: it sits below the month grid, so
    // switching between events without it looks like nothing happened.
    scrollOnOpen.current = true;
    setDirty(false);
    setSaveError(null);
    setScoalaView('date');
    try {
      const res: any = await get(`${CM_EVENT}/${documentId}`);
      const e = (res?.data?.data ?? res?.data) as any;
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
      setForm({
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
      });
    } catch (err) { /* ignore */ }
  };

  const buildBody = (f: FormState) => ({
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

  const save = async () => {
    if (!form) return;
    let f = form;
    if (form.scoalaDate) {
      // Editing one Școala occurrence: write its state as an exception.
      const exs = form.exceptions.filter((x) => x.date !== form.scoalaDate);
      if (form.type === 'scoala') {
        if (form.scoalaState !== 'curs') exs.push({ date: form.scoalaDate, kind: form.scoalaState as any, newTitle: form.scoalaNote || null });
      } else if (form.occMode === 'cancel') {
        exs.push({ date: form.scoalaDate, kind: 'cancel' });
      } else if (form.occMode === 'override') {
        exs.push({ date: form.scoalaDate, kind: 'override', newDate: (form.occNewDate && form.occNewDate !== form.scoalaDate) ? form.occNewDate : null, newStartTime: form.occNewStart || null, newEndTime: form.occNewEnd || null, newTitle: form.occNewTitle || null });
      }
      f = { ...form, exceptions: exs };
    } else if (!form.title.trim()) {
      setSaveError('Titlul este obligatoriu.');
      return;
    }
    // Series bounds / time order. Blocks the save; the server rejects the same
    // payload anyway, so failing here just keeps the form usable.
    const invalid = validateForm(f);
    if (invalid) {
      setSaveError(invalid);
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const body = buildBody(f);
      if (f.documentId) await put(`${CM_EVENT}/${f.documentId}`, body);
      else await post(CM_EVENT, body);
      setForm(null);
      setDirty(false);
      setReloadKey((k) => k + 1);
      toastAutosaved();
    } catch (err: any) {
      // Surface the server's Romanian validation message instead of silently
      // leaving the panel open with no explanation.
      const msg = err?.response?.data?.error?.message ?? err?.message;
      setSaveError(msg || 'Salvarea a eșuat.');
    }
    finally { setSaving(false); }
  };

  // Delete confirmation (shared ConfirmDialog). `remove` opens it; `doRemove`
  // performs the unchanged delete once confirmed.
  const [confirmDel, setConfirmDel] = React.useState(false);
  const [delError, setDelError] = React.useState<string | null>(null);

  const remove = () => {
    if (!form?.documentId) { setForm(null); return; }
    setDelError(null);
    setConfirmDel(true);
  };

  const doRemove = async () => {
    if (!form?.documentId) { setConfirmDel(false); setForm(null); return; }
    setSaving(true);
    setDelError(null);
    try {
      await del(`${CM_EVENT}/${form.documentId}`);
      setConfirmDel(false);
      setForm(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      // Keep the dialog open and say so, instead of silently doing nothing.
      setDelError('Ștergerea a eșuat.');
    } finally {
      setSaving(false);
    }
  };

  React.useEffect(() => {
    if (!form || !scrollOnOpen.current) return;
    scrollOnOpen.current = false;
    // `start` puts the panel header at the top of the viewport: the form is
    // tall, so centring it would push its first fields off-screen.
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    panelRef.current?.scrollIntoView({
      behavior: reduced ? 'auto' : 'smooth',
      block: 'start',
    });
  }, [form]);

  const upd = (patch: Partial<FormState>) => { setDirty(true); setSaveError(null); setForm((f) => (f ? { ...f, ...patch } : f)); };

  // --- series date table (Școala, "Toată seria" tab) ---
  // The whole season expanded once, grouped by month for the grey subheaders.
  const dtMonths = React.useMemo(() => {
    if (!form || form.type !== 'scoala' || form.freq === 'none') return [];
    const groups: Array<{ key: string; label: string; dates: string[] }> = [];
    for (const d of seriesDates(form)) {
      const key = d.slice(0, 7);
      let g = groups[groups.length - 1];
      if (!g || g.key !== key) {
        g = { key, label: `${RO_MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`, dates: [] };
        groups.push(g);
      }
      g.dates.push(d);
    }
    return groups;
  }, [form?.type, form?.freq, form?.days, form?.weekOfMonth, form?.seasonStart, form?.seasonEnd]);

  const dtCount = dtMonths.reduce((n, g) => n + g.dates.length, 0);
  const showDateTable = !!form && (!form.scoalaDate || scoalaView === 'series') && form.type === 'scoala' && form.freq !== 'none';

  // Exceptions keyed by date, so a row reads its own state in one lookup.
  const exByDateForm = React.useMemo(() => {
    const m = new Map<string, Exception>();
    for (const x of form?.exceptions ?? []) m.set(x.date, x);
    return m;
  }, [form?.exceptions]);

  // A Școala occurrence is "curs" unless an exception says otherwise. `cancel`
  // predates the per-state kinds, so it reads as anulat.
  const rowState = (date: string): string => {
    const k = exByDateForm.get(date)?.kind;
    if (k === 'liber') return 'liber';
    if (k === 'anulat' || k === 'cancel') return 'anulat';
    return 'curs';
  };

  /**
   * Same write path as the "Această dată" tab: the state lives as an exception
   * on the event, and going back to Curs removes it. When the row is the date
   * the panel was opened on, the per-date fields are kept in step, because
   * `save()` rebuilds that one exception from them.
   */
  const setRowState = (date: string, next: string) => {
    if (!form) return;
    const prev = exByDateForm.get(date);
    const rest = form.exceptions.filter((x) => x.date !== date);
    const exs = next === 'curs'
      ? rest
      : [...rest, { date, kind: next as Exception['kind'], newTitle: prev?.newTitle ?? '' }];
    exs.sort((a, b) => a.date.localeCompare(b.date));
    const patch: Partial<FormState> = { exceptions: exs };
    if (date === form.scoalaDate) {
      patch.scoalaState = next;
      patch.scoalaNote = next === 'curs' ? '' : (prev?.newTitle ?? '');
    }
    upd(patch);
  };

  const setRowNote = (date: string, note: string) => {
    if (!form) return;
    const i = form.exceptions.findIndex((x) => x.date === date);
    if (i < 0) return;
    const exs = [...form.exceptions];
    exs[i] = { ...exs[i], newTitle: note };
    const patch: Partial<FormState> = { exceptions: exs };
    if (date === form.scoalaDate) patch.scoalaNote = note;
    upd(patch);
  };

  // Open on the current month, or the first month of the season when it has not
  // started yet. Past dates stay in the list, only muted.
  React.useEffect(() => {
    if (!showDateTable || dtMonths.length === 0) return;
    const nowKey = ymd(new Date()).slice(0, 7);
    const target = dtMonths.find((g) => g.key >= nowKey) ?? dtMonths[dtMonths.length - 1];
    const row = dtAnchors.current[target.key];
    const box = dtScroll.current;
    if (row && box) box.scrollTop = Math.max(0, row.offsetTop - 28);
  }, [showDateTable, form?.documentId, dtMonths.length]);

  // The editor also renders inside the content-manager (custom field), where
  // no AdminPage injects the shared stylesheet: inject it here too.
  React.useInsertionEffect(() => ensureAdminUi(), []);

  const todayKey = ymd(today);


  const panelCols = !form?.scoalaDate || scoalaView === 'series';

  return (
    <div className="ui-root cal">
      <style>{CSS}</style>
      <div className="cal-wrap">
        {/* SIDEBAR */}
        <div className="cal-side">
          <Button className="cal-add" icon={<IconPlus />} onClick={() => openCreate()}>
            Adaugă
          </Button>
          <div className="cal-cats" role="group" aria-label="Categorii afișate">
            <div className="cal-st">Categorii</div>
            {CATEGORIES.map((c) => (
              <Checkbox
                key={c.key}
                className={hidden.has(c.key) ? 'cal-cat cal-cat--off' : 'cal-cat'}
                checked={!hidden.has(c.key)}
                onChange={() => toggleCat(c.key)}
                label={
                  <>
                    <span className="cal-sw" style={{ background: catFill(c.cat) }} aria-hidden="true" />
                    {c.label}
                  </>
                }
              />
            ))}
          </div>
        </div>

        {/* CALENDAR */}
        <div className="cal-main">
          <div className="cal-head">
            <div className="cal-nav">
              <Button variant="secondary" size="sm" aria-label="Luna anterioară" onClick={prevMonth}>
                ‹
              </Button>
              <span>
                {RO_MONTHS[ym.m]} {ym.y}
              </span>
              <Button variant="secondary" size="sm" aria-label="Luna următoare" onClick={nextMonth}>
                ›
              </Button>
            </div>
            {loading && <span className="ui-hint">se încarcă…</span>}
          </div>
          <div className="cal-dows">
            {RO_DOW.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="cal-grid">
            {weeks.flat().map((d) => {
              const key = ymd(d);
              const inMonth = d.getMonth() === ym.m;
              const items = byDate.get(key) ?? [];
              return (
                <div key={key} className={`cal-day${inMonth ? '' : ' cal-day--off'}${key === todayKey ? ' cal-day--today' : ''}`} onClick={() => openCreate(key)}>
                  <div className="cal-num">{d.getDate()}</div>
                  {items.slice(0, 4).map((o, i) => {
                    const isScoala = o.type === 'scoala';
                    const state = (o as any).state as string | undefined;
                    const cancelled = o.status === 'cancelled' || state === 'anulat' || state === 'liber';
                    // Colour comes only from category / state, never the per-event
                    // color field: the website ignores it and the admin has no
                    // input for it.
                    const cat: CalendarCategory = isScoala
                      ? (SCOALA_CAT[state ?? ''] ?? SCOALA_CAT.curs)
                      : cancelled
                        ? 'anulat'
                        : (CAT_OF[o.type] ?? 'scoala');
                    const label = isScoala ? `Școala: ${SCOALA_LABEL[state ?? ''] ?? 'Curs'}` : `${o.startTime ? `${o.startTime} ` : ''}${o.label || o.title}`;
                    return (
                      <button
                        type="button"
                        key={i}
                        className={`cal-ev${state === 'anulat' ? ' cal-ev--cancel' : ''}`}
                        style={{ '--cal-c': catFill(cat) } as React.CSSProperties}
                        title={isScoala ? `${label}${(o as any).note ? ` — ${(o as any).note}` : ''}` : o.title}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(o.documentId, key);
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                  {items.length > 4 && <div className="cal-more">+{items.length - 4}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* PANEL */}
      {form && (
        <div className="cal-panel" ref={panelRef}>
          <div className="cal-ph">
            <h4>{form.scoalaDate ? form.title || 'Eveniment' : form.documentId ? 'Editează eveniment' : 'Adaugă eveniment'}</h4>
            <Button variant="ghost" size="sm" iconOnly icon={<IconClose />} aria-label="Închide" onClick={() => setForm(null)} />
          </div>
          <div className={`cal-body${panelCols ? ' cal-body--cols' : ''}`}>
            {form.scoalaDate && (
              <>
                <Tabs
                  className="cal-span"
                  label="Ce editezi"
                  value={scoalaView}
                  onChange={(v) => setScoalaView(v as 'date' | 'series')}
                  items={[
                    { id: 'date', label: 'Această dată' },
                    { id: 'series', label: 'Toată seria' },
                  ]}
                />
                {scoalaView === 'date' && (
                  <div className="cal-stack">
                    <Field label="Data">
                      <Input value={form.scoalaDate ?? ''} disabled />
                    </Field>
                    {form.type === 'scoala' ? (
                      <>
                        <Field label="Stare">
                          <SegmentedControl
                            aria-label="Stare"
                            options={SCOALA_STATE_OPTIONS}
                            value={form.scoalaState}
                            onChange={(v) => upd({ scoalaState: v })}
                          />
                        </Field>
                        {form.scoalaState !== 'curs' && (
                          <Field label="Notă / motiv (opțional)">
                            <Input value={form.scoalaNote} onChange={(e) => upd({ scoalaNote: e.target.value })} placeholder="ex. Vacanță de Crăciun" />
                          </Field>
                        )}
                      </>
                    ) : (
                      <>
                        <Field label="Pentru această dată">
                          <SegmentedControl
                            aria-label="Pentru această dată"
                            options={OCC_MODE_OPTIONS}
                            value={form.occMode}
                            onChange={(v) => upd({ occMode: v })}
                          />
                        </Field>
                        {form.occMode === 'override' && (
                          <>
                            <Field label="Dată">
                              <DateInput value={form.occNewDate || form.scoalaDate || ''} onChange={(v) => upd({ occNewDate: v ?? '' })} />
                            </Field>
                            <FieldRow>
                              <Field label="Început">
                                <TimeInput value={form.occNewStart || form.startTime || null} onChange={(v) => upd({ occNewStart: v ?? '' })} />
                              </Field>
                              <Field label="Sfârșit">
                                <TimeInput value={form.occNewEnd || form.endTime || null} onChange={(v) => upd({ occNewEnd: v ?? '' })} />
                              </Field>
                            </FieldRow>
                            {form.endsNextDay && <div className="ui-hint">Seria se termină a doua zi; ora de sfârșit rămâne pe ziua următoare.</div>}
                          </>
                        )}
                      </>
                    )}
                    <div className="ui-hint">Se aplică doar pentru această dată.</div>
                  </div>
                )}
              </>
            )}
            {panelCols && (
              <>
                {/* Top-left block: what the event is and when it happens. */}
                <div className="cal-sec">
                  <div className="cal-st">Evenimentul</div>
                  <Field label="Titlu">
                    <Input value={form.title} onChange={(e) => upd({ title: e.target.value })} />
                  </Field>
                  <FieldRow>
                    <Field label="Categorie">
                      <Select value={form.type} options={CATEGORY_OPTIONS} onChange={(v) => upd({ type: v })} />
                    </Field>
                    <Field label="Etichetă (ex. Grupa A)">
                      <Input value={form.label} onChange={(e) => upd({ label: e.target.value })} />
                    </Field>
                  </FieldRow>
                  {/* The hours and the all-day switch sit on one line. Turning it
                      on disables the time inputs instead of removing them, so the
                      panel keeps its height. buildBody still saves null hours for
                      an all-day event. */}
                  <div className="cal-times">
                    <Field label="Început">
                      <TimeInput value={form.startTime || null} disabled={form.allDay} onChange={(v) => upd({ startTime: v ?? '' })} />
                    </Field>
                    <Field label="Sfârșit">
                      {/* Constrained to after the start, unless the event is
                          explicitly marked as ending the next day. */}
                      <TimeInput
                        value={form.endTime || null}
                        disabled={form.allDay}
                        min={form.endsNextDay || !form.startTime ? undefined : form.startTime}
                        onChange={(v) => upd({ endTime: v ?? '' })}
                      />
                    </Field>
                    <Switch className="cal-allday" checked={form.allDay} onChange={(c) => upd({ allDay: c })} label="Toată ziua" />
                  </div>
                  <Switch checked={form.endsNextDay} disabled={form.allDay} onChange={(c) => upd({ endsNextDay: c })} label="Se termină a doua zi" />
                  {(form.allDay || (form.startTime && form.endTime)) && <div className="ui-hint">{spanHint(form)}</div>}
                </div>

                {/* Top-right block: the most complex group gets a full half. */}
                <div className="cal-sec">
                  <div className="cal-st">Recurență</div>
                  <Field label="Recurență" hideLabel>
                    <Select value={form.freq} options={FREQ_OPTIONS} onChange={(v) => upd({ freq: v })} />
                  </Field>
                  {form.freq === 'none' ? (
                    <FieldRow>
                      <Field label="Data">
                        <DateInput value={form.singleDate || null} onChange={(v) => upd({ singleDate: v ?? '' })} />
                      </Field>
                      <Field label="până la (opțional)">
                        <DateInput value={form.endDate || null} onChange={(v) => upd({ endDate: v ?? '' })} />
                      </Field>
                    </FieldRow>
                  ) : (
                    <>
                      <div className="ui-field">
                        <span className="ui-label" id="cal-days-l">
                          Zile
                        </span>
                        <div className="cal-days" role="group" aria-labelledby="cal-days-l">
                          {WD.map(([k, lbl]) => (
                            <button
                              key={k}
                              type="button"
                              aria-pressed={form.days[k]}
                              className="cal-dayt"
                              onClick={() => upd({ days: { ...form.days, [k]: !form.days[k] } })}
                            >
                              {lbl}
                            </button>
                          ))}
                        </div>
                      </div>
                      {form.freq === 'monthly' && (
                        <Field label="Săptămâna din lună">
                          <Select value={form.weekOfMonth} options={WEEK_OF_MONTH_OPTIONS} onChange={(v) => upd({ weekOfMonth: v })} />
                        </Field>
                      )}
                      {/* Every recurring series needs a window, not just Școala:
                          without one it repeated forever, and the biweekly parity
                          shifted with whatever range happened to be fetched. */}
                      <FieldRow>
                        <Field label={form.type === 'scoala' ? 'Sezon de la' : 'Prima dată'}>
                          <DateInput value={form.seasonStart || null} onChange={(v) => upd({ seasonStart: v ?? '' })} />
                        </Field>
                        <Field label={form.type === 'scoala' ? 'până la' : 'Ultima dată'}>
                          <DateInput min={form.seasonStart || undefined} value={form.seasonEnd || null} onChange={(v) => upd({ seasonEnd: v ?? '' })} />
                        </Field>
                      </FieldRow>
                      <div className="ui-hint">Obligatoriu. Seria poate dura cel mult un an.</div>
                    </>
                  )}
                </div>

                {/* Full width below: description, link and image need real width,
                    not a third of it. */}
                <div className="cal-sec cal-span">
                  <div className="cal-st">
                    Conținut <span className="cal-opt">opțional</span>
                  </div>
                  <Field label="Descriere">
                    <Textarea rows={3} value={form.description} onChange={(e) => upd({ description: e.target.value })} />
                  </Field>
                  <div className="cal-content">
                    <Field label="Link">
                      <Input value={form.linkUrl} onChange={(e) => upd({ linkUrl: e.target.value })} />
                    </Field>
                    <Field label="Etichetă link">
                      <Input value={form.linkLabel} onChange={(e) => upd({ linkLabel: e.target.value })} />
                    </Field>
                    <div className="ui-field">
                      <span className="ui-label">Imagine</span>
                      <div className="cal-img">
                        <div className="cal-thumb" style={form.imageUrl ? { backgroundImage: `url(${form.imageUrl})` } : undefined} />
                        <Button variant="ghost" size="sm" onClick={() => setMediaOpen(true)}>
                          {form.imageUrl ? 'schimbă imaginea' : 'alege imagine'}
                        </Button>
                        {form.imageUrl && (
                          <Button variant="ghost" size="sm" className="cal-danger" onClick={() => upd({ imageUrl: '' })}>
                            elimină
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {showDateTable && (
              <div className="cal-sec cal-span">
                <div className="cal-st">
                  Datele seriei <span className="cal-opt">{dtCount === 1 ? 'o dată' : `${dtCount} date`}</span>
                </div>
                {dtCount === 0 ? (
                  <div className="ui-hint">Alege zilele din săptămână și sezonul, apoi datele apar aici.</div>
                ) : (
                  <>
                    <div className="cal-dt" ref={dtScroll}>
                      <table className="cal-dt-table">
                        <thead>
                          <tr>
                            <th className="cal-c-date">Data</th>
                            <th className="cal-c-state">Stare</th>
                            <th>Notă</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dtMonths.map((g) => (
                            <React.Fragment key={g.key}>
                              <tr
                                className="cal-dt-sub"
                                ref={(el) => {
                                  dtAnchors.current[g.key] = el;
                                }}
                              >
                                <td colSpan={3}>
                                  {g.label}, {g.dates.length === 1 ? 'o dată' : `${g.dates.length} date`}
                                </td>
                              </tr>
                              {g.dates.map((d) => {
                                const st = rowState(d);
                                const ex = exByDateForm.get(d);
                                return (
                                  <tr key={d} className={`cal-dt-row${d < todayKey ? ' cal-dt-row--past' : ''}${d === form.scoalaDate ? ' cal-dt-row--cur' : ''}`}>
                                    <td className="cal-c-date">{fmtRoLong(d)}</td>
                                    <td className="cal-c-state">
                                      <div className="cal-pick">
                                        <span className="cal-sw" style={{ background: catFill(SCOALA_CAT[st]) }} aria-hidden="true" />
                                        <Select
                                          aria-label={`Stare ${fmtRoLong(d)}`}
                                          value={st}
                                          options={SCOALA_STATE_OPTIONS}
                                          onChange={(v) => setRowState(d, v)}
                                        />
                                      </div>
                                    </td>
                                    <td>
                                      {st === 'curs' ? (
                                        <span className="cal-muted">
                                          {form.allDay ? 'Toată ziua' : form.startTime && form.endTime ? `${form.startTime} - ${form.endTime}` : ''}
                                        </span>
                                      ) : (
                                        <Input
                                          className="cal-note"
                                          aria-label={`Notă ${fmtRoLong(d)}`}
                                          value={ex?.newTitle ?? ''}
                                          onChange={(e) => setRowNote(d, e.target.value)}
                                          placeholder="ex. patinoar rezervat"
                                        />
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="ui-hint">Nota se păstrează pentru zilele Liber sau Anulat. Modificările intră în calendar după Salvează.</div>
                  </>
                )}
              </div>
            )}

            {panelCols && form.freq !== 'none' && form.type !== 'scoala' && (
              <div className="cal-sec cal-span">
                <div className="cal-st">
                  Excepții <span className="cal-opt">anulări / mutări</span>
                </div>
                <RepeatableList<Exception>
                  items={form.exceptions}
                  onChange={(next) => upd({ exceptions: next })}
                  getKey={(_, i) => i}
                  newItem={() => ({ date: '', kind: 'cancel' })}
                  addLabel="Adaugă excepție"
                  emptyLabel="Nicio excepție."
                  itemLabel={(x, i) => (x.date ? `excepția din ${fmtShort(x.date)}` : `excepția ${i + 1}`)}
                  expandable
                  aria-label="Excepții"
                  renderSummary={(x) => {
                    const isMove = x.kind === 'override';
                    const origH = form.startTime && form.endTime ? `${form.startTime}–${form.endTime}` : form.startTime || '';
                    const nStart = (x.newStartTime ?? '').slice(0, 5);
                    const nEnd = (x.newEndTime ?? '').slice(0, 5);
                    const newH = nStart && nEnd ? `${nStart}–${nEnd}` : nStart || origH;
                    const toDate = x.newDate || x.date;
                    return (
                      <span className="cal-exsum">
                        <StatusBadge tone={isMove ? 'primary' : 'danger'}>{isMove ? 'Mutat' : 'Anulat'}</StatusBadge>
                        {isMove ? (
                          <span className="cal-chg">
                            <span className="cal-muted">
                              {fmtShort(x.date) || 'alege data'}
                              {origH ? ` ${origH}` : ''}
                            </span>
                            <span className="cal-muted"> → </span>
                            <b>
                              {fmtShort(toDate) || '…'}
                              {newH ? ` ${newH}` : ''}
                            </b>
                          </span>
                        ) : (
                          <b className="cal-chg">{fmtShort(x.date) || 'alege data'}</b>
                        )}
                      </span>
                    );
                  }}
                  renderRow={(x, i, { update }) => {
                    const isMove = x.kind === 'override';
                    const nStart = (x.newStartTime ?? '').slice(0, 5);
                    const nEnd = (x.newEndTime ?? '').slice(0, 5);
                    return (
                      <div className="cal-stack">
                        <SegmentedControl
                          size="sm"
                          aria-label="Tip excepție"
                          options={EX_KIND_OPTIONS}
                          value={isMove ? 'override' : 'cancel'}
                          onChange={(v) => update({ kind: v as Exception['kind'] })}
                        />
                        <Field label="Data">
                          <DateInput value={x.date || null} onChange={(v) => update({ date: v ?? '' })} />
                        </Field>
                        {isMove && (
                          <>
                            <Field label="Data nouă">
                              <DateInput value={x.newDate || x.date || null} onChange={(v) => update({ newDate: v ?? '' })} />
                            </Field>
                            <FieldRow>
                              <Field label="Început" id={`cal-ex-start-${i}`}>
                                <TimeInput value={nStart || form.startTime || null} onChange={(v) => update({ newStartTime: v ?? '' })} />
                              </Field>
                              <Field label="Sfârșit" id={`cal-ex-end-${i}`}>
                                <TimeInput value={nEnd || form.endTime || null} onChange={(v) => update({ newEndTime: v ?? '' })} />
                              </Field>
                            </FieldRow>
                          </>
                        )}
                      </div>
                    );
                  }}
                />
              </div>
            )}
          </div>

          {saveError && (
            <div className="cal-err">
              <Notice tone="danger">{saveError}</Notice>
            </div>
          )}
          <div className="cal-pa">
            {form.documentId && panelCols && (
              <Button variant="danger" onClick={remove} disabled={saving}>
                Șterge
              </Button>
            )}
            <Button className="cal-save" onClick={save} loading={saving} disabled={!dirty}>
              {saving ? 'Se salvează…' : 'Salvează'}
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDel}
        title={form && form.freq !== 'none' ? 'Ștergi seria?' : 'Ștergi evenimentul?'}
        message={
          !form
            ? ''
            : form.freq !== 'none'
              ? `Ștergi seria „${form.title || 'fără titlu'}"? Toate aparițiile din calendar dispar definitiv. Acțiunea nu poate fi anulată.`
              : `Ștergi evenimentul „${form.title || 'fără titlu'}"${form.singleDate ? ` din ${fmtRoDate(form.singleDate)}` : ''}? Acțiunea nu poate fi anulată.`
        }
        busy={saving}
        error={delError}
        onCancel={() => setConfirmDel(false)}
        onConfirm={doRemove}
      />

      <ImagePicker
        open={mediaOpen}
        onClose={() => setMediaOpen(false)}
        onPick={(img) => {
          upd({ imageUrl: img.url });
          setMediaOpen(false);
        }}
      />
    </div>
  );
}

// Scoped under .cal (the editor root, which also carries .ui-root). Colours
// only from --theme-* (calendar categories from --theme-cat-*), corners from
// --ui-radius-*, so the calendar follows the light / dark admin theme.
const CSS = `
.cal{font-family:var(--ui-font);color:var(--theme-text)}
.cal-wrap{display:flex;gap:14px;align-items:flex-start}
.cal-side{width:184px;flex-shrink:0;display:flex;flex-direction:column;gap:12px}
.cal .cal-add{width:100%;justify-content:center}
.cal-cats{display:flex;flex-direction:column;gap:6px}
.cal-st{font-size:var(--ui-fs-section-title);font-weight:var(--ui-fw-section-title);letter-spacing:var(--ui-ls-section-title);text-transform:uppercase;color:var(--theme-text-muted);margin-bottom:2px}
.cal-opt{font-weight:400;text-transform:none;letter-spacing:0;color:var(--theme-text-muted)}
.cal .cal-cat > span{display:inline-flex;align-items:center;gap:7px}
.cal .cal-cat--off > span{opacity:.45;text-decoration:line-through}
.cal-sw{width:12px;height:12px;border-radius:var(--ui-radius-sm);display:inline-block;flex-shrink:0}
.cal-main{flex:1;min-width:0;border:1px solid var(--theme-border);border-radius:var(--ui-radius-sm);overflow:hidden;background:var(--theme-surface)}
.cal-head{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--theme-border)}
.cal-nav{display:flex;align-items:center;gap:10px;font-size:14px;font-weight:600;color:var(--theme-text)}
.cal-dows{display:grid;grid-template-columns:repeat(7,1fr)}
.cal-dows div{text-align:center;font-size:var(--ui-fs-label);font-weight:var(--ui-fw-label);letter-spacing:var(--ui-ls-label);color:var(--theme-text-muted);padding:6px 0;border-bottom:1px solid var(--theme-border);text-transform:uppercase}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr)}
.cal-day{min-height:82px;min-width:0;border-right:1px solid var(--theme-border-subtle);border-bottom:1px solid var(--theme-border-subtle);padding:4px 5px;cursor:pointer;display:flex;flex-direction:column;gap:2px}
.cal-day:hover{background:var(--theme-primary-soft)}
.cal-day--off{background:var(--theme-surface-subtle)}
.cal-num{font-size:var(--ui-fs-caption);color:var(--theme-text-muted)}
.cal-day--off .cal-num{color:var(--theme-text-disabled)}
.cal-day--today .cal-num{color:var(--theme-primary);font-weight:800}
.cal-ev{display:block;width:100%;text-align:left;font-family:inherit;font-size:10px;line-height:1.4;padding:1px 5px;border:none;border-left:3px solid var(--cal-c);border-radius:var(--ui-radius-sm);background:color-mix(in srgb, var(--cal-c) 16%, var(--theme-surface));color:var(--theme-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
.cal-ev:hover{background:color-mix(in srgb, var(--cal-c) 28%, var(--theme-surface))}
.cal-ev:focus-visible{outline:2px solid var(--theme-focus);outline-offset:1px}
.cal-ev--cancel{text-decoration:line-through;color:var(--theme-text-muted);background:var(--theme-surface-sunken)}
.cal-more{font-size:9px;color:var(--theme-text-muted)}
/* Sits BELOW the calendar, not beside it: beside it, it took its width straight
   out of the day grid. Full width below costs the calendar nothing and gives
   the form room for two columns. */
.cal-panel{width:100%;margin-top:14px;display:flex;flex-direction:column;border:1px solid var(--theme-border-strong);border-radius:var(--ui-radius-sm);background:var(--theme-surface);box-shadow:var(--theme-shadow-sm);overflow:hidden}
.cal-ph{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 12px 10px 15px;border-bottom:1px solid var(--theme-border)}
.cal-ph h4{margin:0;font-size:15px;font-weight:700;color:var(--theme-text)}
.cal-body{padding:15px;display:flex;flex-direction:column;gap:14px}
/* Two columns on the top row, full-width blocks beneath, but only for the whole
   series. The "Această dată" tab has at most six fields, so columns there
   would leave them empty. */
.cal-body--cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px 20px;align-items:start}
.cal-body--cols > .cal-span{grid-column:1 / -1}
.cal-sec,.cal-stack{display:flex;flex-direction:column;gap:var(--ui-space-3);min-width:0}
.cal-times{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;gap:var(--ui-space-3);align-items:end}
.cal .cal-allday{padding-bottom:7px;white-space:nowrap}
.cal-days{display:flex;flex-wrap:wrap;gap:4px}
.cal-dayt{min-width:32px;height:30px;padding:0 6px;border:1px solid var(--theme-border-strong);border-radius:var(--ui-radius-sm);background:var(--theme-surface);color:var(--theme-text-secondary);font-family:inherit;font-size:var(--ui-fs-body-sm);font-weight:600;cursor:pointer}
.cal-dayt:hover{border-color:var(--theme-primary);color:var(--theme-text)}
.cal-dayt[aria-pressed="true"]{background:var(--theme-primary);border-color:var(--theme-primary);color:var(--theme-on-primary)}
.cal-dayt:focus-visible{outline:2px solid var(--theme-focus);outline-offset:1px}
.cal-content{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,1fr) minmax(0,1.4fr);gap:var(--ui-space-3);align-items:start}
.cal-img{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.cal-thumb{width:56px;height:34px;border-radius:var(--ui-radius-sm);background:var(--theme-surface-sunken) center/cover no-repeat;border:1px solid var(--theme-border);flex-shrink:0}
.cal .cal-danger{color:var(--theme-danger)}
.cal-muted{color:var(--theme-text-muted)}
/* Series date table: one row per generated occurrence, months as full-width
   subheaders. Flat and scrollable, so the whole season stays one list. */
.cal-dt{position:relative;max-height:340px;overflow-y:auto;border:1px solid var(--theme-border);border-radius:var(--ui-radius-sm);background:var(--theme-surface)}
.cal-dt-table{width:100%;border-collapse:collapse;font-size:var(--ui-fs-body-sm)}
.cal-dt-table thead th{position:sticky;top:0;z-index:2;text-align:left;font-size:var(--ui-fs-label);letter-spacing:var(--ui-ls-label);text-transform:uppercase;color:var(--theme-text-muted);font-weight:var(--ui-fw-label);padding:7px 10px;background:var(--theme-surface-subtle);border-bottom:1px solid var(--theme-border)}
.cal-dt-table td{padding:4px 10px;border-bottom:1px solid var(--theme-border-subtle);vertical-align:middle}
.cal-dt-table tr:last-child td{border-bottom:none}
.cal-c-date{width:190px;white-space:nowrap}
.cal-c-state{width:160px}
.cal-dt-sub td{background:var(--theme-surface-subtle);font-weight:700;font-size:var(--ui-fs-label);letter-spacing:var(--ui-ls-label);text-transform:uppercase;color:var(--theme-text-muted);padding:5px 10px}
.cal-dt-row--past{color:var(--theme-text-muted)}
.cal-dt-row--cur{background:var(--theme-primary-soft)}
.cal-pick{display:flex;align-items:center;gap:7px}
.cal .cal-pick .ui-input,.cal .cal-note{padding-top:3px;padding-bottom:3px;font-size:var(--ui-fs-body-sm)}
.cal-exsum{display:flex;align-items:center;gap:8px;min-width:0}
.cal-chg{font-size:var(--ui-fs-body-sm);min-width:0;overflow:hidden;text-overflow:ellipsis}
.cal-err{padding:0 15px 12px}
.cal-pa{display:flex;align-items:center;gap:10px;padding:12px 15px;border-top:1px solid var(--theme-border);background:var(--theme-surface-subtle)}
.cal .cal-save{margin-left:auto;min-width:140px;justify-content:center}
@media (max-width:900px){
  .cal-body--cols{grid-template-columns:minmax(0,1fr)}
  .cal-content{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
}
@media (max-width:720px){
  .cal-wrap{flex-direction:column;align-items:stretch}
  .cal-side{width:auto}
  .cal-cats{flex-direction:row;flex-wrap:wrap;gap:6px 14px}
  .cal-times{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .cal-content{grid-template-columns:minmax(0,1fr)}
}
`;
