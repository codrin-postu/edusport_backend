import * as React from 'react';
import { useField, useForm, useFetchClient } from '@strapi/admin/strapi-admin';
// Shared admin UI. Same vite bundle (src/admin/app.tsx imports this plugin by
// relative path), so importing across the boundary is safe and type-checked.
import {
  Field,
  Input,
  NumberInput,
  SearchableSelect,
  RepeatableList,
  Loading,
  ensureAdminUi,
} from '../../../../admin/ui';
import QuickCreateSportspersonModal, { type CreatedSportsperson } from './QuickCreateSportspersonModal';

/**
 * Custom field (competition.participantData): sportspeople with category,
 * placement and score, stored as a JSON array of
 * { documentId, name, category, placement, score }.
 *
 * Built on the shared admin UI (src/admin/ui): RepeatableList (delete asks
 * first), Field, SearchableSelect (creatable: typing a new name opens the
 * quick-create modal), NumberInput. The root carries `.ui-root`, so it themes
 * inside the content-manager like the custom pages.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Participant {
  documentId: string;
  name: string;
  category: string;
  placement: number | null;
  score: number | null;
}

interface Sportsperson {
  documentId: string;
  name: string;
}

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

// Row layout, tokens only. No backticks inside.
const PARTICIPANTS_CSS = `
.ui-root .pe-row{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr) minmax(0,1fr) minmax(0,1fr);gap:var(--ui-space-3);align-items:start}
@media (max-width:760px){.ui-root .pe-row{grid-template-columns:1fr 1fr}.ui-root .pe-row > .pe-wide{grid-column:1 / -1}}
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseFieldValue(v: unknown): Participant[] {
  if (Array.isArray(v)) return v as Participant[];
  if (typeof v === 'string' && v.trim()) {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

const emptyRow = (): Participant => ({ documentId: '', name: '', category: '', placement: null, score: null });

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

export default function ParticipantsEditor({ name }: Props) {
  React.useInsertionEffect(() => ensureAdminUi(), []);
  const field = useField<unknown>(name);
  const setFormErrors = useForm('ParticipantsEditor', (s: any) => s.setErrors);
  const { get } = useFetchClient();

  const [rows, setRows] = React.useState<Participant[]>(() => parseFieldValue(field.value));
  const [sportspeople, setSportspeople] = React.useState<Sportsperson[]>([]);
  // Don't render rows until sportspeople are loaded, so a row never shows a
  // bare documentId while its option is still missing.
  const [spLoaded, setSpLoaded] = React.useState(false);

  // Quick-create modal state
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [createInitialName, setCreateInitialName] = React.useState('');
  const pendingRowRef = React.useRef<number | null>(null);

  // Sync rows when the form value changes externally (load, reset)
  React.useEffect(() => {
    setRows(parseFieldValue(field.value));
  }, [field.value]);

  // Fetch sportspeople via the admin content-manager API
  const getRef = React.useRef(get);
  React.useEffect(() => {
    getRef.current = get;
  });
  React.useEffect(() => {
    getRef
      .current('/content-manager/collection-types/api::sportsperson.sportsperson' + '?page=1&pageSize=200&sort=name:ASC')
      .then((res: any) => {
        const results: any[] = res?.data?.results ?? [];
        setSportspeople(results.map((sp: any) => ({ documentId: sp.documentId ?? '', name: sp.name ?? '' })));
        setSpLoaded(true);
      })
      .catch(() => {
        setSpLoaded(true);
      }); // unblock on error too
  }, []);

  // Push / clear a form-level error whenever rows change
  React.useEffect(() => {
    if (!spLoaded) return;
    const hasInvalid = rows.some((r) => !r.documentId);
    if (typeof setFormErrors === 'function') {
      setFormErrors({
        [name]: hasInvalid ? 'Toți participanții trebuie să aibă un sportiv selectat.' : undefined,
      });
    }
  }, [rows, spLoaded, name, setFormErrors]);

  const rowsRef = React.useRef(rows);
  rowsRef.current = rows;

  const commit = (next: Participant[]) => {
    setRows(next);
    field.onChange(name, next);
  };

  const updateRow = (i: number, patch: Partial<Participant>) =>
    commit(rowsRef.current.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const openCreateFor = (rowIndex: number, typedName: string) => {
    pendingRowRef.current = rowIndex;
    setCreateInitialName(typedName);
    setCreateModalOpen(true);
  };

  const handleCreated = (sp: CreatedSportsperson) => {
    setSportspeople((prev) => [...prev, sp].sort((a, b) => a.name.localeCompare(b.name)));
    const idx = pendingRowRef.current;
    if (idx !== null) updateRow(idx, { documentId: sp.documentId, name: sp.name });
    pendingRowRef.current = null;
  };

  const options = React.useMemo(() => sportspeople.map((sp) => ({ value: sp.documentId, label: sp.name })), [sportspeople]);

  return (
    <div className="ui-root">
      <style>{PARTICIPANTS_CSS}</style>
      {!spLoaded ? (
        <Loading text="Se încarcă sportivii…" />
      ) : (
        <RepeatableList<Participant>
          items={rows}
          onChange={commit}
          getKey={(_, i) => i}
          itemLabel={(r, i) => (r.name ? `participantul ${r.name}` : `participantul ${i + 1}`)}
          newItem={emptyRow}
          addLabel="Adaugă participant"
          emptyLabel="Niciun participant adăugat încă."
          confirmDelete="Participantul dispare din listă după ce salvezi competiția."
          aria-label="Participanți"
          renderRow={(row, i, api) => (
            <div className="pe-row">
              <Field
                label="Sportiv"
                className="pe-wide"
                error={!row.documentId ? 'Selectează un sportiv din listă sau creează unul nou.' : undefined}
              >
                <SearchableSelect
                  value={row.documentId || null}
                  valueLabel={row.name || undefined}
                  options={options}
                  placeholder="Caută sportiv..."
                  emptyLabel="Niciun sportiv găsit"
                  creatable
                  clearable={false}
                  onCreate={(typed) => {
                    openCreateFor(i, typed);
                    return null;
                  }}
                  onChange={(val, opt) => {
                    if (val && opt) api.update({ documentId: val, name: opt.label });
                  }}
                />
              </Field>
              <Field label="Categorie" className="pe-wide">
                <Input value={row.category} placeholder="ex: Avansați – Juniors" onChange={(e) => api.update({ category: e.target.value })} />
              </Field>
              <Field label="Loc">
                <NumberInput value={row.placement} min={0} label="locul" onChange={(placement) => api.update({ placement })} />
              </Field>
              <Field label="Scor">
                <NumberInput value={row.score} min={0} step={0.01} label="scorul" onChange={(score) => api.update({ score })} />
              </Field>
            </div>
          )}
        />
      )}

      <QuickCreateSportspersonModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        initialName={createInitialName}
        onCreate={handleCreated}
      />
    </div>
  );
}
