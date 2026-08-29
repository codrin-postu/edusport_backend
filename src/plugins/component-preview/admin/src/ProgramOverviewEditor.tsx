import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { MediaPicker } from './components/MediaPicker';

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
  { key: 'scoala', label: 'Școala de patinaj', color: '#be3330' },
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
const WD: Array<[string, string]> = [['mon', 'L'], ['tue', 'M'], ['wed', 'Mi'], ['thu', 'J'], ['fri', 'V'], ['sat', 'S'], ['sun', 'D']];

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
  startTime: string; endTime: string; singleDate: string; endDate: string; seasonStart: string; seasonEnd: string;
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
const toTime = (v: string) => (v ? `${v}:00.000` : null);

function emptyForm(date?: string): FormState {
  return {
    documentId: null, title: '', type: 'curs', label: '', color: '',
    description: '', imageUrl: '', linkUrl: '', linkLabel: '',
    freq: 'weekly', days: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false },
    weekOfMonth: 'first', allDay: false, startTime: '', endTime: '', singleDate: date ?? '', endDate: '', seasonStart: '', seasonEnd: '',
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
  const [dirty, setDirty] = React.useState(false);
  const [expEx, setExpEx] = React.useState<number | null>(null);
  const [mediaOpen, setMediaOpen] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);
  // For a Școala occurrence: edit just this date's state, or the whole series.
  const [scoalaView, setScoalaView] = React.useState<'date' | 'series'>('date');

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

  const openCreate = (date?: string) => { setDirty(true); setScoalaView('date'); setForm(emptyForm(date)); };

  const openEdit = async (documentId?: string, clickedDate?: string) => {
    if (!documentId) return;
    setDirty(false);
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
        startTime: hhmm(r.startTime), endTime: hhmm(r.endTime), singleDate: r.singleDate ?? '', endDate: r.endDate ?? '',
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
      return;
    }
    setSaving(true);
    try {
      const body = buildBody(f);
      if (f.documentId) await put(`${CM_EVENT}/${f.documentId}`, body);
      else await post(CM_EVENT, body);
      setForm(null);
      setDirty(false);
      setReloadKey((k) => k + 1);
    } catch (err) { /* keep panel open on error */ }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!form?.documentId) { setForm(null); return; }
    setSaving(true);
    try { await del(`${CM_EVENT}/${form.documentId}`); setForm(null); setReloadKey((k) => k + 1); }
    catch (err) { /* ignore */ } finally { setSaving(false); }
  };

  const upd = (patch: Partial<FormState>) => { setDirty(true); setForm((f) => (f ? { ...f, ...patch } : f)); };

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

        {/* PANEL */}
        {form && (
          <div className="pce-panel">
            <div className="ph"><h4>{form.scoalaDate ? (form.title || 'Eveniment') : form.documentId ? 'Editează eveniment' : 'Adaugă eveniment'}</h4><span className="x" onClick={() => setForm(null)}>×</span></div>
            <div className="pce-body">
            {form.scoalaDate && (
              <>
                <div className="scoala-tabs">
                  <button className={scoalaView === 'date' ? 'on' : ''} onClick={() => setScoalaView('date')}>Această dată</button>
                  <button className={scoalaView === 'series' ? 'on' : ''} onClick={() => setScoalaView('series')}>Toată seria</button>
                </div>
                {scoalaView === 'date' && (
                  <>
                    <div className="fld"><label>Data</label><input value={form.scoalaDate ?? ''} disabled /></div>
                    {form.type === 'scoala' ? (
                      <>
                        <div className="fld"><label>Stare</label>
                          <div className="pills">
                            {SCOALA_STATES.map((s) => (
                              <span key={s.key} className="spill" onClick={() => upd({ scoalaState: s.key })} style={form.scoalaState === s.key ? { background: s.color, borderColor: s.color, color: '#fff' } : undefined}>{s.label}</span>
                            ))}
                          </div>
                        </div>
                        {form.scoalaState !== 'curs' && (
                          <div className="fld"><label>Notă / motiv (opțional)</label><input value={form.scoalaNote} onChange={(e) => upd({ scoalaNote: e.target.value })} placeholder="ex. Vacanță de Crăciun" /></div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="fld"><label>Pentru această dată</label>
                          <div className="pills">
                            <span className={`spill${form.occMode === 'cancel' ? ' on' : ''}`} onClick={() => upd({ occMode: form.occMode === 'cancel' ? 'keep' : 'cancel' })}>Anulat</span>
                            <span className={`spill${form.occMode === 'override' ? ' on' : ''}`} onClick={() => upd({ occMode: form.occMode === 'override' ? 'keep' : 'override' })}>Modifică</span>
                          </div>
                        </div>
                        {form.occMode === 'override' && (
                          <>
                            <div className="fld"><label>Dată</label><input type="date" value={form.occNewDate || form.scoalaDate || ''} onChange={(e) => upd({ occNewDate: e.target.value })} /></div>
                            <div className="row2">
                              <div className="fld"><label>Început</label><input type="time" value={form.occNewStart} onChange={(e) => upd({ occNewStart: e.target.value })} /></div>
                              <div className="fld"><label>Sfârșit</label><input type="time" value={form.occNewEnd} onChange={(e) => upd({ occNewEnd: e.target.value })} /></div>
                            </div>
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
            <div className="fld"><label>Titlu</label><input value={form.title} onChange={(e) => upd({ title: e.target.value })} /></div>
            <div className="fld"><label>Categorie</label>
              <select value={form.type} onChange={(e) => upd({ type: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div className="fld"><label>Etichetă (ex. Grupa A)</label><input value={form.label} onChange={(e) => upd({ label: e.target.value })} /></div>
            <label className="chk"><input type="checkbox" checked={form.allDay} onChange={(e) => upd({ allDay: e.target.checked })} /> Toată ziua</label>
            {!form.allDay && (
              <div className="row2">
                <div className="fld"><label>Început</label><input type="time" value={form.startTime} onChange={(e) => upd({ startTime: e.target.value })} /></div>
                <div className="fld"><label>Sfârșit</label><input type="time" value={form.endTime} onChange={(e) => upd({ endTime: e.target.value })} /></div>
              </div>
            )}

            <div className="sec">
              <div className="st">Detalii <span className="opt">opțional</span></div>
              <div className="fld"><label>Descriere</label><textarea rows={2} value={form.description} onChange={(e) => upd({ description: e.target.value })} /></div>
              <div className="fld"><label>Imagine</label>
                <div className="img">
                  <div className="thumb" style={form.imageUrl ? { backgroundImage: `url(${form.imageUrl})`, backgroundSize: 'cover' } : {}} />
                  <span className="up" onClick={() => setMediaOpen(true)}>{form.imageUrl ? 'schimbă imaginea' : 'alege imagine'}</span>
                  {form.imageUrl && <span className="up" style={{ color: '#be3330' }} onClick={() => upd({ imageUrl: '' })}>elimină</span>}
                </div>
              </div>
              <div className="row2">
                <div className="fld" style={{ flex: 2 }}><label>Link</label><input value={form.linkUrl} onChange={(e) => upd({ linkUrl: e.target.value })} /></div>
                <div className="fld" style={{ flex: 1 }}><label>Etichetă link</label><input value={form.linkLabel} onChange={(e) => upd({ linkLabel: e.target.value })} /></div>
              </div>
            </div>

            <div className="sec">
              <div className="st">Recurență</div>
              <div className="fld">
                <select value={form.freq} onChange={(e) => upd({ freq: e.target.value })}>
                  <option value="weekly">Săptămânal</option>
                  <option value="biweekly">La 2 săptămâni</option>
                  <option value="monthly">Lunar</option>
                  <option value="none">Nu se repetă (o dată)</option>
                </select>
              </div>
              {form.freq === 'none' ? (
                <div className="row2">
                  <div className="fld"><label>Data</label><input type="date" value={form.singleDate} onChange={(e) => upd({ singleDate: e.target.value })} /></div>
                  <div className="fld"><label>până la (opțional)</label><input type="date" value={form.endDate} onChange={(e) => upd({ endDate: e.target.value })} /></div>
                </div>
              ) : (
                <>
                  <div className="fld"><label>Zile</label>
                    <div className="pills">
                      {WD.map(([k, lbl]) => (
                        <span key={k} className={`pill${form.days[k] ? ' on' : ''}`} onClick={() => upd({ days: { ...form.days, [k]: !form.days[k] } })}>{lbl}</span>
                      ))}
                    </div>
                  </div>
                  {form.freq === 'monthly' && (
                    <div className="fld"><label>Săptămâna din lună</label>
                      <select value={form.weekOfMonth} onChange={(e) => upd({ weekOfMonth: e.target.value })}>
                        <option value="first">Prima</option><option value="second">A doua</option><option value="third">A treia</option><option value="fourth">A patra</option><option value="last">Ultima</option>
                      </select>
                    </div>
                  )}
                  {form.type === 'scoala' && (
                    <div className="row2">
                      <div className="fld"><label>Sezon de la</label><input type="date" value={form.seasonStart} onChange={(e) => upd({ seasonStart: e.target.value })} /></div>
                      <div className="fld"><label>până la</label><input type="date" value={form.seasonEnd} onChange={(e) => upd({ seasonEnd: e.target.value })} /></div>
                    </div>
                  )}
                </>
              )}
            </div>
            </>
            )}

            {(!form.scoalaDate || scoalaView === 'series') && form.freq !== 'none' && form.type !== 'scoala' && (
            <div className="sec">
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
                          <div className="fld" style={{ margin: 0 }}><label>Data</label><input type="date" value={x.date} onChange={(e) => patch({ date: e.target.value })} /></div>
                          {isMove && (
                            <>
                              <span className="darr">↓</span>
                              <div className="fld" style={{ margin: 0 }}><label>Data nouă</label><input type="date" value={x.newDate || x.date} onChange={(e) => patch({ newDate: e.target.value })} /></div>
                              <div className="row2">
                                <div className="fld" style={{ margin: 0 }}><label>Început</label><input type="time" value={nStart} onChange={(e) => patch({ newStartTime: e.target.value })} /></div>
                                <div className="fld" style={{ margin: 0 }}><label>Sfârșit</label><input type="time" value={nEnd} onChange={(e) => patch({ newEndTime: e.target.value })} /></div>
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

            <div className="pa">
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
      </div>

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
.pce-panel { width:320px; flex-shrink:0; align-self:flex-start; position:sticky; top:12px; max-height:calc(100vh - 200px); display:flex; flex-direction:column; border:1px solid #dcdcdc; border-radius:10px; background:#fff; box-shadow:0 6px 24px rgba(0,0,0,.08); overflow:hidden; }
.pce-panel .ph { flex-shrink:0; background:#fff; display:flex; justify-content:space-between; align-items:center; padding:14px 15px; border-bottom:1px solid #eee; }
.pce-panel .ph h4 { margin:0; font-size:15px; }
.pce-panel .x { color:#999; cursor:pointer; font-size:20px; line-height:1; }
.pce-body { flex:1 1 auto; min-height:0; overflow-y:auto; padding:15px; }
.fld { margin-bottom:11px; }
.fld label { display:block; font-size:10px; color:#888; margin-bottom:3px; text-transform:uppercase; letter-spacing:.05em; }
.fld input, .fld select, .fld textarea { width:100%; padding:6px 8px; border:1px solid #d0d0d0; border-radius:6px; font-size:13px; box-sizing:border-box; font-family:inherit; }
.row2 { display:flex; gap:8px; }
.chk { display:flex; align-items:center; gap:7px; font-size:13px; color:#333; margin-bottom:11px; cursor:pointer; user-select:none; }
.chk input { width:auto; margin:0; }
.sec { border-top:1px solid #eee; margin-top:12px; padding-top:11px; }
.sec .st { font-size:11px; font-weight:700; color:#666; text-transform:uppercase; letter-spacing:.04em; margin-bottom:8px; }
.sec-sep { font-size:11px; font-weight:700; color:#888; text-transform:uppercase; letter-spacing:.04em; margin:8px 0 2px; }
.scoala-tabs { display:flex; border:1px solid #ccc; border-radius:7px; overflow:hidden; margin-bottom:12px; }
.scoala-tabs button { flex:1; font-size:12px; padding:6px 0; border:none; background:#fff; cursor:pointer; }
.scoala-tabs button.on { background:#2138b8; color:#fff; }
.sec .opt { font-weight:400; color:#aaa; text-transform:none; letter-spacing:0; }
.img { display:flex; gap:10px; align-items:center; }
.img .thumb { width:56px; height:42px; border-radius:5px; background:#eef1f8; border:1px solid #d0d0d0; flex-shrink:0; }
.img .up { font-size:12px; color:#2138b8; cursor:pointer; }
.pills { display:flex; gap:5px; }
.pill { width:28px; height:28px; border-radius:50%; border:1px solid #d0d0d0; display:flex; align-items:center; justify-content:center; font-size:11px; color:#555; cursor:pointer; user-select:none; }
.pill.on { background:#2138b8; color:#fff; border-color:#2138b8; font-weight:600; }
.spill { padding:5px 12px; border:1px solid #d0d0d0; border-radius:20px; font-size:12px; color:#555; cursor:pointer; user-select:none; }
.spill.on { background:#2138b8; color:#fff; border-color:#2138b8; }
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
.pa { flex-shrink:0; display:block; margin:0; padding:14px 15px; border-top:1px solid #e0e0e0; background:#fafafa; border-radius:0 0 10px 10px; }
.pa .btn-save { display:block; width:100%; box-sizing:border-box; background:#2138b8; color:#fff; border:none; border-radius:8px; padding:12px; font-size:15px; font-weight:700; cursor:pointer; }
.pa .btn-save:disabled { opacity:.45; cursor:default; }
.pa .btn-del { display:block; width:100%; box-sizing:border-box; margin-top:8px; background:#fff; color:#be3330; border:1px solid #e2c4c4; border-radius:8px; padding:10px; font-size:13px; cursor:pointer; }
.btn-save { background:#2138b8; color:#fff; border:none; padding:7px 16px; border-radius:6px; font-size:13px; cursor:pointer; }
.btn-save:disabled { opacity:.5; cursor:default; }
.btn-del { background:#fff; color:#be3330; border:1px solid #e6b8b6; padding:7px 12px; border-radius:6px; font-size:13px; cursor:pointer; }
`;
