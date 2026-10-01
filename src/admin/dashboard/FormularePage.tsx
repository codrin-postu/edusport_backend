import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { AdminPage, Window, PageHeader, Button, StatusBadge } from '../ui';
import { FORM_EDITOR_TO } from './menu';
import { FORM_DEFS, fetchNewCount, fetchTotalCount, tileStyle, type AdminFormDef } from './formDefs';

/**
 * EduSport admin — "Formulare" hub page.
 *
 * Registered as an admin route (see ./menu.tsx) so it renders inside Strapi's
 * providers and can use useFetchClient / useNavigate. Lists the site forms as
 * rows with a live count of new entries, then routes to each form's results
 * view. Built on the shared admin UI (src/admin/ui): AdminPage, Window,
 * PageHeader, Button, StatusBadge; light and dark through the --theme-* tokens.
 *
 * Counts are real, fetched via the shared helpers in ./formDefs (each form
 * declares its count endpoint + dialect there; total = pagination total,
 * "noi" = status "Nou" / triageStatus "new").
 */

interface Counts {
  total: number | null;
  noi: number | null;
  loaded: boolean;
}

// Page-local row layout, tokens only. Kept free of backticks.
const CSS = `
.ui-root .fm-list{list-style:none;margin:0;padding:0}
.ui-root .fm-row{display:flex;align-items:center;gap:14px;padding:14px 18px;border-bottom:1px solid var(--theme-border-subtle);flex-wrap:wrap}
.ui-root .fm-row:last-child{border-bottom:none}
.ui-root .fm-row.soon{background:var(--theme-surface-subtle)}
.ui-root .fm-tile{width:40px;height:40px;border-radius:var(--ui-radius-sm);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;flex-shrink:0;letter-spacing:.02em}
.ui-root .fm-main{flex:1;min-width:200px}
.ui-root .fm-nm{font-size:14.5px;font-weight:700;line-height:1.2;display:flex;align-items:center;gap:9px;flex-wrap:wrap;color:var(--theme-text)}
.ui-root .fm-meta{font-size:11.5px;color:var(--theme-text-muted);margin-top:3px}
.ui-root .fm-desc{font-size:12px;color:var(--theme-text-secondary);margin-top:4px;max-width:520px}
.ui-root .fm-counts{display:flex;flex-direction:column;align-items:flex-end;gap:1px;min-width:92px;flex-shrink:0}
.ui-root .fm-noi-line{display:flex;align-items:baseline;gap:5px}
.ui-root .fm-noi-n{font-size:18px;font-weight:800;line-height:1;color:var(--theme-danger)}
.ui-root .fm-noi-n.zero{color:var(--theme-text-muted)}
.ui-root .fm-noi-l{font-size:11px;font-weight:600;color:var(--theme-text-muted)}
.ui-root .fm-tot{font-size:11px;color:var(--theme-text-muted);white-space:nowrap;margin-top:2px}
.ui-root .fm-na{font-size:11px;color:var(--theme-text-muted)}
.ui-root .fm-acts{display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap}
`;

export default function FormularePage() {
  const { get } = useFetchClient();
  const navigate = useNavigate();

  const [counts, setCounts] = React.useState<Record<string, Counts>>(() =>
    Object.fromEntries(FORM_DEFS.map((d) => [d.key, { total: null, noi: null, loaded: false }]))
  );

  // --- counts for every live form (shared defs; per-form endpoint + dialect,
  // total + "noi" both read from pagination.total with pageSize 1).
  React.useEffect(() => {
    let off = false;
    FORM_DEFS.filter((d) => d.live).forEach((def) => {
      Promise.all([fetchTotalCount(get, def), fetchNewCount(get, def)]).then(([t, n]) => {
        if (off) return;
        setCounts((c) => ({ ...c, [def.key]: { total: t, noi: n, loaded: true } }));
      });
    });
    return () => {
      off = true;
    };
  }, [get]);

  const renderCounts = (f: AdminFormDef) => {
    if (!f.live) return <StatusBadge tone="neutral" size="md">În curând</StatusBadge>;
    const c = counts[f.key];
    if (!c || !c.loaded) return <span className="fm-na">Se încarcă...</span>;
    if (c.total == null) return <span className="fm-na">Indisponibil</span>;
    const noi = c.noi ?? 0;
    return (
      <>
        <span className="fm-noi-line">
          <span className={`fm-noi-n ui-num${noi === 0 ? ' zero' : ''}`}>{noi}</span>
          <span className="fm-noi-l">{noi === 1 ? 'nou' : 'noi'}</span>
        </span>
        <span className="fm-tot ui-num">din {c.total} în total</span>
      </>
    );
  };

  return (
    <AdminPage>
      <style>{CSS}</style>
      <Window>
        <PageHeader
          title="Formulare"
          subtitle="Formularele publice ale site-ului, cu răspunsurile primite și acces la rezultate."
          actions={
            <Button variant="secondary" disabled title="În curând">
              + Formular nou
            </Button>
          }
        />

        <ul className="fm-list">
          {FORM_DEFS.map((f) => (
            <li key={f.key} className={`fm-row${f.live ? '' : ' soon'}`}>
              {/* Tile colour is form config (formDefs.ts): a --theme-tile-* pair. */}
              <span className="fm-tile" style={tileStyle(f.tileColor)} aria-hidden="true">
                {f.initials}
              </span>

              <div className="fm-main">
                <div className="fm-nm">
                  {f.name}
                  <StatusBadge tone={f.mode === 'Tabel' ? 'primary' : 'warning'}>{f.mode}</StatusBadge>
                </div>
                <div className="fm-meta ui-num">
                  {f.questions} întrebări · mod {f.mode}
                </div>
                <div className="fm-desc">{f.desc}</div>
              </div>

              <div className="fm-counts">{renderCounts(f)}</div>

              <div className="fm-acts">
                <Button
                  size="sm"
                  disabled={!f.live || !f.resultsTo}
                  title={f.live ? undefined : 'În curând'}
                  onClick={() => f.resultsTo && navigate(f.resultsTo)}
                >
                  {f.resultsLabel ?? 'Rezultate'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!f.live}
                  title={f.live ? undefined : 'În curând'}
                  onClick={() => f.live && navigate(`${FORM_EDITOR_TO}?type=${f.key}`)}
                >
                  Editează întrebări
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Window>
    </AdminPage>
  );
}
