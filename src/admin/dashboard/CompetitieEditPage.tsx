import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import {
  AdminPage,
  Window,
  PageHeader,
  Section,
  Field,
  FieldRow,
  Input,
  DateInput,
  NumberInput,
  SearchableSelect,
  SegmentedControl,
  RepeatableList,
  RelationMultiSelect,
  Notice,
  Loading,
  SaveBar,
  UnsavedGuard,
  releaseUnsavedGuards,
  useSaveState,
  adminToast,
} from '../ui';
import { usePageForm } from '../lib';
import { LEVEL_OPTIONS } from './edusportUi';
import { COMPETITII_TO, COMPETITIE_EDIT_TO } from './menu';

/**
 * EduSport admin — custom "Competiție" edit page (replaces the default
 * content-manager edit view for api::competition.competition).
 *
 * Compact single-column form. Relations (sportspeople) are read via the
 * content-manager relations endpoint and written as { set:[{id}] }. The results
 * list edits the participantData json array. The canonical json shape consumed
 * by the public site is { documentId, name, category, placement, score }, so the
 * editor keeps those keys (fields labelled Sportiv / Loc / Punctaj) and
 * preserves any existing category value rather than dropping site data.
 *
 * Built on the shared admin UI (src/admin/ui): usePageForm + the floating
 * SaveBar + UnsavedGuard, toasts for feedback.
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
const LEVEL_SEGMENTS = LEVEL_OPTIONS.map((o) => ({ value: o.value as string, label: o.label }));

// Page-local layout, tokens only. No backticks inside.
const COMPETITIE_CSS = `
.ui-root .cp-narrow{max-width:760px;width:100%}
.ui-root .cp-res{display:grid;grid-template-columns:minmax(0,52fr) minmax(0,18fr) minmax(0,22fr);gap:var(--ui-space-3);align-items:start}
@media (max-width:640px){.ui-root .cp-res{grid-template-columns:1fr 1fr}.ui-root .cp-res > :first-child{grid-column:1 / -1}}
`;

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
function toForm(e: any): FormState {
  const participants: Opt[] = Array.isArray(e?.sportspeople)
    ? e.sportspeople.map((x: any) => ({ id: x.id, documentId: x.documentId, name: x.name ?? '' }))
    : [];
  return {
    name: e?.name ?? '',
    date: e?.date ?? '',
    location: e?.location ?? '',
    level: e?.level ?? 'national',
    season: e?.season ?? '',
    participants,
    results: parseResults(e?.participantData),
  };
}
function buildBody(form: FormState) {
  return {
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
  };
}

type Missing = { name: boolean; date: boolean; season: boolean };

export default function CompetitieEditPage() {
  const { get, put, post } = useFetchClient();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search || window.location.search);
  const id = params.get('id') || '';
  const isNew = !id;

  const save = useSaveState();
  const [loaded, setLoaded] = React.useState<FormState>(EMPTY);
  const form = usePageForm<FormState>(loaded, save);
  const v = form.value;
  const upd = form.patch;

  const [loading, setLoading] = React.useState(!isNew);
  const [error, setError] = React.useState(false);
  const [showErrors, setShowErrors] = React.useState(false);
  const [sportspeople, setSportspeople] = React.useState<Opt[]>([]);
  const loadedFor = React.useRef<string>('');

  React.useEffect(() => {
    get(SPORTSPERSON_LOOKUP)
      .then((res: any) => setSportspeople(relResults(res)))
      .catch(() => {});
  }, [get]);

  const fetchEntry = React.useCallback(
    async (docId: string): Promise<FormState> => {
      const main: any = await get(CT_WITH_REL(docId));
      return toForm(main?.data?.data ?? main?.data);
    },
    [get],
  );

  React.useEffect(() => {
    if (isNew) {
      loadedFor.current = '';
      setLoaded(EMPTY);
      setLoading(false);
      setError(false);
      return;
    }
    if (loadedFor.current === id) return;
    let off = false;
    setLoading(true);
    setError(false);
    fetchEntry(id)
      .then((f) => {
        if (off) return;
        loadedFor.current = id;
        setLoaded(f);
      })
      .catch(() => !off && setError(true))
      .finally(() => !off && setLoading(false));
    return () => {
      off = true;
    };
  }, [id, isNew, fetchEntry]);

  const missing: Missing = { name: !v.name.trim(), date: !v.date, season: !v.season.trim() };

  const onSave = () => {
    const first = missing.name
      ? 'Numele este obligatoriu.'
      : missing.date
        ? 'Data este obligatorie.'
        : missing.season
          ? 'Sezonul este obligatoriu.'
          : null;
    if (first) {
      setShowErrors(true);
      adminToast.error(first);
      return;
    }
    setShowErrors(false);
    const body = buildBody(v);
    let createdId: string | null = null;
    void save
      .run(async () => {
        if (isNew) {
          const res: any = await post(CT, body);
          const newId = (res?.data?.data ?? res?.data)?.documentId;
          if (newId) {
            const fresh = await fetchEntry(newId).catch(() => null);
            if (fresh) {
              loadedFor.current = newId;
              setLoaded(fresh);
            }
            createdId = newId;
          }
        } else {
          await put(`${CT}/${id}`, body);
          const fresh = await fetchEntry(id);
          loadedFor.current = id;
          setLoaded(fresh);
        }
      }, 'Salvarea a eșuat. Verifică datele și încearcă din nou.')
      .then((ok) => {
        if (ok && createdId) {
          releaseUnsavedGuards();
          navigate(`${COMPETITIE_EDIT_TO}?id=${createdId}`, { replace: true });
        }
      });
  };

  const discard = () => {
    setShowErrors(false);
    form.reset();
  };

  // Participants are picked by documentId; the form keeps { id, documentId, name } (the save sends { set: [{ id }] }).
  const participantOptions = sportspeople.map((s) => ({ documentId: s.documentId, label: s.name }));
  const participantByDoc = new Map([...sportspeople, ...v.participants].map((o) => [o.documentId, o]));
  const resultOptions = sportspeople.map((s) => ({ value: s.documentId, label: s.name }));
  const ready = !loading && !error;

  return (
    <AdminPage>
      <style>{COMPETITIE_CSS}</style>
      <Window>
        <PageHeader
          back={{ to: COMPETITII_TO, label: 'Competiții' }}
          title={isNew ? 'Adaugă competiție' : 'Editează competiție'}
          subtitle={isNew ? 'Completează datele competiției.' : loaded.name}
        />

        {loading ? (
          <Loading />
        ) : error ? (
          <div className="ui-body">
            <Notice tone="danger">Nu am putut încărca competiția.</Notice>
          </div>
        ) : (
          <div className="ui-body">
            <div className="cp-narrow ui-stack">
              <Section title="Detalii">
                <div className="ui-stack">
                  <Field label="Nume" required error={showErrors && missing.name ? 'Numele este obligatoriu.' : undefined}>
                    <Input value={v.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Numele competiției" />
                  </Field>
                  <FieldRow>
                    <Field label="Data" required error={showErrors && missing.date ? 'Data este obligatorie.' : undefined}>
                      <DateInput value={v.date || null} onChange={(d) => upd({ date: d ?? '' })} />
                    </Field>
                    <Field label="Locație">
                      <Input value={v.location} onChange={(e) => upd({ location: e.target.value })} placeholder="Oraș / arenă" />
                    </Field>
                  </FieldRow>
                  <FieldRow>
                    <div className="ui-field">
                      <span className="ui-label" id="cp-level-label">
                        Nivel
                      </span>
                      <SegmentedControl
                        aria-labelledby="cp-level-label"
                        options={LEVEL_SEGMENTS}
                        value={v.level}
                        onChange={(level) => upd({ level })}
                      />
                    </div>
                    <Field label="Sezon" required error={showErrors && missing.season ? 'Sezonul este obligatoriu.' : undefined}>
                      <Input value={v.season} onChange={(e) => upd({ season: e.target.value })} placeholder="ex. 2024-2025" />
                    </Field>
                  </FieldRow>
                </div>
              </Section>

              <Section title="Sportivi participanți">
                <Field label="Sportivi participanți" hideLabel>
                  <RelationMultiSelect
                    value={v.participants.map((p) => p.documentId)}
                    options={participantOptions}
                    labels={Object.fromEntries(v.participants.map((p) => [p.documentId, p.name]))}
                    placeholder="Caută și adaugă sportiv..."
                    onChange={(ids) => upd({ participants: ids.map((d) => participantByDoc.get(d)).filter((o): o is Opt => !!o) })}
                  />
                </Field>
              </Section>

              <Section title="Rezultate participanți">
                <RepeatableList<ResultRow>
                  items={v.results}
                  onChange={(results) => upd({ results })}
                  getKey={(_, i) => i}
                  itemLabel={(r, i) => (r.name ? `rezultatul lui ${r.name}` : `rezultatul ${i + 1}`)}
                  newItem={() => ({ documentId: '', name: '', category: '', placement: null, score: null })}
                  addLabel="Adaugă rezultat"
                  emptyLabel="Niciun rezultat adăugat."
                  aria-label="Rezultate participanți"
                  renderRow={(r, _i, row) => (
                    <div className="cp-res">
                      <Field label="Sportiv">
                        <SearchableSelect
                          value={r.documentId || null}
                          valueLabel={r.name || undefined}
                          options={resultOptions}
                          placeholder={r.name || 'Alege sportiv...'}
                          onChange={(val, opt) => row.update({ documentId: val ?? '', name: opt?.label ?? r.name })}
                        />
                      </Field>
                      <Field label="Loc">
                        <NumberInput value={r.placement} min={0} onChange={(placement) => row.update({ placement })} label="locul" />
                      </Field>
                      <Field label="Punctaj">
                        <NumberInput value={r.score} min={0} step={0.01} onChange={(score) => row.update({ score })} label="punctajul" />
                      </Field>
                    </div>
                  )}
                />
              </Section>
            </div>
          </div>
        )}

        {ready && <SaveBar {...save.bar} onSave={onSave} onDiscard={discard} />}
      </Window>
      <UnsavedGuard when={form.dirty} />
    </AdminPage>
  );
}
