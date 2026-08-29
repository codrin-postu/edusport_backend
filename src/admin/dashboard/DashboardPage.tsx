import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { INSCRIERI_TO, MESAJE_TO } from './menu';

/**
 * EduSport admin dashboard page (Direction A).
 *
 * Registered as an admin route via app.addMenuLink({ Component }) so it renders
 * INSIDE Strapi's providers (hooks + real data). Layout: navy greeting band,
 * KPI tiles, a generic "Ce e nou" form-intake feed, a Season/registration card,
 * upcoming events with category filters, plus analytics (Umami) and site
 * health (GlitchTip) cards that degrade to a clean "not connected" state until
 * their backend proxies + credentials exist.
 *
 * Every figure is real; a metric with no source is omitted, never invented.
 */

// Event colours mirror CATEGORIES in ProgramOverviewEditor.tsx exactly.
const CATEGORY_COLOR: Record<string, string> = {
  curs: '#2138b8', scoala: '#be3330', concurs: '#7a1fa2', cantonament: '#1f7a4d',
  spectacol: '#00838f', eveniment: '#e08a00', vacanta: '#0891b2', sarbatoare: '#c026d3', liber: '#8a8a8a',
};
const CATEGORY_LABEL: Record<string, string> = {
  curs: 'Antrenament', scoala: 'Școala de patinaj', concurs: 'Competiție', cantonament: 'Cantonament',
  spectacol: 'Spectacol', eveniment: 'Eveniment', vacanta: 'Vacanță', sarbatoare: 'Sărbătoare', liber: 'Pauză',
};

// Upcoming-events filter chips. `types` empty = all.
const FILTERS: Array<{ key: string; label: string; types: string[] }> = [
  { key: 'all', label: 'Toate', types: [] },
  { key: 'antr', label: 'Antrenamente', types: ['curs'] },
  { key: 'scoala', label: 'Școala', types: ['scoala'] },
  { key: 'comp', label: 'Competiții', types: ['concurs'] },
  { key: 'alt', label: 'Altele', types: ['cantonament', 'spectacol', 'eveniment', 'vacanta', 'sarbatoare', 'liber'] },
];

const RO_MON_SHORT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
const RO_MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
const RO_DOW = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

interface Occurrence {
  title: string; type: string; label: string | null; color: string | null;
  date: string; startTime: string | null; endTime: string | null; status?: string; state?: string;
}
interface AnalyticsData { connected: boolean; visitors?: number; trendPct?: number; series?: number[] }
interface HealthData { connected: boolean; errors24h?: number }

const SITE_SETTINGS_UID = 'api::site-settings.site-settings';

const CSS = `
.esdp { font-family: system-ui, -apple-system, sans-serif; color: #1b1d26; background: #f6f7f9; min-height: 100%; padding: 16px 20px 40px; box-sizing: border-box; }
.esdp * { box-sizing: border-box; }
.num { font-variant-numeric: tabular-nums; }

.a-hero { background: linear-gradient(120deg, #0e1a3c, #182a5e); color: #fff; border-radius: 12px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 14px; }
.a-hero h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -.01em; }
.a-hero h1 span { color: #9fb0ff; }
.a-hero .date { margin: 4px 0 0; font-size: 12.5px; color: #aeb7d4; text-transform: capitalize; }
.a-hero .next { margin-top: 8px; font-size: 12px; color: #aeb7d4; }
.a-hero .next b { color: #fff; }
.a-pill { font-size: 11px; font-weight: 700; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.18); border-radius: 20px; padding: 5px 11px; color: #dfe4f5; white-space: nowrap; flex-shrink: 0; }

.a-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 14px; }
.a-kpi { background: #fff; border: 1px solid #e6e7ec; border-radius: 11px; padding: 12px 14px; border-left: 3px solid #2138b8; }
.a-kpi .k { font-size: 10px; letter-spacing: .05em; text-transform: uppercase; color: #8a8d99; font-weight: 700; }
.a-kpi .v { font-size: 26px; font-weight: 800; letter-spacing: -.02em; line-height: 1.1; margin-top: 4px; }
.a-kpi .c { font-size: 11px; color: #5a5e6b; margin-top: 2px; }
@media (max-width: 900px) { .a-kpis { grid-template-columns: repeat(2, 1fr); } }

.feed { background: #fff; border: 1px solid #e6e7ec; border-radius: 12px; padding: 5px 6px 7px; margin-bottom: 14px; }
.feed-h { display: flex; align-items: center; justify-content: space-between; padding: 11px 12px 8px; }
.feed-h .t { font-size: 11px; letter-spacing: .05em; text-transform: uppercase; color: #666; font-weight: 700; }
.feed-h .tot { background: #be3330; color: #fff; font-size: 11px; font-weight: 800; border-radius: 20px; padding: 3px 10px; }
.feed-rows { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 6px; }
.frow { display: flex; align-items: center; gap: 11px; padding: 10px 11px; border-radius: 9px; border: 1px solid #f0f1f4; background: #fff; cursor: pointer; text-align: left; font-family: inherit; color: inherit; width: 100%; }
.frow:hover { background: #fafbff; border-color: #dfe3f0; }
.frow .tile { width: 32px; height: 32px; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; color: #fff; flex-shrink: 0; }
.frow .bd { flex: 1; min-width: 0; }
.frow .bd b { font-size: 13px; font-weight: 700; display: block; line-height: 1.25; }
.frow .bd small { font-size: 11px; color: #8a8d99; }
.frow .arr { color: #c0c4cf; font-size: 16px; }
.feed-empty { display: flex; align-items: center; gap: 10px; padding: 14px 12px; color: #5a5e6b; font-size: 13px; }
.feed-empty .ok { width: 24px; height: 24px; border-radius: 50%; background: #e7f3ec; color: #1f7a4d; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; }

.a-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 14px; align-items: start; }
.a-col { display: flex; flex-direction: column; gap: 14px; }
@media (max-width: 900px) { .a-grid { grid-template-columns: 1fr; } }
.card { background: #fff; border: 1px solid #e6e7ec; border-radius: 12px; padding: 14px 16px; }
.card h2 { font-size: 11px; letter-spacing: .05em; text-transform: uppercase; color: #666; font-weight: 700; margin: 0; }
.card-hrow { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.card-hrow button.link { font-size: 11.5px; font-weight: 600; color: #2138b8; background: none; border: none; cursor: pointer; font-family: inherit; }
.subhead { font-size: 11px; color: #8a8d99; margin: 0 0 10px; }

/* season + registration */
.seas-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 0 12px; }
.seas-row .l b { font-size: 13.5px; font-weight: 700; display: block; }
.seas-row .l small { font-size: 11px; }
.seas-row .l small.on { color: #1f7a4d; } .seas-row .l small.off { color: #8a8d99; }
.stpill { font-size: 10px; font-weight: 800; border-radius: 20px; padding: 3px 10px; letter-spacing: .02em; }
.stpill.on { color: #1f7a4d; background: #e7f3ec; } .stpill.off { color: #a83a38; background: #faeceb; }
.tgl { width: 38px; height: 21px; border-radius: 20px; position: relative; border: none; cursor: pointer; padding: 0; transition: background .15s; }
.tgl.on { background: #1f7a4d; } .tgl.off { background: #c8ccd6; }
.tgl i { position: absolute; top: 2px; width: 17px; height: 17px; border-radius: 50%; background: #fff; transition: left .15s; }
.tgl.on i { left: 19px; } .tgl.off i { left: 2px; }
.tgl:disabled { opacity: .6; cursor: default; }
.seas-links { display: flex; flex-direction: column; border-top: 1px solid #f0f0f2; }
.seas-links button { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; font-size: 12.5px; color: #1b1d26; background: none; border: none; border-bottom: 1px solid #f6f7f9; cursor: pointer; font-family: inherit; text-align: left; }
.seas-links button:last-child { border-bottom: none; }
.seas-links button .ar { color: #c0c4cf; }

/* filter chips */
.chips { display: flex; gap: 6px; flex-wrap: wrap; margin: 2px 0 10px; }
.chip { font-size: 11px; padding: 4px 10px; border: 1px solid #d8dae2; border-radius: 20px; color: #5a5e6b; background: #fff; cursor: pointer; font-family: inherit; }
.chip.on { background: #2138b8; color: #fff; border-color: #2138b8; font-weight: 600; }

.ev { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-top: 1px solid #f0f0f2; }
.ev:first-of-type { border-top: none; }
.ev .dt { font-size: 11px; color: #8a8d99; width: 54px; flex-shrink: 0; font-weight: 600; }
.ev .bd { width: 3px; align-self: stretch; min-height: 26px; border-radius: 3px; flex-shrink: 0; }
.ev .tx { min-width: 0; }
.ev .tx b { font-weight: 600; font-size: 13px; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ev .tx small { font-size: 11.5px; color: #8a8d99; }
.ev.off .tx b { color: #9a9a9a; text-decoration: line-through; }
.empty { color: #8a8d99; font-size: 13px; font-style: italic; padding: 8px 0; }

/* analytics (Umami) */
.analytics { background: #0e1a3c; border: 1px solid #0e1a3c; border-radius: 12px; padding: 14px 16px; color: #eef1fb; }
.analytics h2 { color: #8b93ad; }
.analytics .stat { display: flex; align-items: baseline; gap: 8px; margin: 8px 0 2px; }
.analytics .stat b { font-size: 22px; font-weight: 800; }
.analytics .stat .tr { font-size: 11px; } .analytics .stat .tr.up { color: #7fd6a0; } .analytics .stat .tr.dn { color: #e79a98; }
.analytics .spark { height: 34px; margin: 8px 0 10px; }
.analytics .spark svg { width: 100%; height: 100%; display: block; }
.analytics .go { font-size: 11.5px; font-weight: 600; background: #2138b8; color: #fff; border: none; border-radius: 7px; padding: 7px 12px; cursor: pointer; font-family: inherit; }
.analytics .soon { font-size: 12px; color: #aab2c9; background: rgba(255,255,255,.05); border: 1px dashed rgba(255,255,255,.18); border-radius: 8px; padding: 10px 12px; margin-top: 8px; }

/* site health (glitchtip) */
.health .hstat { display: flex; align-items: center; gap: 11px; margin: 9px 0 4px; }
.health .hnum { font-size: 28px; font-weight: 800; letter-spacing: -.02em; line-height: 1; }
.health .hnum.ok { color: #1f7a4d; } .health .hnum.bad { color: #be3330; }
.health .hlbl b { font-size: 12.5px; font-weight: 700; display: block; }
.health .hlbl small { font-size: 11px; color: #8a8d99; }
.health .hbadge { margin-left: auto; font-size: 10px; font-weight: 800; border-radius: 20px; padding: 3px 9px; }
.health .hbadge.ok { color: #1f7a4d; background: #e7f3ec; } .health .hbadge.bad { color: #be3330; background: #faeceb; }
.health .soon { font-size: 12px; color: #8a8d99; background: #f3f4f7; border: 1px dashed #d3d6de; border-radius: 8px; padding: 10px 12px; margin: 8px 0; }
.health a.hlink { font-size: 11.5px; font-weight: 600; color: #2138b8; text-decoration: none; cursor: pointer; }

.qa { display: flex; flex-direction: column; gap: 8px; margin-top: 11px; }
.qa button { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid #e6e7ec; border-radius: 9px; font-size: 13px; background: #fff; color: #1b1d26; cursor: pointer; text-align: left; width: 100%; font-family: inherit; }
.qa button:hover { border-color: #c3c8d4; background: #fafbff; }
.qa button.pri { background: #2138b8; color: #fff; border-color: #2138b8; }
.qa button.pri:hover { background: #1b2fa0; }
.qa .i { width: 24px; height: 24px; border-radius: 7px; background: #eef1fb; color: #2138b8; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; flex-shrink: 0; }
.qa button.pri .i { background: rgba(255,255,255,.18); color: #fff; }
`;

export default function DashboardPage() {
  const { get, put } = useFetchClient();
  const navigate = useNavigate();

  const today = React.useMemo(() => new Date(), []);
  const todayStr = ymd(today);

  const [name, setName] = React.useState<string | null>(null);
  const [kpis, setKpis] = React.useState<Array<{ k: string; v: number; c?: string }>>([]);
  const [monthTypes, setMonthTypes] = React.useState<Record<string, number> | null>(null);
  const [events, setEvents] = React.useState<Occurrence[] | null>(null);
  const [eventsError, setEventsError] = React.useState(false);
  const [filter, setFilter] = React.useState('all');
  const [nextEv, setNextEv] = React.useState<Occurrence | null>(null);

  const [newContacts, setNewContacts] = React.useState<number | null>(null);
  const [newInscrieri, setNewInscrieri] = React.useState<number | null>(null);
  const [reg, setReg] = React.useState<{ open: boolean; raw: Record<string, unknown> } | null>(null);
  const [regSaving, setRegSaving] = React.useState(false);

  const [analytics, setAnalytics] = React.useState<AnalyticsData | null>(null);
  const [health, setHealth] = React.useState<HealthData | null>(null);

  // --- greeting name
  React.useEffect(() => {
    let off = false;
    get('/admin/users/me')
      .then((r: any) => { if (!off) setName(((r?.data?.data ?? r?.data)?.firstname as string) || null); })
      .catch(() => {});
    return () => { off = true; };
  }, [get]);

  // --- KPIs + monthly breakdown
  React.useEffect(() => {
    let off = false;
    const year = today.getFullYear();
    const count = async (uid: string, params: Record<string, unknown> = {}): Promise<number | null> => {
      try {
        const r: any = await get(`/content-manager/collection-types/${uid}`, { params: { page: 1, pageSize: 1, ...params } });
        const t = r?.data?.pagination?.total;
        return typeof t === 'number' ? t : null;
      } catch { return null; }
    };
    const monthEvents = async (): Promise<{ total: number; byType: Record<string, number> } | null> => {
      try {
        const first = new Date(year, today.getMonth(), 1);
        const last = new Date(year, today.getMonth() + 1, 0);
        const r: any = await get(`/api/calendar/occurrences?from=${ymd(first)}&to=${ymd(last)}`);
        const data = r?.data?.data;
        if (!Array.isArray(data)) return null;
        const byType: Record<string, number> = {};
        for (const o of data as Occurrence[]) byType[o.type] = (byType[o.type] ?? 0) + 1;
        return { total: data.length, byType };
      } catch { return null; }
    };

    Promise.all([
      count('api::sportsperson.sportsperson'),
      count('api::team-member.team-member'),
      count('api::competition.competition', {
        'filters[date][$gte]': `${year}-01-01`,
        'filters[date][$lte]': `${year}-12-31`,
      }),
      monthEvents(),
      count('api::contact-submission.contact-submission', { 'filters[triageStatus][$eq]': 'new' }),
    ]).then(([sportivi, membri, competitii, month, contactsNew]) => {
      if (off) return;
      const out: Array<{ k: string; v: number; c?: string }> = [];
      if (sportivi != null) out.push({ k: 'Sportivi', v: sportivi });
      if (membri != null) out.push({ k: 'Membri echipă', v: membri });
      if (competitii != null) out.push({ k: 'Competiții', v: competitii, c: `în ${year}` });
      if (month != null) {
        const antr = month.byType['curs'] ?? 0;
        out.push({ k: 'Evenimente luna aceasta', v: month.total, c: antr > 0 ? `din care ${antr} antrenamente` : undefined });
        setMonthTypes(month.byType);
      }
      setKpis(out);
      if (contactsNew != null) setNewContacts(contactsNew);
    });
    return () => { off = true; };
  }, [get, today]);

  // --- upcoming events (next 30 days)
  React.useEffect(() => {
    let off = false;
    const to = new Date(today.getTime()); to.setDate(to.getDate() + 30);
    get(`/api/calendar/occurrences?from=${todayStr}&to=${ymd(to)}`)
      .then((r: any) => {
        if (off) return;
        const data = r?.data?.data;
        if (!Array.isArray(data)) { setEventsError(true); return; }
        const sorted = (data as Occurrence[])
          .filter((o) => o.date >= todayStr)
          .sort((a, b) => (a.date === b.date ? (a.startTime || '').localeCompare(b.startTime || '') : a.date.localeCompare(b.date)));
        setEvents(sorted);
        setNextEv(sorted[0] ?? null);
      })
      .catch(() => { if (!off) setEventsError(true); });
    return () => { off = true; };
  }, [get, today, todayStr]);

  // --- new registrations count (active season, non-archived, status Nou)
  React.useEffect(() => {
    let off = false;
    get('/api/forms/inscrieri', { params: { page: 1, pageSize: 1, filters: JSON.stringify([{ col: 'status', op: 'equals', val: 'Nou' }]) } })
      .then((r: any) => { if (!off) setNewInscrieri(typeof r?.data?.pagination?.total === 'number' ? r.data.pagination.total : null); })
      .catch(() => { if (!off) setNewInscrieri(null); });
    return () => { off = true; };
  }, [get]);

  // --- registration (season) state
  React.useEffect(() => {
    let off = false;
    get(`/content-manager/single-types/${SITE_SETTINGS_UID}`)
      .then((r: any) => {
        if (off) return;
        const entry = r?.data?.data ?? r?.data;
        const raw = (entry?.registration ?? {}) as Record<string, unknown>;
        setReg({ open: Boolean(raw.open), raw });
      })
      .catch(() => {});
    return () => { off = true; };
  }, [get]);

  // --- analytics (Umami proxy) — graceful "not connected"
  React.useEffect(() => {
    let off = false;
    get('/api/analytics/summary')
      .then((r: any) => { if (!off) setAnalytics(r?.data?.connected ? r.data : { connected: false }); })
      .catch(() => { if (!off) setAnalytics({ connected: false }); });
    return () => { off = true; };
  }, [get]);

  // --- site health (GlitchTip proxy) — graceful "not connected"
  React.useEffect(() => {
    let off = false;
    get('/api/site-health/summary')
      .then((r: any) => { if (!off) setHealth(r?.data?.connected ? r.data : { connected: false }); })
      .catch(() => { if (!off) setHealth({ connected: false }); });
    return () => { off = true; };
  }, [get]);

  const toggleReg = async () => {
    if (!reg || regSaving) return;
    const nextOpen = !reg.open;
    setReg({ ...reg, open: nextOpen });
    setRegSaving(true);
    try {
      await put(`/content-manager/single-types/${SITE_SETTINGS_UID}`, { registration: { ...reg.raw, open: nextOpen } });
      setReg((c) => (c ? { open: nextOpen, raw: { ...c.raw, open: nextOpen } } : c));
    } catch {
      setReg((c) => (c ? { ...c, open: !nextOpen } : c)); // revert
    } finally {
      setRegSaving(false);
    }
  };

  // date helpers
  const dateLine = `${RO_DOW[today.getDay()]}, ${today.getDate()} ${RO_MONTHS[today.getMonth()]} ${today.getFullYear()}`;
  const tomorrow = new Date(today.getTime()); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = ymd(tomorrow);
  const dtLabel = (date: string) => {
    if (date === todayStr) return 'Azi';
    if (date === tomorrowStr) return 'Mâine';
    const p = date.split('-');
    return `${Number(p[2])} ${RO_MON_SHORT[Number(p[1]) - 1]}`;
  };
  const colorOf = (o: Occurrence) => (o.type === 'scoala' ? CATEGORY_COLOR.scoala : (o.color || CATEGORY_COLOR[o.type] || '#2138b8'));
  const isOff = (o: Occurrence) => o.status === 'cancelled' || o.state === 'anulat' || o.state === 'liber';
  const evTitle = (o: Occurrence) => (o.type === 'scoala' ? 'Școala de patinaj' : (o.title || o.label || 'Eveniment'));

  const activeTypes = FILTERS.find((f) => f.key === filter)?.types ?? [];
  const shownEvents = (events ?? []).filter((o) => activeTypes.length === 0 || activeTypes.includes(o.type)).slice(0, 6);

  const nextLabel = nextEv
    ? `${dtLabel(nextEv.date).toLowerCase()} ${nextEv.startTime ? `${nextEv.startTime}, ` : ''}${evTitle(nextEv)}`
    : null;

  const quickActions = [
    { label: 'Adaugă eveniment în calendar', to: '/content-manager/single-types/api::program.program', ic: '+', primary: true },
    { label: 'Adaugă sportiv', to: '/content-manager/collection-types/api::sportsperson.sportsperson/create', ic: 'S' },
    { label: 'Adaugă articol', to: '/content-manager/collection-types/api::article.article/create', ic: 'A' },
  ];

  return (
    <div className="esdp">
      <style>{CSS}</style>

      {/* HERO */}
      <div className="a-hero">
        <div>
          <h1>Bună{name ? <>, <span>{name}</span></> : null}. Iată ce urmează la club.</h1>
          <p className="date">{dateLine}</p>
          {nextLabel && <div className="next">Următorul eveniment: <b>{nextLabel}</b></div>}
        </div>
        <span className="a-pill">Sezon {today.getMonth() >= 7 ? `${today.getFullYear()} / ${today.getFullYear() + 1}` : `${today.getFullYear() - 1} / ${today.getFullYear()}`}</span>
      </div>

      {/* KPIs */}
      {kpis.length > 0 && (
        <div className="a-kpis">
          {kpis.map((s) => (
            <div key={s.k} className="a-kpi">
              <div className="k">{s.k}</div>
              <div className="v num">{s.v}</div>
              {s.c && <div className="c">{s.c}</div>}
            </div>
          ))}
        </div>
      )}

      {/* CE E NOU feed */}
      {(() => {
        const feedItems = [
          newInscrieri && newInscrieri > 0
            ? { key: 'insc', n: newInscrieri, color: '#1f7a4d', tile: 'Î', to: INSCRIERI_TO,
                label: newInscrieri === 1 ? 'înscriere nouă' : 'înscrieri noi', sub: 'pe Înscrieri' }
            : null,
          newContacts && newContacts > 0
            ? { key: 'msg', n: newContacts, color: '#2138b8', tile: 'M', to: MESAJE_TO,
                label: newContacts === 1 ? 'mesaj de contact nou' : 'mesaje de contact noi', sub: 'pe Mesaje contact' }
            : null,
        ].filter(Boolean) as Array<{ key: string; n: number; color: string; tile: string; to: string; label: string; sub: string }>;
        const totalNew = feedItems.reduce((s, it) => s + it.n, 0);
        return (
          <div className="feed">
            <div className="feed-h">
              <span className="t">Ce e nou</span>
              {totalNew > 0 && <span className="tot num">{totalNew} de rezolvat</span>}
            </div>
            {feedItems.length > 0 ? (
              <div className="feed-rows">
                {feedItems.map((it) => (
                  <button key={it.key} className="frow" type="button" onClick={() => navigate(it.to)}>
                    <span className="tile" style={{ background: it.color }}>{it.tile}</span>
                    <span className="bd"><b><span className="num">{it.n}</span> {it.label}</b><small>{it.sub}</small></span>
                    <span className="arr">&rsaquo;</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="feed-empty"><span className="ok">&#10003;</span> Nimic nou. Totul e la zi.</div>
            )}
          </div>
        );
      })()}

      <div className="a-grid">
        {/* LEFT */}
        <div className="a-col">
          {/* Season & registration */}
          <div className="card">
            <div className="card-hrow"><h2>Sezon și înscrieri</h2></div>
            {reg ? (
              <>
                <div className="seas-row">
                  <div className="l">
                    <b>Înscrieri pe site</b>
                    <small className={reg.open ? 'on' : 'off'}>{reg.open ? 'Vizibile publicului acum' : 'Închise pe site'}</small>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className={`stpill ${reg.open ? 'on' : 'off'}`}>{reg.open ? 'Deschise' : 'Închise'}</span>
                    <button className={`tgl ${reg.open ? 'on' : 'off'}`} onClick={toggleReg} disabled={regSaving} aria-label="Comută înscrierile"><i /></button>
                  </div>
                </div>
                <div className="seas-links">
                  <button type="button" onClick={() => navigate('/content-manager/single-types/api::program.program')}>Editează sezonul și orarul <span className="ar">&rsaquo;</span></button>
                  <button type="button" onClick={() => navigate('/content-manager/single-types/api::pricing.pricing')}>Actualizează prețuri <span className="ar">&rsaquo;</span></button>
                </div>
              </>
            ) : <div className="empty">Se încarcă...</div>}
          </div>

          {/* Upcoming events */}
          <div className="card">
            <div className="card-hrow">
              <h2>Următoarele evenimente</h2>
              <button className="link" type="button" onClick={() => navigate('/content-manager/single-types/api::program.program')}>Vezi tot programul &rarr;</button>
            </div>
            <div className="chips">
              {FILTERS.map((f) => (
                <button key={f.key} className={`chip ${filter === f.key ? 'on' : ''}`} type="button" onClick={() => setFilter(f.key)}>{f.label}</button>
              ))}
            </div>
            {eventsError && <div className="empty">Nu am putut încărca evenimentele.</div>}
            {!eventsError && events === null && <div className="empty">Se încarcă...</div>}
            {!eventsError && events !== null && shownEvents.length === 0 && <div className="empty">Niciun eveniment pentru acest filtru.</div>}
            {shownEvents.map((o, i) => {
              const off = isOff(o);
              const color = off ? '#b0b0b0' : colorOf(o);
              const time = o.startTime ? `${o.startTime}${o.endTime ? ` - ${o.endTime}` : ''}` : 'Toată ziua';
              const sub = o.label && o.type !== 'scoala' ? `${time} · ${o.label}` : `${time} · ${CATEGORY_LABEL[o.type] ?? ''}`;
              return (
                <div key={`${o.date}-${i}`} className={`ev${off ? ' off' : ''}`}>
                  <span className="dt">{dtLabel(o.date)}</span>
                  <span className="bd" style={{ background: color }} />
                  <span className="tx"><b>{evTitle(o)}</b><small>{sub}</small></span>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT */}
        <div className="a-col">
          {/* Analytics (Umami) */}
          <div className="analytics">
            <h2>Analiză trafic</h2>
            {analytics == null ? (
              <div className="soon">Se încarcă...</div>
            ) : analytics.connected ? (
              <>
                <div className="stat">
                  <b className="num">{(analytics.visitors ?? 0).toLocaleString('ro-RO')}</b>
                  {typeof analytics.trendPct === 'number' && (
                    <span className={`tr ${analytics.trendPct >= 0 ? 'up' : 'dn'}`}>{analytics.trendPct >= 0 ? '▲' : '▼'} {Math.abs(analytics.trendPct)}%</span>
                  )}
                </div>
                <div className="spark">{renderSpark(analytics.series ?? [])}</div>
                <div style={{ fontSize: 11, color: '#aeb7d4', marginBottom: 10 }}>Vizitatori unici pe lună</div>
              </>
            ) : (
              <div className="soon">Se conectează în curând. Configurează Umami pentru a activa graficul.</div>
            )}
          </div>

          {/* Site health (GlitchTip) */}
          <div className="card health">
            <h2>Sănătate site</h2>
            {health == null ? (
              <div className="soon">Se încarcă...</div>
            ) : health.connected ? (
              <>
                <div className="hstat">
                  <span className={`hnum num ${(health.errors24h ?? 0) === 0 ? 'ok' : 'bad'}`}>{health.errors24h ?? 0}</span>
                  <div className="hlbl"><b>erori în 24h</b><small>{(health.errors24h ?? 0) === 0 ? 'Totul funcționează' : 'Verifică GlitchTip'}</small></div>
                  <span className={`hbadge ${(health.errors24h ?? 0) === 0 ? 'ok' : 'bad'}`}>{(health.errors24h ?? 0) === 0 ? 'OK' : 'ATENȚIE'}</span>
                </div>
              </>
            ) : (
              <div className="soon">Se conectează în curând. Configurează GlitchTip pentru a vedea erorile.</div>
            )}
          </div>

          {/* Quick actions */}
          <div className="card">
            <h2>Acțiuni rapide</h2>
            <div className="qa">
              {quickActions.map((a) => (
                <button key={a.to} className={a.primary ? 'pri' : ''} type="button" onClick={() => navigate(a.to)}>
                  <span className="i">{a.ic}</span>{a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Inline sparkline from a numeric series (no chart library). */
function renderSpark(series: number[]) {
  if (!series || series.length < 2) return null;
  const max = Math.max(...series, 1);
  const min = Math.min(...series, 0);
  const span = max - min || 1;
  const pts = series.map((v, i) => {
    const x = (i / (series.length - 1)) * 100;
    const y = 30 - ((v - min) / span) * 28 - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="#7f97ff" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
