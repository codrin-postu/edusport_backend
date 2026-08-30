import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { EDU_CSS, LEVEL_OPTIONS } from './edusportUi';
import { COMPETITII_TO, COMPETITIE_EDIT_TO } from './menu';

/**
 * EduSport admin — custom "Competiție" edit page (replaces the default
 * content-manager edit view for api::competition.competition).
 *
 * Compact single-column form. Relations (sportspeople) are read via the
 * content-manager relations endpoint and written as { set:[{id}] }. The results
 * table edits the participantData json array. The canonical json shape consumed
 * by the public site is { documentId, name, category, placement, score }, so the
 * editor keeps those keys (columns labelled Sportiv / Loc / Punctaj) and
 * preserves any existing category value rather than dropping site data.
 */

const CT = '/content-manager/collection-types/api::competition.competition';
// Read the linked sportspeople names inline. The dedicated relations endpoint
// returns nothing for this relation (competition has no draft/publish but the
// sportsperson target does), so a populate override is the reliable read.
const CT_WITH_REL = (docId: string) => `${CT}/${docId}?populate[sportspeople][fields][0]=name`;
// Sportsperson is draft&publish; the competition relation links the PUBLISHED
// version, so the option list must be fetched with status=published to get the
// writable ids.
const SPORTSPERSON_CT = '/content-manager/collection-types/api::sportsperson.sportsperson';
const SPORTSPERSON_LOOKUP = `${SPORTSPERSON_CT}?page=1&pageSize=200&sort=name:ASC&status=published`;

interface Opt {
  id: number;
  documentId: string;
  name: string;
}
interface ResultRow {
  documentId: string;
  name: string;
  category: string;
  placement: number | null;
  score: number | null;
}
interface FormState {
  name: string;
  date: string;
  location: string;
  level: string;
  season: string;
  participants: Opt[];
  results: ResultRow[];
}

const EMPTY: FormState = { name: '', date: '', location: '', level: 'national', season: '', participants: [], results: [] };

function relResults(res: any): Opt[] {
  const r = res?.data?.results ?? res?.data?.data ?? [];
  return (Array.isArray(r) ? r : []).map((x: any) => ({ id: x.id, documentId: x.documentId, name: x.name ?? '' }));
}
function parseResults(v: unknown): ResultRow[] {
  const arr = Array.isArray(v) ? v : typeof v === 'string' && v.trim() ? safeParse(v) : [];
  return arr.map((p: any) => ({
    documentId: p?.documentId ?? '',
    name: p?.name ?? '',
    category: p?.category ?? '',
    placement: typeof p?.placement === 'number' ? p.placement : p?.placement != null && p.placement !== '' ? Number(p.placement) : null,
    score: typeof p?.score === 'number' ? p.score : p?.score != null && p.score !== '' ? Number(p.score) : null,
  }));
}
function safeParse(s: string): any[] {
  try {
    const p = JSON.parse(s);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

// relation multi-select box (sportspeople participants)
function RelPicker({ value, options, onChange }: { value: Opt[]; options: Opt[]; onChange: (next: Opt[]) => void }) {
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const boxRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const selectedIds = new Set(value.map((v) => v.id));
  const matches = options.filter((o) => !selectedIds.has(o.id) && o.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="relbox" ref={boxRef}>
      {value.length > 0 && (
        <div className="tags">
          {value.map((v) => (
            <span className="tag" key={v.id}>
              {v.name}
              <button type="button" className="x" aria-label="Elimină" onClick={() => onChange(value.filter((x) => x.id !== v.id))}>
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="addwrap">
        <input
          placeholder="Caută și adaugă sportiv..."
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
        />
        {open && (
          <div className="relmenu">
            {matches.length === 0 ? (
              <div className="none">Niciun rezultat</div>
            ) : (
              matches.slice(0, 30).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onChange([...value, o]);
                    setQ('');
                  }}
                >
                  {o.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CompetitieEditPage() {
  const { get, put, post } = useFetchClient();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search || window.location.search);
  const id = params.get('id') || '';
  const isNew = !id;

  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [loading, setLoading] = React.useState(!isNew);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [msg, setMsg] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [sportspeople, setSportspeople] = React.useState<Opt[]>([]);

  const upd = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  React.useEffect(() => {
    get(SPORTSPERSON_LOOKUP)
      .then((res: any) => setSportspeople(relResults(res)))
      .catch(() => {});
  }, [get]);

  const load = React.useCallback(
    (docId: string) => {
      setLoading(true);
      setError(false);
      get(CT_WITH_REL(docId))
        .then((main: any) => {
          const e = main?.data?.data ?? main?.data;
          const participants: Opt[] = Array.isArray(e?.sportspeople)
            ? e.sportspeople.map((x: any) => ({ id: x.id, documentId: x.documentId, name: x.name ?? '' }))
            : [];
          setForm({
            name: e?.name ?? '',
            date: e?.date ?? '',
            location: e?.location ?? '',
            level: e?.level ?? 'national',
            season: e?.season ?? '',
            participants,
            results: parseResults(e?.participantData),
          });
        })
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    },
    [get],
  );

  React.useEffect(() => {
    if (isNew) {
      setForm(EMPTY);
      setLoading(false);
      return;
    }
    load(id);
  }, [id, isNew, load]);

  const buildBody = () => ({
    name: form.name,
    date: form.date || null,
    location: form.location || null,
    level: form.level,
    season: form.season,
    participantData: form.results.map((r) => ({
      documentId: r.documentId || null,
      name: r.name,
      category: r.category,
      placement: r.placement,
      score: r.score,
    })),
    sportspeople: { set: form.participants.map((p) => ({ id: p.id })) },
  });

  const save = async () => {
    if (!form.name.trim()) {
      setMsg({ kind: 'err', text: 'Numele este obligatoriu.' });
      return;
    }
    if (!form.date) {
      setMsg({ kind: 'err', text: 'Data este obligatorie.' });
      return;
    }
    if (!form.season.trim()) {
      setMsg({ kind: 'err', text: 'Sezonul este obligatoriu.' });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const body = buildBody();
      if (isNew) {
        const res: any = await post(CT, body);
        const newId = (res?.data?.data ?? res?.data)?.documentId;
        setMsg({ kind: 'ok', text: 'Competiție creată.' });
        if (newId) navigate(`${COMPETITIE_EDIT_TO}?id=${newId}`, { replace: true });
      } else {
        await put(`${CT}/${id}`, body);
        setMsg({ kind: 'ok', text: 'Modificările au fost salvate.' });
        load(id);
      }
    } catch {
      setMsg({ kind: 'err', text: 'Salvarea a eșuat. Verifică datele și încearcă din nou.' });
    } finally {
      setSaving(false);
    }
  };

  const addResult = () => upd({ results: [...form.results, { documentId: '', name: '', category: '', placement: null, score: null }] });
  const updResult = (i: number, patch: Partial<ResultRow>) => upd({ results: form.results.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const removeResult = (i: number) => upd({ results: form.results.filter((_, j) => j !== i) });

  return (
    // `pce` opts our custom "Salvează" buttons out of the global admin SaveBar tagger.
    <div className="eduf pce">
      <style>{EDU_CSS}</style>
      <div className="win">
        <div className="hd">
          <div>
            <h1>{isNew ? 'Adaugă competiție' : 'Editează competiție'}</h1>
            <p>{isNew ? 'Completează datele competiției.' : form.name}</p>
          </div>
          <div className="hd-right">
            <button className="btn" type="button" onClick={() => navigate(COMPETITII_TO)}>
              Înapoi
            </button>
            <button className="btn pri" type="button" onClick={save} disabled={saving || loading}>
              {saving ? 'Se salvează...' : 'Salvează'}
            </button>
          </div>
        </div>

        {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

        {loading ? (
          <div className="empty">Se încarcă...</div>
        ) : error ? (
          <div className="empty">Nu am putut încărca competiția.</div>
        ) : (
          <div className="body" style={{ maxWidth: 760 }}>
            <div className="fld">
              <label>Nume</label>
              <input value={form.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Numele competiției" />
            </div>
            <div className="row">
              <div className="fld">
                <label>Data</label>
                <input type="date" value={form.date} onChange={(e) => upd({ date: e.target.value })} />
              </div>
              <div className="fld">
                <label>Locație</label>
                <input value={form.location} onChange={(e) => upd({ location: e.target.value })} placeholder="Oraș / arenă" />
              </div>
            </div>
            <div className="row">
              <div className="fld">
                <label>Nivel</label>
                <select value={form.level} onChange={(e) => upd({ level: e.target.value })}>
                  {LEVEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fld">
                <label>Sezon</label>
                <input value={form.season} onChange={(e) => upd({ season: e.target.value })} placeholder="ex. 2024-2025" />
              </div>
            </div>

            <div className="sec">
              <div className="sh">Sportivi participanți</div>
              <div className="sb">
                <RelPicker value={form.participants} options={sportspeople} onChange={(next) => upd({ participants: next })} />
              </div>
            </div>

            <div className="sec">
              <div className="sh">
                Rezultate participanți
                <button type="button" className="addbtn" onClick={addResult}>
                  + Adaugă rezultat
                </button>
              </div>
              <div className="sb">
                {form.results.length === 0 ? (
                  <div className="hint">Niciun rezultat adăugat.</div>
                ) : (
                  <table className="mini">
                    <thead>
                      <tr>
                        <th style={{ width: '52%' }}>Sportiv</th>
                        <th style={{ width: '18%' }}>Loc</th>
                        <th style={{ width: '22%' }}>Punctaj</th>
                        <th className="act" />
                      </tr>
                    </thead>
                    <tbody>
                      {form.results.map((r, i) => (
                        <tr key={i}>
                          <td>
                            <select
                              value={r.documentId}
                              onChange={(e) => {
                                const sp = sportspeople.find((s) => s.documentId === e.target.value);
                                updResult(i, { documentId: e.target.value, name: sp?.name ?? r.name });
                              }}
                            >
                              <option value="">{r.name || 'Alege sportiv...'}</option>
                              {sportspeople.map((s) => (
                                <option key={s.documentId} value={s.documentId}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              inputMode="numeric"
                              value={r.placement != null ? String(r.placement) : ''}
                              placeholder="—"
                              onChange={(e) => {
                                const v = e.target.value.replace(/[^0-9]/g, '');
                                updResult(i, { placement: v === '' ? null : parseInt(v, 10) });
                              }}
                            />
                          </td>
                          <td>
                            <input
                              inputMode="decimal"
                              value={r.score != null ? String(r.score) : ''}
                              placeholder="—"
                              onChange={(e) => {
                                const v = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                                updResult(i, { score: v === '' || v.endsWith('.') ? (v === '' ? null : r.score) : parseFloat(v) });
                              }}
                            />
                          </td>
                          <td className="act">
                            <button type="button" className="rm" aria-label="Șterge rezultat" onClick={() => removeResult(i)}>
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="pa">
            <button className="btn" type="button" onClick={() => navigate(COMPETITII_TO)}>
              Înapoi
            </button>
            <div className="grow" />
            <button className="btn pri" type="button" onClick={save} disabled={saving}>
              {saving ? 'Se salvează...' : 'Salvează'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
