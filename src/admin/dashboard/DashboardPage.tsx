import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import {
  AdminPage,
  Section,
  StatTile,
  StatusBadge,
  Switch,
  SegmentedControl,
  EmptyState,
  Notice,
  Loading,
  Button,
  adminToast,
  toastAutosaved,
} from '../ui';
import { FORMULARE_TO, PROGRAM_EDIT_TO, SPORTIV_EDIT_TO } from './menu';
import { FORM_DEFS, fetchNewCount } from './formDefs';

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

// Event categories map onto the calendar category tokens shared with the
// website (--theme-cat-*), the same mapping as CATEGORIES in
// ProgramOverviewEditor.tsx: antrenament = burgundy, scoala = navy,
// competitions / camps / shows / events = orange, holidays / breaks = silver.
const CATEGORY_VAR: Record<string, string> = {
  curs: 'var(--theme-cat-antrenament)', scoala: 'var(--theme-cat-scoala)', concurs: 'var(--theme-cat-eveniment)',
  cantonament: 'var(--theme-cat-eveniment)', spectacol: 'var(--theme-cat-eveniment)', eveniment: 'var(--theme-cat-eveniment)',
  vacanta: 'var(--theme-cat-liber)', sarbatoare: 'var(--theme-cat-liber)', liber: 'var(--theme-cat-liber)',
};
const CATEGORY_LABEL: Record<string, string> = {
  curs: 'Antrenament', scoala: 'Școala de patinaj', concurs: 'Competiție', cantonament: 'Cantonament',
  spectacol: 'Spectacol', eveniment: 'Eveniment', vacanta: 'Vacanță', sarbatoare: 'Sărbătoare', liber: 'Pauză',
};

// Upcoming-events filters. `types` empty = all.
type FilterKey = 'all' | 'antr' | 'scoala' | 'comp' | 'alt';
const FILTERS: Array<{ key: FilterKey; label: string; types: string[] }> = [
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

// Page-local layout, tokens only (var(--theme-*), var(--palette-*), var(--ui-*)).
// The greeting band and the analytics card keep their navy look on the brand
// palette: solid colours only (no translucent white on the gradient), every
// text colour at least 4.5:1 on both ends of the gradient.
// Kept free of backticks: one stray backtick takes the admin down.
const CSS = `
.ui-root .dash-hero{background:linear-gradient(120deg,var(--palette-brand-navy),var(--palette-blue-800));border:1px solid var(--palette-blue-800);color:var(--palette-grey-0);border-radius:var(--ui-radius-md);padding:16px 20px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}
.ui-root .dash-hero h1{margin:0;font-size:20px;font-weight:800;letter-spacing:-.01em;color:var(--palette-grey-0)}
.ui-root .dash-hero h1 span{color:var(--palette-blue-200)}
.ui-root .dash-hero .dash-date{margin:4px 0 0;font-size:12.5px;color:var(--palette-blue-100);text-transform:capitalize}
.ui-root .dash-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}
@media (max-width:900px){.ui-root .dash-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}

.ui-root .dash-feed{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:6px}
.ui-root .dash-frow{display:flex;align-items:center;gap:11px;padding:10px 11px;border-radius:var(--ui-radius-sm);border:1px solid var(--theme-border);background:var(--theme-surface);cursor:pointer;text-align:left;font-family:inherit;color:var(--theme-text);width:100%}
.ui-root .dash-frow:hover{background:var(--theme-primary-soft);border-color:var(--theme-primary-soft-line)}
.ui-root .dash-frow:focus-visible{outline:2px solid var(--theme-focus);outline-offset:1px}
.ui-root .dash-tile{width:32px;height:32px;border-radius:var(--ui-radius-sm);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:var(--palette-grey-0);flex-shrink:0}
.ui-root .dash-frow-t{flex:1;min-width:0;font-size:13px;font-weight:700;line-height:1.25}
.ui-root .dash-arr{color:var(--theme-text-muted);font-size:16px}
.ui-root .dash-empty-ok{color:var(--theme-success)}
.ui-root .dash-feed-sec .ui-empty{padding:18px var(--ui-space-4)}

.ui-root .dash-grid{display:grid;grid-template-columns:1.5fr 1fr;gap:var(--ui-space-4);align-items:start}
.ui-root .dash-col{display:flex;flex-direction:column;gap:var(--ui-space-4);min-width:0}
@media (max-width:900px){.ui-root .dash-grid{grid-template-columns:minmax(0,1fr)}}

.ui-root .dash-seas{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.ui-root .dash-seas b{font-size:13.5px;font-weight:700;display:block;color:var(--theme-text)}
.ui-root .dash-seas small{font-size:11px;color:var(--theme-text-muted)}
.ui-root .dash-seas small.on{color:var(--theme-success)}
.ui-root .dash-seas-ctl{display:flex;align-items:center;gap:10px}
.ui-root .dash-links{display:flex;flex-direction:column;border-top:1px solid var(--theme-border-subtle)}
.ui-root .dash-links button{display:flex;align-items:center;justify-content:space-between;padding:10px 0;font-size:12.5px;color:var(--theme-text);background:none;border:none;border-bottom:1px solid var(--theme-border-subtle);cursor:pointer;font-family:inherit;text-align:left}
.ui-root .dash-links button:last-child{border-bottom:none}
.ui-root .dash-links button:hover{color:var(--theme-primary)}
.ui-root .dash-links .dash-arr{font-size:14px}

.ui-root .dash-filter{flex-wrap:wrap}
.ui-root .dash-ev{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--theme-border-subtle)}
.ui-root .dash-ev:first-child{border-top:none}
.ui-root .dash-ev-dt{font-size:11px;color:var(--theme-text-muted);width:54px;flex-shrink:0;font-weight:600}
.ui-root .dash-ev-bar{width:3px;align-self:stretch;min-height:26px;flex-shrink:0}
.ui-root .dash-ev-tx{min-width:0}
.ui-root .dash-ev-tx b{font-weight:600;font-size:13px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--theme-text)}
.ui-root .dash-ev-tx small{font-size:11.5px;color:var(--theme-text-muted)}
.ui-root .dash-ev.off .dash-ev-tx b{color:var(--theme-text-muted);text-decoration:line-through}
.ui-root .dash-evs .ui-empty,.ui-root .dash-evs .ui-loading{padding:18px var(--ui-space-4)}

.ui-root .dash-lnk{font-size:11.5px;font-weight:700;text-decoration:none;white-space:nowrap;color:var(--theme-primary)}
.ui-root .dash-lnk:hover{text-decoration:underline}

/* analytics (Umami): the navy card */
.ui-root .ui-sec.dash-dark{background:var(--palette-brand-navy);border-color:var(--palette-blue-800);color:var(--palette-blue-50)}
.ui-root .dash-dark .ui-sec-h{border-bottom-color:var(--palette-blue-800)}
.ui-root .dash-dark .ui-sec-title{color:var(--palette-grey-350)}
.ui-root .dash-dark .dash-lnk{color:var(--palette-blue-200)}
.ui-root .dash-big{display:flex;align-items:flex-end;gap:9px;margin:0 0 1px}
.ui-root .dash-big b{font-size:32px;font-weight:800;letter-spacing:-.025em;line-height:1;font-variant-numeric:tabular-nums;color:var(--palette-grey-0)}
.ui-root .dash-trend{font-size:11.5px;font-weight:700;padding-bottom:3px}
.ui-root .dash-trend.up{color:var(--palette-green-200)}
.ui-root .dash-trend.dn{color:var(--palette-red-300)}
.ui-root .dash-cap{font-size:11px;color:var(--palette-blue-100)}
.ui-root .dash-area{height:62px;margin:4px 0 3px}
.ui-root .dash-area svg{width:100%;height:100%;display:block}
.ui-root .dash-axis{display:flex;justify-content:space-between;font-size:10px;color:var(--palette-grey-350);border-top:1px solid var(--palette-blue-800);padding-top:5px}
.ui-root .dash-tops{border-top:1px solid var(--palette-blue-800);padding-top:9px}
.ui-root .dash-tops-t{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--palette-grey-350);font-weight:700;margin-bottom:6px}
.ui-root .dash-prow{display:flex;align-items:center;gap:9px;padding:4px 0;font-size:12px}
.ui-root .dash-prow-p{color:var(--palette-blue-100);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
.ui-root .dash-prow-bar{width:74px;height:4px;background:var(--palette-blue-800);overflow:hidden;flex:none}
.ui-root .dash-prow-bar i{display:block;height:100%;background:var(--palette-blue-300)}
.ui-root .dash-prow-n{font-size:11.5px;color:var(--palette-grey-350);font-variant-numeric:tabular-nums;min-width:22px;text-align:right}

/* site health (GlitchTip) */
.ui-root .dash-band{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:var(--ui-radius-sm);border:1px solid var(--theme-success-border);background:var(--theme-success-bg);color:var(--theme-success)}
.ui-root .dash-band.warn{border-color:var(--theme-warning-border);background:var(--theme-warning-bg);color:var(--theme-warning)}
.ui-root .dash-band.bad{border-color:var(--theme-danger-border);background:var(--theme-danger-bg);color:var(--theme-danger)}
.ui-root .dash-band-ic{width:26px;height:26px;border-radius:var(--ui-radius-sm);display:grid;place-items:center;font-size:14px;font-weight:800;flex:none;border:1.5px solid currentColor}
.ui-root .dash-band-tx b{display:block;font-size:13px;font-weight:700;line-height:1.3}
.ui-root .dash-band-tx small{font-size:11px;color:var(--theme-text-secondary)}
.ui-root .dash-band-n{margin-left:auto;font-size:22px;font-weight:800;font-variant-numeric:tabular-nums}
.ui-root .dash-strip{display:flex;gap:3px;align-items:flex-end;height:30px;margin:0 0 4px}
.ui-root .dash-strip i{flex:1;background:var(--theme-success-border);min-height:3px;display:block}
.ui-root .dash-strip i.h{background:var(--theme-danger-border)}
.ui-root .dash-strip i.hh{background:var(--theme-danger)}
.ui-root .dash-striplbl{display:flex;justify-content:space-between;font-size:10px;color:var(--theme-text-muted)}
.ui-root .dash-note{font-size:10.5px;color:var(--theme-text-muted);margin-top:4px;line-height:1.4}
.ui-root .dash-iss{border-top:1px solid var(--theme-border-subtle)}
.ui-root .dash-irow{display:flex;align-items:flex-start;gap:9px;padding:8px 0;border-bottom:1px solid var(--theme-border-subtle);text-decoration:none;color:var(--theme-text)}
.ui-root .dash-irow:last-child{border-bottom:none}
.ui-root .dash-irow:hover .dash-irow-m b{color:var(--theme-primary)}
.ui-root .dash-lv{width:7px;height:7px;margin-top:6px;flex:none;background:var(--theme-neutral)}
.ui-root .dash-lv.err{background:var(--theme-danger)}
.ui-root .dash-lv.wrn{background:var(--theme-warning)}
.ui-root .dash-irow-m{flex:1;min-width:0}
.ui-root .dash-irow-m b{display:block;font-size:12.5px;font-weight:600;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ui-root .dash-irow-m small{font-size:10.5px;color:var(--theme-text-muted);font-variant-numeric:tabular-nums}
.ui-root .dash-irow .ui-badge{margin-top:2px;flex:none}

/* not-configured / error / info box, shared by both cards */
.ui-root .dash-stbox{border-radius:var(--ui-radius-sm);padding:11px 12px;display:flex;gap:10px;align-items:flex-start;background:var(--theme-surface-sunken);border:1px solid var(--theme-border)}
.ui-root .dash-dark .dash-stbox{background:var(--palette-brand-navy);border-color:var(--palette-blue-800)}
.ui-root .dash-si{width:20px;height:20px;border-radius:var(--ui-radius-sm);flex:none;display:grid;place-items:center;font-size:11px;font-weight:800;margin-top:1px;color:var(--theme-text-muted);border:1.5px solid currentColor}
.ui-root .dash-si.x{color:var(--theme-danger)}
.ui-root .dash-dark .dash-si{color:var(--palette-grey-350)}
.ui-root .dash-dark .dash-si.x{color:var(--palette-red-300)}
.ui-root .dash-st b{display:block;font-size:12.5px;font-weight:700;line-height:1.35;color:var(--theme-text)}
.ui-root .dash-dark .dash-st b{color:var(--palette-blue-50)}
.ui-root .dash-st small{display:block;font-size:11.5px;margin-top:1px;color:var(--theme-text-secondary)}
.ui-root .dash-dark .dash-st small{color:var(--palette-blue-100)}
.ui-root .dash-st a{font-size:11.5px;font-weight:700;color:var(--theme-primary);text-decoration:none;display:inline-block;margin-top:5px}
.ui-root .dash-dark .dash-st a{color:var(--palette-blue-200)}

/* loading skeletons: same shape and height as the loaded card */
@keyframes dash-skel{0%{background-position:-320px 0}100%{background-position:320px 0}}
.ui-root .dash-sk{background:var(--theme-border-subtle);background-image:linear-gradient(90deg,var(--theme-border-subtle) 0,var(--theme-surface-sunken) 42%,var(--theme-border-subtle) 84%);background-size:320px 100%;background-repeat:no-repeat;animation:dash-skel 1.25s ease-in-out infinite;border-radius:var(--ui-radius-sm)}
.ui-root .dash-dark .dash-sk{background:var(--palette-blue-800);background-image:linear-gradient(90deg,var(--palette-blue-800) 0,var(--palette-blue-500) 42%,var(--palette-blue-800) 84%);background-size:320px 100%;background-repeat:no-repeat}
@media (prefers-reduced-motion:reduce){.ui-root .dash-sk{animation:none}}
.ui-root .dash-sk.n{height:31px;width:104px}
.ui-root .dash-sk.cap{height:10px;width:74%}
.ui-root .dash-sk.ch{height:62px;width:100%}
.ui-root .dash-sk.r{height:10px;margin:9px 0}
.ui-root .dash-sk.bd{height:46px;width:100%}
.ui-root .dash-sk.st{height:30px;width:100%}
.ui-root .dash-sk.is{height:34px;width:100%}
.ui-root .dash-sk.pl{height:16px;width:62px}

.ui-root .dash-qa{display:flex;flex-direction:column;gap:8px}
.ui-root .dash-qa .ui-btn{width:100%;justify-content:flex-start;padding-top:10px;padding-bottom:10px}
.ui-root .dash-qa-i{width:20px;display:inline-flex;justify-content:center;font-weight:800;font-size:14px}
`;

type QuickAction = { label: string; to: string; ic: string; primary?: boolean };

export default function DashboardPage() {
  const { get, put } = useFetchClient();
  const navigate = useNavigate();

  const today = React.useMemo(() => new Date(), []);
  const todayStr = ymd(today);

  const [name, setName] = React.useState<string | null>(null);
  const [kpis, setKpis] = React.useState<Array<{ k: string; v: number; c?: string }>>([]);
  const [events, setEvents] = React.useState<Occurrence[] | null>(null);
  const [eventsError, setEventsError] = React.useState(false);
  const [filter, setFilter] = React.useState<FilterKey>('all');

  const [newCounts, setNewCounts] = React.useState<Record<string, number | null>>({});
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

  // --- KPIs
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
    ]).then(([sportivi, membri, competitii, month]) => {
      if (off) return;
      const out: Array<{ k: string; v: number; c?: string }> = [];
      if (sportivi != null) out.push({ k: 'Sportivi', v: sportivi });
      if (membri != null) out.push({ k: 'Membri echipă', v: membri });
      if (competitii != null) out.push({ k: 'Competiții', v: competitii, c: `în ${year}` });
      if (month != null) {
        const antr = month.byType['curs'] ?? 0;
        out.push({ k: 'Evenimente luna aceasta', v: month.total, c: antr > 0 ? `din care ${antr} antrenamente` : undefined });
      }
      setKpis(out);
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
      })
      .catch(() => { if (!off) setEventsError(true); });
    return () => { off = true; };
  }, [get, today, todayStr]);

  // --- new-entry counts for every live form (shared defs, per-form dialect)
  React.useEffect(() => {
    let off = false;
    FORM_DEFS.filter((d) => d.live).forEach((def) => {
      fetchNewCount(get, def).then((n) => {
        if (!off) setNewCounts((c) => ({ ...c, [def.key]: n }));
      });
    });
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

  // --- analytics (Umami proxy): graceful "not connected"
  React.useEffect(() => {
    let off = false;
    get('/api/analytics/summary')
      .then((r: any) => { if (!off) setAnalytics(r?.data?.state ? r.data : { state: 'error' }); })
      .catch(() => { if (!off) setAnalytics({ state: 'error' }); });
    return () => { off = true; };
  }, [get]);

  // --- site health (GlitchTip proxy): graceful "not connected"
  React.useEffect(() => {
    let off = false;
    get('/api/site-health/summary')
      .then((r: any) => { if (!off) setHealth(r?.data?.state ? r.data : { state: 'error' }); })
      .catch(() => { if (!off) setHealth({ state: 'error' }); });
    return () => { off = true; };
  }, [get]);

  // The switch saves at once (no save bar): optimistic, reverted on failure,
  // with the autosave toast either way.
  const toggleReg = async (nextOpen: boolean) => {
    if (!reg || regSaving) return;
    setReg({ ...reg, open: nextOpen });
    setRegSaving(true);
    try {
      await put(`/content-manager/single-types/${SITE_SETTINGS_UID}`, { registration: { ...reg.raw, open: nextOpen } });
      setReg((c) => (c ? { open: nextOpen, raw: { ...c.raw, open: nextOpen } } : c));
      toastAutosaved();
    } catch {
      setReg((c) => (c ? { ...c, open: !nextOpen } : c)); // revert
      adminToast.error('Nu am putut schimba înscrierile. Încearcă din nou.');
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
  // Colour comes only from category / state, never the per-event color
  // field: the website ignores it and the admin has no input for it.
  const colorOf = (o: Occurrence) => CATEGORY_VAR[o.type] ?? 'var(--theme-cat-scoala)';
  const isOff = (o: Occurrence) => o.status === 'cancelled' || o.state === 'anulat' || o.state === 'liber';
  const evTitle = (o: Occurrence) => (o.type === 'scoala' ? 'Școala de patinaj' : (o.title || o.label || 'Eveniment'));

  const activeTypes = FILTERS.find((f) => f.key === filter)?.types ?? [];
  const shownEvents = (events ?? []).filter((o) => activeTypes.length === 0 || activeTypes.includes(o.type)).slice(0, 6);

  const quickActions: QuickAction[] = [
    { label: 'Adaugă eveniment în calendar', to: PROGRAM_EDIT_TO, ic: '+', primary: true },
    { label: 'Adaugă sportiv', to: SPORTIV_EDIT_TO, ic: 'S' },
    { label: 'Adaugă articol', to: '/content-manager/collection-types/api::article.article/create', ic: 'A' },
  ];

  const feedItems = FORM_DEFS
    .filter((def) => def.live && (newCounts[def.key] ?? 0) > 0)
    .map((def) => ({
      key: def.key,
      n: newCounts[def.key] ?? 0,
      color: def.feedColor,
      tile: def.feedTile,
      to: def.resultsTo ?? FORMULARE_TO,
      name: def.feedName,
    }));
  const totalNew = feedItems.reduce((s, it) => s + it.n, 0);
  const season = today.getMonth() >= 7
    ? `${today.getFullYear()} / ${today.getFullYear() + 1}`
    : `${today.getFullYear() - 1} / ${today.getFullYear()}`;

  return (
    <AdminPage>
      <style>{CSS}</style>

      {/* HERO */}
      <header className="dash-hero">
        <div>
          <h1>Bună{name ? <>, <span>{name}</span></> : null}.</h1>
          <p className="dash-date">{dateLine}</p>
        </div>
        <StatusBadge size="md" custom={HERO_BADGE}>Sezon {season}</StatusBadge>
      </header>

      {/* KPIs */}
      {kpis.length > 0 && (
        <div className="ui-stats dash-kpis">
          {kpis.map((s) => (
            <StatTile key={s.k} label={s.k} value={s.v} caption={s.c} />
          ))}
        </div>
      )}

      {/* CE E NOU feed */}
      <Section
        title="Ce e nou"
        className="dash-feed-sec"
        aside={totalNew > 0 ? <StatusBadge tone="danger" size="md"><span className="ui-num">{totalNew}</span> de rezolvat</StatusBadge> : undefined}
      >
        {feedItems.length > 0 ? (
          <div className="dash-feed">
            {feedItems.map((it) => (
              <button key={it.key} className="dash-frow" type="button" onClick={() => navigate(it.to)}>
                <span className="dash-tile" style={{ background: it.color }}>{it.tile}</span>
                <span className="dash-frow-t">{it.name}: <span className="ui-num">{it.n}</span> {it.n === 1 ? 'mesaj nou' : 'mesaje noi'}</span>
                <span className="dash-arr" aria-hidden="true">&rsaquo;</span>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState icon={<CheckIcon />}>Nimic nou. Totul e la zi.</EmptyState>
        )}
      </Section>

      <div className="dash-grid">
        {/* LEFT */}
        <div className="dash-col">
          {/* Season & registration */}
          <Section title="Sezon și înscrieri">
            {reg ? (
              <>
                <div className="dash-seas">
                  <div>
                    <b>Înscrieri pe site</b>
                    <small className={reg.open ? 'on' : undefined}>{reg.open ? 'Vizibile publicului acum' : 'Închise pe site'}</small>
                  </div>
                  <div className="dash-seas-ctl">
                    <StatusBadge tone={reg.open ? 'success' : 'danger'} size="md">{reg.open ? 'Deschise' : 'Închise'}</StatusBadge>
                    <Switch checked={reg.open} onChange={(v) => void toggleReg(v)} disabled={regSaving} aria-label="Comută înscrierile" />
                  </div>
                </div>
                <div className="dash-links">
                  <button type="button" onClick={() => navigate(PROGRAM_EDIT_TO)}>Editează sezonul și orarul <span className="dash-arr" aria-hidden="true">&rsaquo;</span></button>
                  <button type="button" onClick={() => navigate('/content-manager/single-types/api::pricing.pricing')}>Actualizează prețuri <span className="dash-arr" aria-hidden="true">&rsaquo;</span></button>
                </div>
              </>
            ) : <Loading />}
          </Section>

          {/* Upcoming events */}
          <Section
            title="Următoarele evenimente"
            className="dash-evs"
            aside={<Button variant="ghost" size="sm" onClick={() => navigate(PROGRAM_EDIT_TO)}>Vezi tot programul &rarr;</Button>}
          >
            <SegmentedControl<FilterKey>
              className="dash-filter"
              size="sm"
              aria-label="Filtrează evenimentele"
              options={FILTERS.map((f) => ({ value: f.key, label: f.label }))}
              value={filter}
              onChange={setFilter}
            />
            {eventsError ? (
              <Notice tone="danger">Nu am putut încărca evenimentele.</Notice>
            ) : events === null ? (
              <Loading />
            ) : shownEvents.length === 0 ? (
              <EmptyState>Niciun eveniment pentru acest filtru.</EmptyState>
            ) : (
              <div>
                {shownEvents.map((o, i) => {
                  const off = isOff(o);
                  const time = o.startTime ? `${o.startTime}${o.endTime ? ` - ${o.endTime}` : ''}` : 'Toată ziua';
                  const sub = o.label && o.type !== 'scoala' ? `${time} · ${o.label}` : `${time} · ${CATEGORY_LABEL[o.type] ?? ''}`;
                  return (
                    <div key={`${o.date}-${i}`} className={`dash-ev${off ? ' off' : ''}`}>
                      <span className="dash-ev-dt">{dtLabel(o.date)}</span>
                      <span className="dash-ev-bar" style={{ background: off ? 'var(--theme-text-disabled)' : colorOf(o) }} />
                      <span className="dash-ev-tx"><b>{evTitle(o)}</b><small>{sub}</small></span>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </div>

        {/* RIGHT */}
        <div className="dash-col">
          <AnalyticsCard analytics={analytics} />
          <HealthCard health={health} />

          {/* Quick actions */}
          <Section title="Acțiuni rapide">
            <div className="dash-qa">
              {quickActions.map((a) => (
                <Button
                  key={a.to}
                  variant={a.primary ? 'primary' : 'secondary'}
                  icon={<span className="dash-qa-i" aria-hidden="true">{a.ic}</span>}
                  onClick={() => navigate(a.to)}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </AdminPage>
  );
}

/** The hero's season label: square, outlined, solid colours on the navy band. */
const HERO_BADGE = { fg: 'var(--palette-blue-50)', bg: 'var(--palette-brand-navy)', line: 'var(--palette-blue-400)' };

function CheckIcon() {
  return (
    <svg className="dash-empty-ok" width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5 10 17 19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
    </svg>
  );
}

/** Analytics (Umami): the navy card. */
function AnalyticsCard({ analytics }: { analytics: AnalyticsData | null }) {
  if (analytics == null) {
    return (
      <Section title="Analiză trafic" className="dash-dark" aside={<span className="dash-sk pl" />}>
        <div className="dash-sk n" />
        <div className="dash-sk cap" />
        <div className="dash-sk ch" />
        <div className="dash-tops">
          <div className="dash-tops-t">Cele mai vizitate pagini</div>
          <div className="dash-sk r" style={{ width: '88%' }} />
          <div className="dash-sk r" style={{ width: '64%' }} />
          <div className="dash-sk r" style={{ width: '73%' }} />
        </div>
      </Section>
    );
  }
  if (analytics.state !== 'ok') {
    return (
      <Section title="Analiză trafic" className="dash-dark">
        {analytics.state === 'not_configured' ? (
          <StateBox kind="q" title="Umami nu este conectat" body="Lipsesc datele de acces către serviciul de statistici." />
        ) : (
          <StateBox
            kind="x"
            title="Nu am putut prelua statisticile"
            body="Serviciul nu a răspuns. Datele reapar singure când revine."
            href={analytics.publicUrl}
            linkLabel="Deschide Umami"
          />
        )}
      </Section>
    );
  }
  const series = analytics.series ?? [];
  const visitors = analytics.visitors ?? 0;
  const prev = analytics.prevVisitors ?? 0;
  const paths = analytics.topPaths ?? [];
  const topMax = Math.max(...paths.map((t) => t.count), 1);
  // Nothing recorded yet is neither good nor bad news, so it stays
  // neutral rather than reading as a drop to zero.
  const noTraffic = visitors === 0 && series.every((v) => v === 0);
  return (
    <Section
      title="Analiză trafic"
      className="dash-dark"
      aside={analytics.publicUrl ? (
        <a className="dash-lnk" href={analytics.publicUrl} target="_blank" rel="noreferrer">Vezi tot &rsaquo;</a>
      ) : undefined}
    >
      <div>
        <div className="dash-big">
          <b>{roNum(visitors)}</b>
          {typeof analytics.trendPct === 'number' && !noTraffic && (
            <span className={`dash-trend ${analytics.trendPct >= 0 ? 'up' : 'dn'}`}>
              {analytics.trendPct >= 0 ? '▲' : '▼'} {Math.abs(analytics.trendPct)}%
            </span>
          )}
        </div>
        <div className="dash-cap">
          {noTraffic
            ? `Niciun vizitator înregistrat încă în ${monthName(analytics.monthStart)}`
            : prev > 0
              ? `Vizitatori în ${monthName(analytics.monthStart)}, față de ${roNum(prev)} în ${monthName(analytics.prevMonthStart)}`
              : `Vizitatori în ${monthName(analytics.monthStart)}`}
        </div>
      </div>
      {noTraffic ? (
        <StateBox kind="q" body="Statisticile apar după prima vizită pe site. Poate dura câteva minute." />
      ) : (
        <div>
          <div className="dash-area">{renderArea(series)}</div>
          <div className="dash-axis">
            <span>1 {monthName(analytics.monthStart)}</span>
            <span>azi</span>
          </div>
        </div>
      )}
      {paths.length > 0 && (
        <div className="dash-tops">
          <div className="dash-tops-t">Cele mai vizitate pagini</div>
          {paths.map((t) => (
            <div className="dash-prow" key={t.path}>
              <span className="dash-prow-p" title={t.path}>{t.path}</span>
              <span className="dash-prow-bar"><i style={{ width: `${Math.round((t.count / topMax) * 100)}%` }} /></span>
              <span className="dash-prow-n">{roNum(t.count)}</span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

/** Site health (GlitchTip). */
function HealthCard({ health }: { health: HealthData | null }) {
  if (health == null) {
    return (
      <Section title="Sănătate site" aside={<span className="dash-sk pl" />}>
        <div className="dash-sk bd" />
        <div className="dash-sk st" />
        <div className="dash-sk is" />
      </Section>
    );
  }
  if (health.state !== 'ok') {
    return (
      <Section title="Sănătate site">
        {health.state === 'not_configured' ? (
          <StateBox kind="q" title="GlitchTip nu este conectat" body="Lipsesc datele de acces către serviciul de erori." />
        ) : (
          <StateBox
            kind="x"
            title="Nu am putut verifica erorile"
            body="Serviciul nu a răspuns. Asta nu înseamnă că site-ul are probleme."
            href={health.publicUrl}
            linkLabel="Deschide GlitchTip"
          />
        )}
      </Section>
    );
  }
  const e24 = health.errors24h ?? 0;
  const e7 = health.errors7d ?? 0;
  const days = health.days ?? [];
  const issues = health.issues ?? [];
  const dayMax = Math.max(...days.map((d) => d.count), 0);
  const tone = e24 === 0 ? '' : e24 > 5 ? ' bad' : ' warn';
  return (
    <Section
      title="Sănătate site"
      aside={health.publicUrl ? (
        <a className="dash-lnk" href={health.publicUrl} target="_blank" rel="noreferrer">Deschide GlitchTip &rsaquo;</a>
      ) : undefined}
    >
      <div className={`dash-band${tone}`}>
        <span className="dash-band-ic" aria-hidden="true">{e24 === 0 ? '✓' : '!'}</span>
        <div className="dash-band-tx">
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
        {e24 > 0 && <span className="dash-band-n">{roNum(e24)}</span>}
      </div>

      {days.length > 0 && (
        <div>
          <div className="dash-strip">
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
          <div className="dash-striplbl"><span>acum 7 zile</span><span>azi</span></div>
          <div className="dash-note">Bara numără incidente după ultima apariție, nu numărul total de apariții.</div>
        </div>
      )}

      {issues.length > 0 && (
        <div className="dash-iss">
          {issues.map((i) => (
            <a className="dash-irow" key={i.id} href={i.permalink} target="_blank" rel="noreferrer">
              <span className={`dash-lv ${levelClass(i.level)}`} />
              <div className="dash-irow-m">
                <b title={i.title}>{i.title}</b>
                <small>{[i.shortId, relTime(i.lastSeen)].filter(Boolean).join(' · ')}</small>
              </div>
              {i.count > 1 && <StatusBadge tone="neutral"><span className="ui-num">{roNum(i.count)}×</span></StatusBadge>}
            </a>
          ))}
        </div>
      )}
      {health.capped && (
        <div className="dash-note">Sunt afișate primele 100 de incidente, deci cifrele sunt un minim.</div>
      )}
    </Section>
  );
}

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

/** Filled area chart of daily visits (inline SVG, no chart library). One point per elapsed day of the month. */
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
          <stop offset="0" style={{ stopColor: 'var(--palette-blue-400)', stopOpacity: 0.45 }} />
          <stop offset="1" style={{ stopColor: 'var(--palette-blue-400)', stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#eduAreaFill)" />
      <polyline
        points={line}
        fill="none"
        style={{ stroke: 'var(--palette-blue-300)' }}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <rect x={last[0] - 3} y={last[1] - 3} width={6} height={6} style={{ fill: 'var(--palette-grey-0)' }} />
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
    <div className="dash-stbox">
      <span className={`dash-si ${kind}`} aria-hidden="true">{kind === 'x' ? '!' : '?'}</span>
      <div className="dash-st">
        {title && <b>{title}</b>}
        <small>{body}</small>
        {href && linkLabel && (
          <a href={href} target="_blank" rel="noreferrer">{linkLabel} &rsaquo;</a>
        )}
      </div>
    </div>
  );
}
