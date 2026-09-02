import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { INSCRIERI_TO, MESAJE_TO, PROGRAM_EDIT_TO, SPORTIV_EDIT_TO } from './menu';

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
/**
 * Both proxies answer with a `state`. 'not_configured' means the env vars are
 * unset; 'error' means the service is configured but did not answer. They are
 * shown differently on purpose: an unreachable GlitchTip must never render as
 * a healthy site.
 */
type CardState = 'ok' | 'not_configured' | 'error';

interface TopPath { path: string; count: number }
interface AnalyticsData {
  state: CardState;
  visitors?: number; prevVisitors?: number; trendPct?: number | null; pageviews?: number;
  series?: number[]; monthStart?: string; prevMonthStart?: string;
  topPaths?: TopPath[]; publicUrl?: string | null;
}

interface HealthIssue {
  id: string; title: string; shortId: string; level: string;
  count: number; lastSeen: string | null; permalink: string;
}
interface HealthDay { date: string; count: number }
interface HealthData {
  state: CardState;
  errors24h?: number; errors7d?: number;
  days?: HealthDay[]; issues?: HealthIssue[]; capped?: boolean; publicUrl?: string | null;
}

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
.chrow { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.chrow a.lnk { font-size: 11px; font-weight: 700; text-decoration: none; white-space: nowrap; }
.analytics .chrow a.lnk { color: #8b93ad; }
.card .chrow a.lnk { color: #2138b8; }
.analytics .big { display: flex; align-items: flex-end; gap: 9px; margin: 9px 0 1px; }
.analytics .big b { font-size: 32px; font-weight: 800; letter-spacing: -.025em; line-height: 1; font-variant-numeric: tabular-nums; }
.analytics .big .tr { font-size: 11.5px; font-weight: 700; padding-bottom: 3px; }
.analytics .big .tr.up { color: #7fd6a0; } .analytics .big .tr.dn { color: #e79a98; }
.analytics .cap { font-size: 11px; color: #aeb7d4; margin-bottom: 2px; }
.analytics .area { height: 62px; margin: 10px 0 3px; }
.analytics .area svg { width: 100%; height: 100%; display: block; }
.analytics .axis { display: flex; justify-content: space-between; font-size: 10px; color: #8b93ad; border-top: 1px solid rgba(255,255,255,.09); padding-top: 5px; }
.analytics .tops { margin: 12px 0 0; border-top: 1px solid rgba(255,255,255,.09); padding-top: 9px; }
.analytics .tops .t { font-size: 9.5px; text-transform: uppercase; letter-spacing: .06em; color: #8b93ad; font-weight: 700; margin-bottom: 6px; }
.analytics .prow { display: flex; align-items: center; gap: 9px; padding: 4px 0; font-size: 12px; }
.analytics .prow .p { color: #cdd4ea; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
.analytics .prow .bar { width: 74px; height: 4px; border-radius: 3px; background: rgba(255,255,255,.1); overflow: hidden; flex: none; }
.analytics .prow .bar i { display: block; height: 100%; background: #5a76e8; border-radius: 3px; }
.analytics .prow .n { font-size: 11.5px; color: #8b93ad; font-variant-numeric: tabular-nums; min-width: 22px; text-align: right; }

/* site health (glitchtip) */
.health .band { display: flex; align-items: center; gap: 10px; padding: 9px 11px; border-radius: 9px; margin: 10px 0 0; }
.health .band.ok { background: #e7f3ec; } .health .band.warn { background: #fdf3e0; } .health .band.bad { background: #faeceb; }
.health .band .ic { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-size: 14px; font-weight: 800; color: #fff; flex: none; }
.health .band.ok .ic { background: #1f7a4d; } .health .band.warn .ic { background: #8a5a00; } .health .band.bad .ic { background: #be3330; }
.health .band .tx b { display: block; font-size: 13px; font-weight: 700; line-height: 1.3; }
.health .band.ok .tx b { color: #1f7a4d; } .health .band.warn .tx b { color: #8a5a00; } .health .band.bad .tx b { color: #be3330; }
.health .band .tx small { font-size: 11px; color: #5c6070; }
.health .band .n { margin-left: auto; font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; }
.health .band.warn .n { color: #8a5a00; } .health .band.bad .n { color: #be3330; }
.health .strip { display: flex; gap: 3px; align-items: flex-end; height: 30px; margin: 11px 0 4px; }
.health .strip i { flex: 1; border-radius: 2px; background: #e7f3ec; min-height: 3px; display: block; }
.health .strip i.h { background: #f0b8b6; } .health .strip i.hh { background: #be3330; }
.health .striplbl { display: flex; justify-content: space-between; font-size: 10px; color: #8a8d99; }
.health .stripnote { font-size: 10px; color: #9a9daa; margin-top: 4px; line-height: 1.4; }
.health .iss { margin-top: 11px; border-top: 1px solid #eef0f4; padding-top: 2px; }
.health .irow { display: flex; align-items: flex-start; gap: 9px; padding: 8px 0; border-bottom: 1px solid #f5f6f9; text-decoration: none; color: #1b1d26; }
.health .irow:last-child { border-bottom: none; }
.health .irow:hover .m b { color: #2138b8; }
.health .irow .lv { width: 7px; height: 7px; border-radius: 50%; margin-top: 6px; flex: none; }
.health .irow .lv.err { background: #be3330; } .health .irow .lv.wrn { background: #d99100; } .health .irow .lv.inf { background: #8a8d99; }
.health .irow .m { flex: 1; min-width: 0; }
.health .irow .m b { display: block; font-size: 12.5px; font-weight: 600; line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.health .irow .m small { font-size: 10.5px; color: #8a8d99; font-variant-numeric: tabular-nums; }
.health .irow .c { font-size: 11px; font-weight: 700; color: #5c6070; background: #f2f3f7; border-radius: 20px; padding: 2px 7px; flex: none; margin-top: 2px; font-variant-numeric: tabular-nums; }

/* shared not-configured / error / info box */
.stbox { border-radius: 9px; padding: 11px 12px; margin-top: 9px; display: flex; gap: 10px; align-items: flex-start; }
.analytics .stbox { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.13); }
.card .stbox { background: #f7f8fa; border: 1px solid #e6e7ec; }
.stbox .si { width: 20px; height: 20px; border-radius: 50%; flex: none; display: grid; place-items: center; font-size: 11px; font-weight: 800; color: #fff; margin-top: 1px; }
.stbox .si.q { background: #7a8098; } .stbox .si.x { background: #be3330; }
/* Set explicitly: inheriting would put page-level ink on these fixed backgrounds. */
.stbox .st b { display: block; font-size: 12.5px; font-weight: 700; line-height: 1.35; color: #1b1d26; }
.analytics .stbox .st b { color: #eef1fb; }
.stbox .st small { display: block; font-size: 11.5px; margin-top: 1px; color: #5c6070; }
.analytics .stbox .st small { color: #ccd4e8; }
.stbox .st a { font-size: 11.5px; font-weight: 700; color: #2138b8; text-decoration: none; display: inline-block; margin-top: 5px; }
.analytics .stbox .st a { color: #8fa6f5; }

/* loading skeletons: same shape and height as the loaded card, so the column
   does not jump when the data lands. */
@keyframes eduskel { 0% { background-position: -320px 0; } 100% { background-position: 320px 0; } }
.sk { border-radius: 5px; background: #e9ebf0; background-image: linear-gradient(90deg, #e9ebf0 0, #f4f5f8 42%, #e9ebf0 84%); background-size: 320px 100%; background-repeat: no-repeat; animation: eduskel 1.25s ease-in-out infinite; }
.analytics .sk { background: rgba(255,255,255,.08); background-image: linear-gradient(90deg, rgba(255,255,255,.08) 0, rgba(255,255,255,.17) 42%, rgba(255,255,255,.08) 84%); background-size: 320px 100%; background-repeat: no-repeat; }
@media (prefers-reduced-motion: reduce) { .sk { animation: none; } }
.sk.n { height: 31px; width: 104px; margin: 9px 0 4px; }
.sk.cap { height: 10px; width: 74%; margin-bottom: 12px; }
.sk.ch { height: 62px; width: 100%; margin: 2px 0 8px; border-radius: 7px; }
.sk.r { height: 10px; margin: 9px 0; }
.sk.bd { height: 46px; width: 100%; border-radius: 9px; margin: 10px 0 0; }
.sk.st { height: 30px; width: 100%; border-radius: 5px; margin: 11px 0 4px; }
.sk.is { height: 34px; width: 100%; border-radius: 6px; margin-top: 9px; }
.sk.pl { height: 16px; width: 62px; border-radius: 20px; }

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
      .then((r: any) => { if (!off) setAnalytics(r?.data?.state ? r.data : { state: 'error' }); })
      .catch(() => { if (!off) setAnalytics({ state: 'error' }); });
    return () => { off = true; };
  }, [get]);

  // --- site health (GlitchTip proxy) — graceful "not connected"
  React.useEffect(() => {
    let off = false;
    get('/api/site-health/summary')
      .then((r: any) => { if (!off) setHealth(r?.data?.state ? r.data : { state: 'error' }); })
      .catch(() => { if (!off) setHealth({ state: 'error' }); });
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
    { label: 'Adaugă eveniment în calendar', to: PROGRAM_EDIT_TO, ic: '+', primary: true },
    { label: 'Adaugă sportiv', to: SPORTIV_EDIT_TO, ic: 'S' },
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
                  <button type="button" onClick={() => navigate(PROGRAM_EDIT_TO)}>Editează sezonul și orarul <span className="ar">&rsaquo;</span></button>
                  <button type="button" onClick={() => navigate('/content-manager/single-types/api::pricing.pricing')}>Actualizează prețuri <span className="ar">&rsaquo;</span></button>
                </div>
              </>
            ) : <div className="empty">Se încarcă...</div>}
          </div>

          {/* Upcoming events */}
          <div className="card">
            <div className="card-hrow">
              <h2>Următoarele evenimente</h2>
              <button className="link" type="button" onClick={() => navigate(PROGRAM_EDIT_TO)}>Vezi tot programul &rarr;</button>
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
            {analytics == null ? (
              <>
                <div className="chrow"><h2>Analiză trafic</h2><span className="sk pl" /></div>
                <div className="sk n" />
                <div className="sk cap" />
                <div className="sk ch" />
                <div className="tops">
                  <div className="t">Cele mai vizitate pagini</div>
                  <div className="sk r" style={{ width: '88%' }} />
                  <div className="sk r" style={{ width: '64%' }} />
                  <div className="sk r" style={{ width: '73%' }} />
                </div>
              </>
            ) : analytics.state === 'ok' ? (
              (() => {
                const series = analytics.series ?? [];
                const visitors = analytics.visitors ?? 0;
                const prev = analytics.prevVisitors ?? 0;
                const paths = analytics.topPaths ?? [];
                const topMax = Math.max(...paths.map((t) => t.count), 1);
                // Nothing recorded yet is neither good nor bad news, so it stays
                // neutral rather than reading as a drop to zero.
                const noTraffic = visitors === 0 && series.every((v) => v === 0);
                return (
                  <>
                    <div className="chrow">
                      <h2>Analiză trafic</h2>
                      {analytics.publicUrl && (
                        <a className="lnk" href={analytics.publicUrl} target="_blank" rel="noreferrer">Vezi tot &rsaquo;</a>
                      )}
                    </div>
                    <div className="big">
                      <b>{roNum(visitors)}</b>
                      {typeof analytics.trendPct === 'number' && !noTraffic && (
                        <span className={`tr ${analytics.trendPct >= 0 ? 'up' : 'dn'}`}>
                          {analytics.trendPct >= 0 ? '▲' : '▼'} {Math.abs(analytics.trendPct)}%
                        </span>
                      )}
                    </div>
                    <div className="cap">
                      {noTraffic
                        ? `Niciun vizitator înregistrat încă în ${monthName(analytics.monthStart)}`
                        : prev > 0
                          ? `Vizitatori în ${monthName(analytics.monthStart)}, față de ${roNum(prev)} în ${monthName(analytics.prevMonthStart)}`
                          : `Vizitatori în ${monthName(analytics.monthStart)}`}
                    </div>
                    {noTraffic ? (
                      <StateBox
                        kind="q"
                        body="Statisticile apar după prima vizită pe site. Poate dura câteva minute."
                      />
                    ) : (
                      <>
                        <div className="area">{renderArea(series)}</div>
                        <div className="axis">
                          <span>1 {monthName(analytics.monthStart)}</span>
                          <span>azi</span>
                        </div>
                      </>
                    )}
                    {paths.length > 0 && (
                      <div className="tops">
                        <div className="t">Cele mai vizitate pagini</div>
                        {paths.map((t) => (
                          <div className="prow" key={t.path}>
                            <span className="p" title={t.path}>{t.path}</span>
                            <span className="bar"><i style={{ width: `${Math.round((t.count / topMax) * 100)}%` }} /></span>
                            <span className="n">{roNum(t.count)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()
            ) : (
              <>
                <h2>Analiză trafic</h2>
                {analytics.state === 'not_configured' ? (
                  <StateBox
                    kind="q"
                    title="Umami nu este conectat"
                    body="Lipsesc datele de acces către serviciul de statistici."
                  />
                ) : (
                  <StateBox
                    kind="x"
                    title="Nu am putut prelua statisticile"
                    body="Serviciul nu a răspuns. Datele reapar singure când revine."
                    href={analytics.publicUrl}
                    linkLabel="Deschide Umami"
                  />
                )}
              </>
            )}
          </div>

          {/* Site health (GlitchTip) */}
          <div className="card health">
            {health == null ? (
              <>
                <div className="chrow"><h2>Sănătate site</h2><span className="sk pl" /></div>
                <div className="sk bd" />
                <div className="sk st" />
                <div className="sk is" />
              </>
            ) : health.state === 'ok' ? (
              (() => {
                const e24 = health.errors24h ?? 0;
                const e7 = health.errors7d ?? 0;
                const days = health.days ?? [];
                const issues = health.issues ?? [];
                const dayMax = Math.max(...days.map((d) => d.count), 0);
                const tone = e24 === 0 ? 'ok' : e24 > 5 ? 'bad' : 'warn';
                return (
                  <>
                    <div className="chrow">
                      <h2>Sănătate site</h2>
                      {health.publicUrl && (
                        <a className="lnk" href={health.publicUrl} target="_blank" rel="noreferrer">Deschide GlitchTip &rsaquo;</a>
                      )}
                    </div>
                    <div className={`band ${tone}`}>
                      <span className="ic">{e24 === 0 ? '✓' : '!'}</span>
                      <div className="tx">
                        <b>
                          {e24 === 0
                            ? 'Nicio eroare în ultimele 24 de ore'
                            : `${roNum(e24)} ${e24 === 1 ? 'eroare' : 'erori'} în ultimele 24 de ore`}
                        </b>
                        <small>
                          {e24 > 0 && issues[0]?.lastSeen
                            ? `Cea mai recentă ${relTime(issues[0].lastSeen)}`
                            : e7 === 0
                              ? 'Niciun incident în ultimele 7 zile'
                              : `${roNum(e7)} ${e7 === 1 ? 'incident' : 'incidente'} în ultimele 7 zile`}
                        </small>
                      </div>
                      {e24 > 0 && <span className="n">{roNum(e24)}</span>}
                    </div>

                    {days.length > 0 && (
                      <>
                        <div className="strip">
                          {days.map((d) => {
                            const pct = dayMax > 0 ? (d.count / dayMax) * 100 : 0;
                            const cls = d.count === 0 ? '' : d.count === dayMax ? 'hh' : 'h';
                            return (
                              <i
                                key={d.date}
                                className={cls}
                                style={{ height: `${Math.max(8, pct)}%` }}
                                title={`${new Date(d.date).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })}: ${d.count}`}
                              />
                            );
                          })}
                        </div>
                        <div className="striplbl"><span>acum 7 zile</span><span>azi</span></div>
                        <div className="stripnote">
                          Bara numără incidente după ultima apariție, nu numărul total de apariții.
                        </div>
                      </>
                    )}

                    {issues.length > 0 && (
                      <div className="iss">
                        {issues.map((i) => (
                          <a
                            className="irow"
                            key={i.id}
                            href={i.permalink}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <span className={`lv ${levelClass(i.level)}`} />
                            <div className="m">
                              <b title={i.title}>{i.title}</b>
                              <small>{[i.shortId, relTime(i.lastSeen)].filter(Boolean).join(' · ')}</small>
                            </div>
                            {i.count > 1 && <span className="c">{roNum(i.count)}×</span>}
                          </a>
                        ))}
                      </div>
                    )}
                    {health.capped && (
                      <div className="stripnote">
                        Sunt afișate primele 100 de incidente, deci cifrele sunt un minim.
                      </div>
                    )}
                  </>
                );
              })()
            ) : (
              <>
                <h2>Sănătate site</h2>
                {health.state === 'not_configured' ? (
                  <StateBox
                    kind="q"
                    title="GlitchTip nu este conectat"
                    body="Lipsesc datele de acces către serviciul de erori."
                  />
                ) : (
                  <StateBox
                    kind="x"
                    title="Nu am putut verifica erorile"
                    body="Serviciul nu a răspuns. Asta nu înseamnă că site-ul are probleme."
                    href={health.publicUrl}
                    linkLabel="Deschide GlitchTip"
                  />
                )}
              </>
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
/** Romanian thousands separator, matching the rest of the dashboard. */
const roNum = (n: number) => n.toLocaleString('ro-RO');

/** "septembrie" from an ISO month start. */
function monthName(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ro-RO', { month: 'long' });
}

/** Coarse relative time, good enough for "last seen" on the health card. */
function relTime(iso: string | null): string {
  if (!iso) return '';
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return 'chiar acum';
  const min = Math.round(ms / 60000);
  if (min < 1) return 'chiar acum';
  if (min < 60) return `acum ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `acum ${h} ${h === 1 ? 'oră' : 'ore'}`;
  const d = Math.round(h / 24);
  return `acum ${d} ${d === 1 ? 'zi' : 'zile'}`;
}

/** Filled area chart of daily visits. One point per elapsed day of the month. */
function renderArea(series: number[]) {
  if (!series || series.length < 2) return null;
  const W = 300;
  const H = 62;
  const max = Math.max(...series, 1);
  const pts = series.map((v, i) => {
    const x = (i / (series.length - 1)) * W;
    const y = H - 4 - (v / max) * (H - 12);
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')} L${W},${H} L0,${H} Z`;
  const last = pts[pts.length - 1]!;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="eduAreaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a76e8" stopOpacity=".45" />
          <stop offset="1" stopColor="#5a76e8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#eduAreaFill)" />
      <polyline
        points={line}
        fill="none"
        stroke="#7f97f2"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0]} cy={last[1]} r={3} fill="#fff" />
    </svg>
  );
}

/** Level dot class for a GlitchTip issue. */
function levelClass(level: string): string {
  if (level === 'warning') return 'wrn';
  if (level === 'error' || level === 'fatal') return 'err';
  return 'inf';
}

/**
 * The not-configured / failed / informational block shared by both cards.
 * A missing setting and a dead service look different on purpose.
 */
function StateBox({ kind, title, body, href, linkLabel }: {
  kind: 'q' | 'x';
  title?: string;
  body: string;
  href?: string | null;
  linkLabel?: string;
}) {
  return (
    <div className="stbox">
      <span className={`si ${kind}`}>{kind === 'x' ? '!' : '?'}</span>
      <div className="st">
        {title && <b>{title}</b>}
        <small>{body}</small>
        {href && linkLabel && (
          <a href={href} target="_blank" rel="noreferrer">{linkLabel} &rsaquo;</a>
        )}
      </div>
    </div>
  );
}
