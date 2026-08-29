import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { INSCRIERI_TO, MESAJE_TO, FORM_EDITOR_TO } from './menu';

/**
 * EduSport admin — "Formulare" hub page.
 *
 * Registered as an admin route (see ./menu.tsx) so it renders inside Strapi's
 * providers and can use useFetchClient / useNavigate. Lists the site forms as
 * rows with a live count of new entries, then routes to each form's results
 * view. Light-only, using the shared admin tokens (system-ui, #fff, #dcdcdc
 * borders, accent #2138b8, danger #be3330, #d0d0d0 fields, squared buttons).
 *
 * Counts are real:
 *   - Înscriere cursuri reads the dedicated admin endpoint /api/forms/inscrieri
 *     (total = list length, "noi" = status "Nou").
 *   - Contact reads the content-manager collection API for contact-submission
 *     (total = pagination total, "noi" = triageStatus "new").
 * Forms without a backing collection (Voluntariat, Parteneri) are shown as
 * "în curând"; their counts are marked unavailable rather than invented.
 */

const CONTACT_UID = 'api::contact-submission.contact-submission';
const INSCRIERI_API = '/api/forms/inscrieri';

type Mode = 'Tabel' | 'Inbox';

interface FormDef {
  key: string;
  name: string;
  initials: string;
  color: string;
  questions: number;
  mode: Mode;
  desc: string;
  live: boolean; // false => "în curând", no results/counts yet
  resultsTo?: string;
  resultsLabel?: string;
}

const FORMS: FormDef[] = [
  {
    key: 'inscriere',
    name: 'Înscriere cursuri',
    initials: 'ÎC',
    color: '#2138b8',
    questions: 13,
    mode: 'Tabel',
    desc: 'Cererile de înscriere trimise din pagina publică de cursuri.',
    live: true,
    resultsTo: INSCRIERI_TO,
    resultsLabel: 'Rezultate',
  },
  {
    key: 'contact',
    name: 'Contact',
    initials: 'CT',
    color: '#00838f',
    questions: 4,
    mode: 'Inbox',
    desc: 'Mesajele trimise din formularul de contact.',
    live: true,
    resultsTo: MESAJE_TO,
    resultsLabel: 'Vezi mesajele',
  },
  {
    key: 'voluntariat',
    name: 'Voluntariat',
    initials: 'VO',
    color: '#1f7a4d',
    questions: 6,
    mode: 'Inbox',
    desc: 'Înscrierile de voluntariat. Colectarea nu este încă activă.',
    live: false,
  },
  {
    key: 'parteneri',
    name: 'Parteneri',
    initials: 'PA',
    color: '#e08a00',
    questions: 5,
    mode: 'Inbox',
    desc: 'Propunerile de parteneriat. Colectarea nu este încă activă.',
    live: false,
  },
];

interface Counts {
  total: number | null;
  noi: number | null;
  loaded: boolean;
}

const CSS = `
.esfm { font-family: system-ui, -apple-system, sans-serif; color: #1b1d26; background: #f6f7f9; min-height: 100%; padding: 16px 20px 40px; box-sizing: border-box; }
.esfm * { box-sizing: border-box; }
.esfm .num { font-variant-numeric: tabular-nums; }

.esfm-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.esfm-head h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -.01em; }
.esfm-head p { margin: 3px 0 0; font-size: 12.5px; color: #6a6e7a; }

.esfm-btn { font-family: inherit; font-size: 12.5px; font-weight: 600; padding: 8px 13px; border-radius: 4px; border: 1px solid #d0d0d0; background: #fff; color: #1b1d26; cursor: pointer; white-space: nowrap; }
.esfm-btn:hover { border-color: #b6bac4; background: #fafbff; }
.esfm-btn.pri { background: #2138b8; border-color: #2138b8; color: #fff; }
.esfm-btn.pri:hover { background: #1b2fa0; }
.esfm-btn:disabled { opacity: .55; cursor: default; }
.esfm-btn:disabled:hover { border-color: #d0d0d0; background: #fff; }

.esfm-list { background: #fff; border: 1px solid #dcdcdc; border-radius: 5px; overflow: hidden; }
.esfm-row { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-bottom: 1px solid #f0f1f4; }
.esfm-row:last-child { border-bottom: none; }
.esfm-row.soon { background: #fbfbfc; }

.esfm-tile { width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; color: #fff; flex-shrink: 0; letter-spacing: .02em; }

.esfm-main { flex: 1; min-width: 0; }
.esfm-main .nm { font-size: 14.5px; font-weight: 700; line-height: 1.2; display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.esfm-main .meta { font-size: 11.5px; color: #8a8d99; margin-top: 3px; }
.esfm-main .desc { font-size: 12px; color: #6a6e7a; margin-top: 4px; max-width: 520px; }

.esfm-chip { font-size: 10px; font-weight: 800; letter-spacing: .03em; border-radius: 4px; padding: 3px 8px; text-transform: uppercase; }
.esfm-chip.tabel { color: #2138b8; background: #eef1fb; }
.esfm-chip.inbox { color: #8a5a00; background: #fbf1df; }

.esfm-counts { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; min-width: 92px; flex-shrink: 0; }
.esfm-noi-line { display: flex; align-items: baseline; gap: 5px; }
.esfm-noi-n { font-size: 18px; font-weight: 800; line-height: 1; color: #be3330; }
.esfm-noi-n.zero { color: #9a9da8; }
.esfm-noi-l { font-size: 11px; font-weight: 600; color: #8a8d99; }
.esfm-tot { font-size: 11px; color: #a7aab3; white-space: nowrap; margin-top: 2px; }
.esfm-na { font-size: 11px; color: #a0a3ad; }
.esfm-soon-chip { font-size: 10px; font-weight: 800; letter-spacing: .03em; text-transform: uppercase; color: #6a6e7a; background: #eceef2; border: 1px solid #dcdfe6; border-radius: 4px; padding: 3px 9px; }

.esfm-acts { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
`;

export default function FormularePage() {
  const { get } = useFetchClient();
  const navigate = useNavigate();

  const [counts, setCounts] = React.useState<Record<string, Counts>>({
    inscriere: { total: null, noi: null, loaded: false },
    contact: { total: null, noi: null, loaded: false },
  });

  // --- Înscriere counts (dedicated admin endpoint, server-paginated).
  // Both calls default to season=active + archived excluded; we read
  // pagination.total rather than counting a full array. "noi" = status Nou.
  React.useEffect(() => {
    let off = false;
    const totalOf = (r: any) => (typeof r?.data?.pagination?.total === 'number' ? r.data.pagination.total : null);
    const nouFilter = JSON.stringify([{ col: 'status', op: 'equals', val: 'Nou' }]);
    const total = get(INSCRIERI_API, { params: { pageSize: 1 } }).then(totalOf).catch(() => null);
    const fresh = get(INSCRIERI_API, { params: { pageSize: 1, filters: nouFilter } }).then(totalOf).catch(() => null);
    Promise.all([total, fresh]).then(([t, n]) => {
      if (off) return;
      setCounts((c) => ({ ...c, inscriere: { total: t, noi: n, loaded: true } }));
    });
    return () => {
      off = true;
    };
  }, [get]);

  // --- Contact counts (content-manager collection API: total + filtered "new")
  React.useEffect(() => {
    let off = false;
    const total = get(`/content-manager/collection-types/${CONTACT_UID}`, { params: { page: 1, pageSize: 1 } })
      .then((r: any) => (typeof r?.data?.pagination?.total === 'number' ? r.data.pagination.total : null))
      .catch(() => null);
    const fresh = get(`/content-manager/collection-types/${CONTACT_UID}`, {
      params: { page: 1, pageSize: 1, 'filters[triageStatus][$eq]': 'new' },
    })
      .then((r: any) => (typeof r?.data?.pagination?.total === 'number' ? r.data.pagination.total : null))
      .catch(() => null);
    Promise.all([total, fresh]).then(([t, n]) => {
      if (off) return;
      setCounts((c) => ({ ...c, contact: { total: t, noi: n, loaded: true } }));
    });
    return () => {
      off = true;
    };
  }, [get]);

  const renderCounts = (f: FormDef) => {
    if (!f.live) return <span className="esfm-soon-chip">În curând</span>;
    const c = counts[f.key];
    if (!c || !c.loaded) return <span className="esfm-na">Se încarcă...</span>;
    if (c.total == null) return <span className="esfm-na">Indisponibil</span>;
    const noi = c.noi ?? 0;
    return (
      <>
        <span className="esfm-noi-line">
          <span className={`esfm-noi-n num ${noi === 0 ? 'zero' : ''}`}>{noi}</span>
          <span className="esfm-noi-l">{noi === 1 ? 'nou' : 'noi'}</span>
        </span>
        <span className="esfm-tot num">din {c.total} în total</span>
      </>
    );
  };

  return (
    <div className="esfm">
      <style>{CSS}</style>

      <div className="esfm-head">
        <div>
          <h1>Formulare</h1>
          <p>Formularele publice ale site-ului, cu răspunsurile primite și acces la rezultate.</p>
        </div>
        <button className="esfm-btn" type="button" disabled title="În curând">
          + Formular nou
        </button>
      </div>

      <div className="esfm-list">
        {FORMS.map((f) => (
          <div key={f.key} className={`esfm-row ${f.live ? '' : 'soon'}`}>
            <span className="esfm-tile" style={{ background: f.color }}>
              {f.initials}
            </span>

            <div className="esfm-main">
              <div className="nm">
                {f.name}
                <span className={`esfm-chip ${f.mode === 'Tabel' ? 'tabel' : 'inbox'}`}>{f.mode}</span>
              </div>
              <div className="meta num">
                {f.questions} întrebări · mod {f.mode}
              </div>
              <div className="desc">{f.desc}</div>
            </div>

            <div className="esfm-counts">{renderCounts(f)}</div>

            <div className="esfm-acts">
              <button
                className="esfm-btn pri"
                type="button"
                disabled={!f.live || !f.resultsTo}
                title={f.live ? undefined : 'În curând'}
                onClick={() => f.resultsTo && navigate(f.resultsTo)}
              >
                {f.resultsLabel ?? 'Rezultate'}
              </button>
              <button
                className="esfm-btn"
                type="button"
                disabled={!f.live}
                title={f.live ? undefined : 'În curând'}
                onClick={() => f.live && navigate(`${FORM_EDITOR_TO}?type=${f.key}`)}
              >
                Editează întrebări
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
