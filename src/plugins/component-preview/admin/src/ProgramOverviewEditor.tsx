import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { Checkbox } from '@strapi/design-system';
import { MediaPicker } from './components/MediaPicker';
import { TimePicker } from './components/TimePicker';
// Canonical shared confirm dialog: src/admin/ConfirmDialog.tsx. The admin panel
// and this local plugin compile into the same vite bundle (src/admin/app.tsx
// imports this plugin by relative path), so importing across the boundary is
// safe. Edit the canonical file, not a copy.
import { ConfirmDialog } from '../../../../admin/ConfirmDialog';

// Per-occurrence states for the Școala de patinaj recurring event.
const SCOALA_STATES = [
  { key: 'curs', label: 'Curs', color: '#0e1a3c' },
  { key: 'liber', label: 'Liber', color: '#8a8a8a' },
  { key: 'anulat', label: 'Anulat', color: '#be3330' },
] as const;
const SCOALA_COLOR: Record<string, string> = Object.fromEntries(SCOALA_STATES.map((s) => [s.key, s.color]));
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
  { key: 'curs', label: 'Antrenament', color: '#2138b8' },
  { key: 'scoala', label: 'Școala de patinaj', color: '#0e1a3c' },
  { key: 'concurs', label: 'Competiție', color: '#7a1fa2' },
  { key: 'cantonament', label: 'Cantonament', color: '#1f7a4d' },
  { key: 'spectacol', label: 'Spectacol', color: '#00838f' },
  { key: 'eveniment', label: 'Eveniment', color: '#e08a00' },
  { key: 'vacanta', label: 'Vacanță', color: '#0891b2' },
  { key: 'sarbatoare', label: 'Sărbătoare', color: '#c026d3' },
  { key: 'liber', label: 'Pauză / zi liberă', color: '#8a8a8a' },
] as const;
const COLOR: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.color]));
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
  title: string; type: string; label: string; color: string;
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

// --- 24h time adapters: FormState keeps "HH:mm" strings, TimePicker wants numbers.
const parseHM = (v: string): { hour: number; minute: number } => {
  const [h, m] = String(v || '').split(':');
  return { hour: Number(h) || 0, minute: Number(m) || 0 };
};
const fmtHM = (h: number, m: number) => `${pad(h)}:${pad(m)}`;

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
    documentId: null, title: '', type: 'curs', label: '', color: '',
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
  const [expEx, setExpEx] = React.useState<number | null>(null);
  const [mediaOpen, setMediaOpen] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);
  // For a Școala occurrence: edit just this date's state, or the whole series.
  const [scoalaView, setScoalaView] = React.useState<'date' | 'series'>('date');
  // Which row of the series date table has its state dropdown open.
  const [pickOpen, setPickOpen] = React.useState<string | null>(null);
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
      const res = await get(`${CM_EVENT}/${documentId}`);
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
        title: e.title ?? '', type: e.type ?? 'curs', label: e.label ?? '', color: e.color ?? '',
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
        occMode, occNewStart, occNewEnd, occNewTitle,
      });
    } catch (err) { /* ignore */ }
  };

  const buildBody = (f: FormState) => ({
    title: f.title, type: f.type, label: f.label || null, color: f.color || null,
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

  // Any click outside a row dropdown closes it. The menu itself stops the
  // mousedown, so picking an option still lands on the option.
  React.useEffect(() => {
    if (!pickOpen) return;
    const close = () => setPickOpen(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [pickOpen]);

  const todayKey = ymd(today);

  return (
    <div className="pce">
      <style>{CSS}</style>
      <div className="pce-wrap">
        {/* SIDEBAR */}
        <div className="pce-side">
          <button className="pce-add" onClick={() => openCreate()}>+ Adaugă</button>
          <div className="pce-cat">
            <div className="pce-cat-t">Categorii</div>
            {CATEGORIES.map((c) => (
              <label key={c.key} className={hidden.has(c.key) ? 'off' : ''} onClick={() => toggleCat(c.key)}>
                <span className="dot" style={{ background: c.color }} /> {c.label}
              </label>
            ))}
          </div>
        </div>

        {/* CALENDAR */}
        <div className="pce-main">
          <div className="pce-head">
            <div className="pce-nav">
              <button onClick={prevMonth}>‹</button>
              <span>{RO_MONTHS[ym.m]} {ym.y}</span>
              <button onClick={nextMonth}>›</button>
            </div>
            {loading && <span className="pce-load">se încarcă…</span>}
          </div>
          <div className="pce-dows">{RO_DOW.map((d) => <div key={d}>{d}</div>)}</div>
          <div className="pce-grid">
            {weeks.flat().map((d) => {
              const key = ymd(d);
              const inMonth = d.getMonth() === ym.m;
              const items = byDate.get(key) ?? [];
              return (
                <div key={key} className={`pce-day${inMonth ? '' : ' off'}`} onClick={() => openCreate(key)}>
                  <div className="num">{d.getDate()}</div>
                  {items.slice(0, 4).map((o, i) => {
                    const isScoala = o.type === 'scoala';
                    const stateColor = isScoala ? (SCOALA_COLOR[(o as any).state] ?? SCOALA_COLOR.curs) : undefined;
                    const cancelled = o.status === 'cancelled' || (o as any).state === 'anulat' || (o as any).state === 'liber';
                    const color = stateColor ?? (cancelled ? '#b0b0b0' : o.color || COLOR[o.type] || '#2138b8');
                    const label = isScoala
                      ? `Școala: ${SCOALA_LABEL[(o as any).state] ?? 'Curs'}`
                      : `${o.startTime ? `${o.startTime} ` : ''}${o.label || o.title}`;
                    return (
                      <div
                        key={i}
                        className={`ev${(o as any).state === 'anulat' ? ' cancel' : ''}`}
                        style={{ borderLeftColor: color, background: `${color}1e` }}
                        title={isScoala ? `${label}${(o as any).note ? ` — ${(o as any).note}` : ''}` : o.title}
                        onClick={(e) => { e.stopPropagation(); openEdit(o.documentId, key); }}
                      >
                        {label}
                      </div>
                    );
                  })}
                  {items.length > 4 && <div className="more">+{items.length - 4}</div>}
                </div>
              );
            })}
          </div>
        </div>

      </div>

        {/* PANEL */}
        {form && (
          <div className="pce-panel" ref={panelRef}>
            <div className="ph"><h4>{form.scoalaDate ? (form.title || 'Eveniment') : form.documentId ? 'Editează eveniment' : 'Adaugă eveniment'}</h4><span className="x" onClick={() => setForm(null)}>×</span></div>
            <div className={`pce-body${(!form.scoalaDate || scoalaView === 'series') ? ' pce-body--cols' : ''}`}>
            {form.scoalaDate && (
              <>
                <div className="scoala-tabs">
                  <button className={scoalaView === 'date' ? 'on' : ''} onClick={() => setScoalaView('date')}>Această dată</button>
                  <button className={scoalaView === 'series' ? 'on' : ''} onClick={() => setScoalaView('series')}>Toată seria</button>
                </div>
                {scoalaView === 'date' && (
                  <>
                    <div className="pce-fld"><label>Data</label><input value={form.scoalaDate ?? ''} disabled /></div>
                    {form.type === 'scoala' ? (
                      <>
                        <div className="pce-fld"><label>Stare</label>
                          <div className="pce-pills">
                            {SCOALA_STATES.map((s) => (
                              <span key={s.key} className="spill" onClick={() => upd({ scoalaState: s.key })} style={form.scoalaState === s.key ? { background: s.color, borderColor: s.color, color: '#fff' } : undefined}>{s.label}</span>
                            ))}
                          </div>
                        </div>
                        {form.scoalaState !== 'curs' && (
                          <div className="pce-fld"><label>Notă / motiv (opțional)</label><input value={form.scoalaNote} onChange={(e) => upd({ scoalaNote: e.target.value })} placeholder="ex. Vacanță de Crăciun" /></div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="pce-fld"><label>Pentru această dată</label>
                          <div className="pce-pills">
                            <span className={`spill${form.occMode === 'cancel' ? ' on' : ''}`} onClick={() => upd({ occMode: form.occMode === 'cancel' ? 'keep' : 'cancel' })}>Anulat</span>
                            <span className={`spill${form.occMode === 'override' ? ' on' : ''}`} onClick={() => upd({ occMode: form.occMode === 'override' ? 'keep' : 'override' })}>Modifică</span>
                          </div>
                        </div>
                        {form.occMode === 'override' && (
                          <>
                            <div className="pce-fld"><label>Dată</label><input type="date" value={form.occNewDate || form.scoalaDate || ''} onChange={(e) => upd({ occNewDate: e.target.value })} /></div>
                            <div className="row2">
                              <div className="pce-fld"><label>Început</label>
                                <TimePicker id="pce-occ-start" {...parseHM(form.occNewStart || form.startTime)}
                                  onChange={(h, m) => upd({ occNewStart: fmtHM(h, m) })} />
                              </div>
                              <div className="pce-fld"><label>Sfârșit</label>
                                <TimePicker id="pce-occ-end" {...parseHM(form.occNewEnd || form.endTime)}
                                  onChange={(h, m) => upd({ occNewEnd: fmtHM(h, m) })} />
                              </div>
                            </div>
                            {form.endsNextDay && <div className="pce-hint">Seria se termină a doua zi; ora de sfârșit rămâne pe ziua următoare.</div>}
                          </>
                        )}
                      </>
                    )}
                    <div className="pce-hint">Se aplică doar pentru această dată.</div>
                  </>
                )}
              </>
            )}
            {(!form.scoalaDate || scoalaView === 'series') && (
            <>
            {/* Top-left block: what the event is and when it happens. */}
            <div className="pce-sec pcol">
            <div className="st">Evenimentul</div>
            <div className="pce-fld"><label>Titlu</label><input value={form.title} onChange={(e) => upd({ title: e.target.value })} /></div>
            <div className="row2">
              <div className="pce-fld" style={{ flex: 1 }}><label>Categorie</label>
                <select value={form.type} onChange={(e) => upd({ type: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div className="pce-fld" style={{ flex: 1 }}><label>Etichetă (ex. Grupa A)</label><input value={form.label} onChange={(e) => upd({ label: e.target.value })} /></div>
            </div>
            {/* The hours and the all-day switch sit on one line. Ticking the box
                disables the pickers instead of removing them, so the panel keeps
                its height. buildBody still saves null hours for an all-day event. */}
            <div className="row2">
              <div className="pce-fld"><label>Început</label>
                <TimePicker id="pce-start" {...parseHM(form.startTime)} disabled={form.allDay}
                  onChange={(h, m) => upd({ startTime: fmtHM(h, m) })} />
              </div>
              <div className="pce-fld"><label>Sfârșit</label>
                {/* Constrained to after the start, unless the event is
                    explicitly marked as ending the next day. */}
                <TimePicker id="pce-end" {...parseHM(form.endTime)} disabled={form.allDay}
                  minTime={form.endsNextDay || !form.startTime ? undefined : parseHM(form.startTime)}
                  onChange={(h, m) => upd({ endTime: fmtHM(h, m) })} />
              </div>
              <div className="pce-chkfld">
                <span className="lblspacer" aria-hidden="true">&nbsp;</span>
                <div className="ctl">
                  <Checkbox checked={form.allDay} onCheckedChange={(c) => upd({ allDay: Boolean(c) })}>
                    Toată ziua
                  </Checkbox>
                </div>
              </div>
            </div>
            <div className="pce-chk">
              <Checkbox
                checked={form.endsNextDay}
                disabled={form.allDay}
                onCheckedChange={(c) => upd({ endsNextDay: Boolean(c) })}
              >
                Se termină a doua zi
              </Checkbox>
            </div>
            {(form.allDay || (form.startTime && form.endTime)) && (
              <div className="pce-hint">{spanHint(form)}</div>
            )}
            </div>

            {/* Top-right block: the most complex group gets a full half. */}
            <div className="pce-sec pcol">
              <div className="st">Recurență</div>
              <div className="pce-fld">
                <select value={form.freq} onChange={(e) => upd({ freq: e.target.value })}>
                  <option value="weekly">Săptămânal</option>
                  <option value="biweekly">La 2 săptămâni</option>
                  <option value="monthly">Lunar</option>
                  <option value="none">Nu se repetă (o dată)</option>
                </select>
              </div>
              {form.freq === 'none' ? (
                <div className="row2">
                  <div className="pce-fld"><label>Data</label><input type="date" value={form.singleDate} onChange={(e) => upd({ singleDate: e.target.value })} /></div>
                  <div className="pce-fld"><label>până la (opțional)</label><input type="date" value={form.endDate} onChange={(e) => upd({ endDate: e.target.value })} /></div>
                </div>
              ) : (
                <>
                  <div className="pce-fld"><label>Zile</label>
                    <div className="pce-pills">
                      {WD.map(([k, lbl]) => (
                        <span key={k} className={`pce-pill${form.days[k] ? ' on' : ''}`} onClick={() => upd({ days: { ...form.days, [k]: !form.days[k] } })}>{lbl}</span>
                      ))}
                    </div>
                  </div>
                  {form.freq === 'monthly' && (
                    <div className="pce-fld"><label>Săptămâna din lună</label>
                      <select value={form.weekOfMonth} onChange={(e) => upd({ weekOfMonth: e.target.value })}>
                        <option value="first">Prima</option><option value="second">A doua</option><option value="third">A treia</option><option value="fourth">A patra</option><option value="last">Ultima</option>
                      </select>
                    </div>
                  )}
                  {/* Every recurring series needs a window, not just Școala:
                      without one it repeated forever, and the biweekly parity
                      shifted with whatever range happened to be fetched. */}
                  <div className="row2">
                    <div className="pce-fld"><label>{form.type === 'scoala' ? 'Sezon de la' : 'Prima dată'}</label><input type="date" value={form.seasonStart} onChange={(e) => upd({ seasonStart: e.target.value })} /></div>
                    <div className="pce-fld"><label>{form.type === 'scoala' ? 'până la' : 'Ultima dată'}</label><input type="date" min={form.seasonStart || undefined} value={form.seasonEnd} onChange={(e) => upd({ seasonEnd: e.target.value })} /></div>
                  </div>
                  <div className="pce-hint">Obligatoriu. Seria poate dura cel mult un an.</div>
                </>
              )}
            </div>

            {/* Full width below: description, link and image need real width,
                not a third of it. */}
            <div className="pce-sec pcol-span">
              <div className="st">Conținut <span className="opt">opțional</span></div>
              <div className="pce-fld"><label>Descriere</label><textarea rows={3} value={form.description} onChange={(e) => upd({ description: e.target.value })} /></div>
              <div className="row2 contentRow">
                <div className="pce-fld" style={{ flex: 3 }}><label>Link</label><input value={form.linkUrl} onChange={(e) => upd({ linkUrl: e.target.value })} /></div>
                <div className="pce-fld" style={{ flex: 1 }}><label>Etichetă link</label><input value={form.linkLabel} onChange={(e) => upd({ linkLabel: e.target.value })} /></div>
                <div className="pce-fld" style={{ flex: 1 }}><label>Imagine</label>
                  <div className="img">
                    <div className="thumb" style={form.imageUrl ? { backgroundImage: `url(${form.imageUrl})`, backgroundSize: 'cover' } : {}} />
                    <span className="up" onClick={() => setMediaOpen(true)}>{form.imageUrl ? 'schimbă imaginea' : 'alege imagine'}</span>
                    {form.imageUrl && <span className="up" style={{ color: '#be3330' }} onClick={() => upd({ imageUrl: '' })}>elimină</span>}
                  </div>
                </div>
              </div>
            </div>
            </>
            )}

            {showDateTable && (
            <div className="pce-sec pcol-span">
              <div className="st">Datele seriei <span className="opt">{dtCount === 1 ? 'o dată' : `${dtCount} date`}</span></div>
              {dtCount === 0 ? (
                <div className="pce-hint">Alege zilele din săptămână și sezonul, apoi datele apar aici.</div>
              ) : (
                <>
                  <div className="dtWrap" ref={dtScroll}>
                    <table className="dtTable">
                      <thead>
                        <tr><th className="c-date">Data</th><th className="c-state">Stare</th><th>Notă</th></tr>
                      </thead>
                      <tbody>
                        {dtMonths.map((g) => (
                          <React.Fragment key={g.key}>
                            <tr className="dtSub" ref={(el) => { dtAnchors.current[g.key] = el; }}>
                              <td colSpan={3}>{g.label}, {g.dates.length === 1 ? 'o dată' : `${g.dates.length} date`}</td>
                            </tr>
                            {g.dates.map((d) => {
                              const st = rowState(d);
                              const ex = exByDateForm.get(d);
                              return (
                                <tr key={d} className={`dtRow${d < todayKey ? ' past' : ''}${d === form.scoalaDate ? ' cur' : ''}`}>
                                  <td className="c-date">{fmtRoLong(d)}</td>
                                  <td className="c-state">
                                    <div className="dtPick">
                                      <button type="button" className="dtBtn" onClick={() => setPickOpen(pickOpen === d ? null : d)}>
                                        <span className="dtDot" style={{ background: SCOALA_COLOR[st] }} />
                                        <span className="dtLbl">{SCOALA_LABEL[st]}</span>
                                        <span className="dtCar" />
                                      </button>
                                      {pickOpen === d && (
                                        <div className="dtMenu" onMouseDown={(e) => e.stopPropagation()}>
                                          {SCOALA_STATES.map((s) => (
                                            <button
                                              type="button"
                                              key={s.key}
                                              className={`dtOpt${s.key === st ? ' on' : ''}`}
                                              onClick={() => { setRowState(d, s.key); setPickOpen(null); }}
                                            >
                                              <span className="dtDot" style={{ background: s.color }} />
                                              {s.label}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td>
                                    {st === 'curs' ? (
                                      <span className="dtMuted">{form.allDay ? 'Toată ziua' : (form.startTime && form.endTime ? `${form.startTime} - ${form.endTime}` : '')}</span>
                                    ) : (
                                      <input
                                        className="dtNote"
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
                  <div className="pce-hint">Nota se păstrează pentru zilele Liber sau Anulat. Modificările intră în calendar după Salvează.</div>
                </>
              )}
            </div>
            )}

            {(!form.scoalaDate || scoalaView === 'series') && form.freq !== 'none' && form.type !== 'scoala' && (
            <div className="pce-sec pcol-span">
              <div className="st">Excepții <span className="opt">anulări / mutări</span></div>
              <div className="exList">
                {form.exceptions.map((x, i) => {
                  const isMove = x.kind === 'override';
                  const open = expEx === i;
                  const origH = form.startTime && form.endTime ? `${form.startTime}–${form.endTime}` : form.startTime || '';
                  const nStart = (x.newStartTime ?? '').slice(0, 5);
                  const nEnd = (x.newEndTime ?? '').slice(0, 5);
                  const newH = nStart && nEnd ? `${nStart}–${nEnd}` : nStart || origH;
                  const toDate = x.newDate || x.date;
                  const patch = (p: any) => { const ex = [...form.exceptions]; ex[i] = { ...ex[i], ...p }; upd({ exceptions: ex }); };
                  return (
                    <div key={i} className="exRow">
                      <div className="exSum" onClick={() => setExpEx(open ? null : i)}>
                        <span className={`kchip ${isMove ? 'move' : 'cancel'}`}>{isMove ? 'Mutat' : 'Anulat'}</span>
                        <span className="chg">
                          {isMove ? (
                            <>
                              <span className="f">{fmtShort(x.date) || 'alege data'}{origH ? ` ${origH}` : ''}</span>
                              <span className="a">→</span>
                              <span className="t">{fmtShort(toDate) || '…'}{newH ? ` ${newH}` : ''}</span>
                            </>
                          ) : (
                            <span className="t">{fmtShort(x.date) || 'alege data'}</span>
                          )}
                        </span>
                        <span className="exActs">
                          <span className="ed">{open ? '▲' : '✎'}</span>
                          <span className="rm" onClick={(e) => { e.stopPropagation(); upd({ exceptions: form.exceptions.filter((_, j) => j !== i) }); if (open) setExpEx(null); }}>×</span>
                        </span>
                      </div>
                      {open && (
                        <div className="exEdit">
                          <div className="kt">
                            <span className={`spill${!isMove ? ' on cancel' : ''}`} onClick={() => patch({ kind: 'cancel' })}>Anulat</span>
                            <span className={`spill${isMove ? ' on' : ''}`} onClick={() => patch({ kind: 'override' })}>Mutat</span>
                          </div>
                          <div className="pce-fld" style={{ margin: 0 }}><label>Data</label><input type="date" value={x.date} onChange={(e) => patch({ date: e.target.value })} /></div>
                          {isMove && (
                            <>
                              <span className="darr">↓</span>
                              <div className="pce-fld" style={{ margin: 0 }}><label>Data nouă</label><input type="date" value={x.newDate || x.date} onChange={(e) => patch({ newDate: e.target.value })} /></div>
                              <div className="row2">
                                <div className="pce-fld" style={{ margin: 0 }}><label>Început</label>
                                  <TimePicker id={`pce-ex-start-${i}`} {...parseHM(nStart || form.startTime)}
                                    onChange={(h, m) => patch({ newStartTime: fmtHM(h, m) })} />
                                </div>
                                <div className="pce-fld" style={{ margin: 0 }}><label>Sfârșit</label>
                                  <TimePicker id={`pce-ex-end-${i}`} {...parseHM(nEnd || form.endTime)}
                                    onChange={(h, m) => patch({ newEndTime: fmtHM(h, m) })} />
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <span className="addlink" onClick={() => { const ni = form.exceptions.length; upd({ exceptions: [...form.exceptions, { date: '', kind: 'cancel' }] }); setExpEx(ni); }}>+ adaugă excepție</span>
            </div>
            )}
            </div>

            {saveError && <div className="pce-err" role="alert">{saveError}</div>}
            <div className="pce-pa">
              <button className="btn-save" onClick={save} disabled={saving || !dirty}
                style={{ display: 'block', width: '100%', height: 'auto', minWidth: 0, boxSizing: 'border-box', padding: '12px', background: (saving || !dirty) ? '#9aa4d6' : '#2138b8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: (saving || !dirty) ? 'default' : 'pointer' }}>
                {saving ? 'Se salvează…' : 'Salvează'}
              </button>
              {form.documentId && (!form.scoalaDate || scoalaView === 'series') && (
                <button className="btn-del" onClick={remove} disabled={saving}
                  style={{ display: 'block', width: '100%', height: 'auto', minWidth: 0, boxSizing: 'border-box', marginTop: 8, padding: '10px', background: '#fff', color: '#be3330', border: '1px solid #e2c4c4', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                  Șterge
                </button>
              )}
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

      <MediaPicker open={mediaOpen} onClose={() => setMediaOpen(false)} onPick={(img) => { upd({ imageUrl: img.url }); setMediaOpen(false); }} />
    </div>
  );
}

const CSS = `
.pce-wrap { display:flex; gap:14px; align-items:flex-start; font-family:system-ui,-apple-system,sans-serif; }
.pce-side { width:184px; flex-shrink:0; }
.pce-mode { display:flex; border:1px solid #ccc; border-radius:7px; overflow:hidden; margin-bottom:12px; }
.pce-mode button { flex:1; font-size:12px; padding:6px 0; border:none; background:#fff; cursor:pointer; }
.pce-mode button.on { background:#2138b8; color:#fff; }
.pce-hint { font-size:11px; color:#999; margin-bottom:8px; }
.brush { display:flex; align-items:center; gap:8px; padding:7px 8px; border:1px solid transparent; border-radius:7px; font-size:13px; color:#333; cursor:pointer; user-select:none; }
.brush.on { border-color:#2138b8; background:#eef2ff; font-weight:600; }
.sstate { margin-top:6px; font-size:11px; font-weight:600; padding:2px 7px; border-radius:4px; display:inline-block; border-left:3px solid #888; }
.pce-add { width:100%; background:#2138b8; color:#fff; border:none; padding:8px 12px; border-radius:8px; font-size:13px; cursor:pointer; margin-bottom:12px; }
.pce-cat-t { font-size:11px; font-weight:700; color:#888; text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px; }
.pce-cat label { display:flex; align-items:center; gap:8px; padding:5px 0; font-size:13px; color:#333; cursor:pointer; user-select:none; }
.pce-cat label.off { opacity:.35; text-decoration:line-through; }
.dot { width:12px; height:12px; border-radius:3px; display:inline-block; flex-shrink:0; }
.pce-main { flex:1; min-width:0; border:1px solid #e3e3e3; border-radius:8px; overflow:hidden; background:#fff; }
.pce-head { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border-bottom:1px solid #eee; }
.pce-nav { display:flex; align-items:center; gap:10px; font-size:14px; font-weight:600; color:#222; }
.pce-nav button { border:1px solid #ddd; background:#fff; width:26px; height:26px; border-radius:6px; cursor:pointer; }
.pce-load { font-size:12px; color:#999; }
.pce-dows { display:grid; grid-template-columns:repeat(7,1fr); }
.pce-dows div { text-align:center; font-size:11px; font-weight:700; color:#999; padding:6px 0; border-bottom:1px solid #eee; text-transform:uppercase; }
.pce-grid { display:grid; grid-template-columns:repeat(7,1fr); }
.pce-day { min-height:82px; border-right:1px solid #f2f2f2; border-bottom:1px solid #f2f2f2; padding:4px 5px; cursor:pointer; }
.pce-day:hover { background:#fafbff; }
.pce-day.off { background:#fafafa; }
.pce-day.off .num { color:#ddd; }
.pce-day .num { font-size:11px; color:#aaa; margin-bottom:2px; }
.ev { font-size:10px; padding:1px 5px; border-radius:3px; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; cursor:pointer; border-left:3px solid #2138b8; color:#222; }
.ev.cancel { text-decoration:line-through; color:#aaa; background:#f0f0f0 !important; }
.more { font-size:9px; color:#999; }
/* Sits BELOW the calendar, not beside it. As a third flex child of .pce-wrap
   it was 320px + 14px gap of width taken straight out of .pce-main (the only
   flex:1 column), so opening it squeezed the day cells; and its
   max-height:calc(100vh - 200px) made it end short of a tall month. Full
   width below the grid costs the calendar nothing and gives the form room
   for two columns. */
.pce-panel { width:100%; margin-top:14px; display:flex; flex-direction:column; border:1px solid #dcdcdc; border-radius:10px; background:#fff; box-shadow:0 6px 24px rgba(0,0,0,.08); overflow:hidden; }
.pce-panel .ph { flex-shrink:0; background:#fff; display:flex; justify-content:space-between; align-items:center; padding:14px 15px; border-bottom:1px solid #eee; }
.pce-panel .ph h4 { margin:0; font-size:15px; }
.pce-panel .x { color:#999; cursor:pointer; font-size:20px; line-height:1; }
.pce-body { flex:1 1 auto; min-height:0; padding:15px; }
/* Two columns on the top row, one full-width block beneath, but only on the
   "Toată seria" tab. The "Această dată" tab has at most six fields, so columns
   there would leave them empty. The tab switcher spans the full width so it
   does not jump when you change tab.
   Three equal columns gave a one-line title the same width as a textarea and
   squeezed recurrence, the densest group, into a third. Now identity and hours
   sit top-left, recurrence top-right, and description/link/image run full
   width below, where they actually need it. */
.pce-body--cols { display:grid; grid-template-columns:1fr 1fr; gap:0 20px; align-items:start; }
.pce-body--cols > .pcol, .pce-body--cols > .pce-sec { min-width:0; }
/* .pce-sec draws a top border for stacked blocks. In the multi-column layout the
   uppercase section titles already separate the blocks, so the rules only add
   stray lines across the panel — drop them for every section, spanning ones
   included. They come back below, where the blocks stack into a single column. */
.pce-body--cols > .pce-sec { border-top:none; margin-top:0; padding-top:0; }
.pce-body--cols > .pcol-span,
.pce-body--cols > .scoala-tabs { grid-column:1 / -1; }
/* Row gap is 0, so a spanning section needs its own breathing room now that it
   no longer carries a separating border. */
.pce-body--cols > .pce-sec.pcol-span { margin-top:14px; }
/* Flex items default to min-width:auto, so the image picker's intrinsic width
   would otherwise push the link field narrower than its flex:3 share. */
.row2 > .pce-fld { min-width:0; }
.row2.contentRow .img { flex-wrap:wrap; gap:8px; }
.row2.contentRow .img .thumb { width:38px; height:28px; }
@media (max-width: 900px)  {
  .pce-body--cols { grid-template-columns:1fr; }
  .pce-body--cols > .pce-sec { border-top:1px solid #eee; margin-top:12px; padding-top:11px; }
  .pce-body--cols > .pce-sec:first-of-type { border-top:none; margin-top:0; padding-top:0; }
  .row2.contentRow { flex-wrap:wrap; }
  .row2.contentRow > .pce-fld { flex-basis:45%; }
}
.pce-fld { margin-bottom:11px; }
.pce-fld label { display:block; font-size:10px; color:#888; margin-bottom:3px; text-transform:uppercase; letter-spacing:.05em; }
.pce-fld input, .pce-fld select, .pce-fld textarea { width:100%; padding:6px 8px; border:1px solid #d0d0d0; border-radius:6px; font-size:13px; box-sizing:border-box; font-family:inherit; }
/* align-items is left at its stretch default, so a field that shares a row with
   another one grows to the same height. A checkbox column therefore centres
   itself against the input beside it without a hand-tuned margin. */
.row2 { display:flex; gap:8px; align-items:stretch; }
/* A checkbox standing next to labelled fields. The spacer reproduces the
   label's own box (same font-size and margin), so the control area below it
   starts exactly where the neighbouring inputs start.
   padding-left keeps the design-system checkbox's 44px touch target (an
   invisible ::before centred on the 20px box) off the field to its left. */
.pce-chkfld { display:flex; flex-direction:column; margin-bottom:11px; padding-left:6px; flex-shrink:0; white-space:nowrap; }
.pce-chkfld .lblspacer { display:block; font-size:10px; margin-bottom:3px; }
.pce-chkfld .ctl { flex:1; display:flex; align-items:center; }
/* A checkbox on a line of its own. */
.pce-chk { margin-bottom:11px; }
.pce-sec { border-top:1px solid #eee; margin-top:12px; padding-top:11px; }
.pce-sec .st { font-size:11px; font-weight:700; color:#666; text-transform:uppercase; letter-spacing:.04em; margin-bottom:8px; }
.pce-sec-sep { font-size:11px; font-weight:700; color:#888; text-transform:uppercase; letter-spacing:.04em; margin:8px 0 2px; }
.scoala-tabs { display:flex; border:1px solid #ccc; border-radius:7px; overflow:hidden; margin-bottom:12px; }
.scoala-tabs button { flex:1; font-size:12px; padding:6px 0; border:none; background:#fff; cursor:pointer; }
.scoala-tabs button.on { background:#2138b8; color:#fff; }
.pce-sec .opt { font-weight:400; color:#aaa; text-transform:none; letter-spacing:0; }
.img { display:flex; gap:10px; align-items:center; }
.img .thumb { width:56px; height:42px; border-radius:5px; background:#eef1f8; border:1px solid #d0d0d0; flex-shrink:0; }
.img .up { font-size:12px; color:#2138b8; cursor:pointer; }
.pce-pills { display:flex; gap:5px; }
.pce-pill { width:28px; height:28px; border-radius:50%; border:1px solid #d0d0d0; display:flex; align-items:center; justify-content:center; font-size:11px; color:#555; cursor:pointer; user-select:none; }
.pce-pill.on { background:#2138b8; color:#fff; border-color:#2138b8; font-weight:600; }
.spill { padding:5px 12px; border:1px solid #d0d0d0; border-radius:20px; font-size:12px; color:#555; cursor:pointer; user-select:none; }
.spill.on { background:#2138b8; color:#fff; border-color:#2138b8; }
/* Series date table: one row per generated occurrence, months as grey
   full-width subheaders. Flat and scrollable, not an accordion, so the whole
   season stays one continuous list. */
.dtWrap { position:relative; max-height:340px; overflow-y:auto; border:1px solid #e2e2e2; border-radius:8px; background:#fff; }
.dtTable { width:100%; border-collapse:collapse; font-size:12.5px; }
.dtTable thead th { position:sticky; top:0; z-index:2; text-align:left; font-size:9.5px; letter-spacing:.09em; text-transform:uppercase; color:#888; font-weight:700; padding:7px 10px; background:#f6f7f9; border-bottom:1px solid #e2e2e2; }
.dtTable td { padding:5px 10px; border-bottom:1px solid #f2f3f5; vertical-align:middle; }
.dtTable tr:last-child td { border-bottom:none; }
.dtTable .c-date { width:190px; white-space:nowrap; }
.dtTable .c-state { width:140px; }
.dtSub td { background:#fafbfc; font-weight:700; font-size:10.5px; letter-spacing:.05em; text-transform:uppercase; color:#888; padding:5px 10px; border-bottom:1px solid #eceef1; }
.dtRow.past { color:#a6a9b2; }
.dtRow.past .dtLbl { color:#a6a9b2; }
.dtRow.cur { background:#f4f7ff; }
.dtMuted { color:#9a9da6; }
.dtPick { position:relative; }
.dtBtn { display:flex; align-items:center; gap:7px; width:100%; padding:3px 7px; border:1px solid #d0d0d0; border-radius:5px; background:#fff; font-size:12px; font-family:inherit; color:#333; cursor:pointer; text-align:left; }
.dtLbl { flex:1; }
.dtDot { width:9px; height:9px; border-radius:2px; flex-shrink:0; display:inline-block; }
.dtCar { width:0; height:0; flex-shrink:0; border-left:4px solid transparent; border-right:4px solid transparent; border-top:4px solid #a6a9b2; }
.dtMenu { position:absolute; z-index:5; top:calc(100% + 3px); left:0; min-width:130px; background:#fff; border:1px solid #d0d0d0; border-radius:6px; box-shadow:0 6px 18px rgba(0,0,0,.14); padding:3px; }
.dtOpt { display:flex; align-items:center; gap:8px; width:100%; padding:5px 7px; border:none; border-radius:4px; background:none; font-size:12px; font-family:inherit; color:#333; cursor:pointer; text-align:left; }
.dtOpt:hover { background:#f2f4fb; }
.dtOpt.on { background:#eef2ff; color:#2138b8; font-weight:600; }
.dtNote { width:100%; padding:3px 7px; border:1px solid transparent; border-radius:5px; background:transparent; font-size:12px; font-family:inherit; color:#333; box-sizing:border-box; }
.dtNote:hover { border-color:#e2e2e2; }
.dtNote:focus { border-color:#2138b8; background:#fff; outline:none; }
.exList { display:flex; flex-direction:column; gap:6px; }
.exRow { border:1px solid #e2e2e2; border-radius:8px; overflow:hidden; }
.exSum { display:flex; align-items:center; gap:8px; padding:7px 8px; cursor:pointer; }
.kchip { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.03em; padding:2px 7px; border-radius:20px; flex-shrink:0; }
.kchip.move { color:#2138b8; background:#eef2ff; }
.kchip.cancel { color:#be3330; background:#faf0ef; }
.chg { font-size:12px; flex:1; min-width:0; line-height:1.35; }
.chg .f { color:#999; }
.chg .a { color:#bbb; margin:0 3px; }
.chg .t { color:#222; font-weight:600; }
.exActs { display:flex; gap:6px; flex-shrink:0; align-items:center; }
.exActs .ed { color:#999; cursor:pointer; font-size:12px; }
.exActs .rm { color:#be3330; cursor:pointer; font-size:15px; }
.exEdit { border-top:1px solid #eee; background:#fafafa; padding:11px 9px; display:flex; flex-direction:column; gap:9px; }
.exEdit .kt { display:flex; gap:6px; }
.exEdit .darr { align-self:center; color:#2138b8; font-size:14px; line-height:1; margin:-2px 0; }
.addlink { font-size:12px; color:#2138b8; cursor:pointer; display:inline-block; margin-top:2px; }
.pce-err { margin:0 15px 12px; padding:9px 11px; border:1px solid #e2c4c4; border-left:3px solid #be3330; border-radius:6px; background:#faf0ef; color:#8f2723; font-size:12px; line-height:1.45; }
.pce-pa { flex-shrink:0; display:flex; align-items:center; gap:10px; margin:0; padding:14px 15px; border-top:1px solid #e0e0e0; background:#fafafa; border-radius:0 0 10px 10px; }
.pce-pa .btn-save { order:2; margin-left:auto; box-sizing:border-box; background:#2138b8; color:#fff; border:none; border-radius:8px; padding:11px 28px; font-size:14px; font-weight:700; cursor:pointer; }
.pce-pa .btn-save:disabled { opacity:.45; cursor:default; }
.pce-pa .btn-del { order:1; box-sizing:border-box; background:#fff; color:#be3330; border:1px solid #e2c4c4; border-radius:8px; padding:10px 18px; font-size:13px; cursor:pointer; }
.btn-save { background:#2138b8; color:#fff; border:none; padding:7px 16px; border-radius:6px; font-size:13px; cursor:pointer; }
.btn-save:disabled { opacity:.5; cursor:default; }
.btn-del { background:#fff; color:#be3330; border:1px solid #e6b8b6; padding:7px 12px; border-radius:6px; font-size:13px; cursor:pointer; }
`;
