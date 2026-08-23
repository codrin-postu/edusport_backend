import * as React from 'react';
import { injectStyles } from './injectStyles';
import { useField, useForm, useFetchClient } from '@strapi/admin/strapi-admin';
import {
  Box,
  Button,
  Flex,
  IconButton,
  TextInput,
  Typography,
} from '@strapi/design-system';
import { Plus, Trash } from '@strapi/icons';
import SearchableSelect from './SearchableSelect';
import QuickCreateSportspersonModal, { type CreatedSportsperson } from './QuickCreateSportspersonModal';

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

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

function ParticipantRow({
  row,
  sportspeople,
  hasError,
  onChange,
  onRemove,
  onCreateSportsperson,
}: {
  row: Participant;
  sportspeople: Sportsperson[];
  hasError: boolean;
  onChange: (patch: Partial<Participant>) => void;
  onRemove: () => void;
  onCreateSportsperson: (typedName: string) => void;
}) {
  const [scoreText, setScoreText] = React.useState(() =>
    row.score !== null ? String(row.score) : '',
  );

  // Sync if parent resets the value externally (e.g. on load)
  React.useEffect(() => {
    const parsed = parseFloat(scoreText);
    if (parsed !== row.score && !(isNaN(parsed) && row.score === null)) {
      setScoreText(row.score !== null ? String(row.score) : '');
    }
  }, [row.score]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box>
      {injectStyles('plugin-participant-row-styles', `
        .participant-row { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px; border-radius: 4px; }
        .participant-row > .pr-sportiv  { flex: 3 1 260px; min-width: 0; }
        .participant-row > .pr-category { flex: 2 1 220px; min-width: 0; }
        .participant-row > .pr-number   { flex: 1 1 100px; min-width: 0; }
        .participant-row > .pr-delete   { display: flex; align-items: flex-end; }
        @media (max-width: 630px) {
          .participant-row > .pr-sportiv,
          .participant-row > .pr-category { flex-basis: 100%; }
        }
      `)}
      <div
        className="participant-row"
        style={{
          background: 'var(--strapi-neutral100, #f6f6f9)',
          border: `1px solid ${hasError ? 'var(--strapi-danger600, #d02b20)' : 'var(--strapi-neutral200, #dcdce4)'}`,
        }}
      >
        <div className="pr-sportiv">
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--strapi-neutral600, #666687)', marginBottom: 4 }}>Sportiv</label>
          <SearchableSelect
            aria-label="Sportiv"
            value={row.documentId || ''}
            onChange={(val) => {
              const sp = sportspeople.find((s) => s.documentId === val);
              if (sp) onChange({ documentId: sp.documentId, name: sp.name });
            }}
            options={sportspeople.map((sp) => ({ value: sp.documentId, label: sp.name }))}
            placeholder="Caută sportiv..."
            creatable
            onCreateOption={onCreateSportsperson}
            createMessage={(v) => `Adaugă sportiv nou: „${v}"`}
            noOptionsMessage={() => 'Niciun sportiv găsit'}
          />
        </div>

        <div className="pr-category">
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--strapi-neutral600, #666687)', marginBottom: 4 }}>Categorie</label>
          <TextInput
            aria-label="Categorie"
            value={row.category}
            placeholder="ex: Avansați – Juniors"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ category: e.target.value })}
          />
        </div>

        <div className="pr-number">
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--strapi-neutral600, #666687)', marginBottom: 4 }}>Loc</label>
          <TextInput
            aria-label="Loc"
            inputMode="numeric"
            value={row.placement !== null ? String(row.placement) : ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const v = e.target.value.replace(/[^0-9]/g, '');
              onChange({ placement: v === '' ? null : parseInt(v, 10) });
            }}
            placeholder="—"
          />
        </div>

        <div className="pr-number">
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--strapi-neutral600, #666687)', marginBottom: 4 }}>Scor</label>
          <TextInput
            aria-label="Scor"
            inputMode="decimal"
            value={scoreText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const v = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
              setScoreText(v);
              if (v === '' || v.endsWith('.')) {
                if (v === '') onChange({ score: null });
              } else {
                onChange({ score: parseFloat(v) });
              }
            }}
            placeholder="—"
          />
        </div>

        <div className="pr-delete">
          <IconButton label="Șterge participant" onClick={onRemove}>
            <Trash />
          </IconButton>
        </div>
      </div>

      {hasError && (
        <Typography variant="pi" textColor="danger600" style={{ marginTop: 4 }}>
          Selectează un sportiv din listă sau creează unul nou.
        </Typography>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

export default function ParticipantsEditor({ name }: Props) {
  const field = useField<unknown>(name);
  const setFormErrors = useForm('ParticipantsEditor', (s: any) => s.setErrors);
  const { get } = useFetchClient();

  const [rows, setRows] = React.useState<Participant[]>(() =>
    parseFieldValue(field.value),
  );
  const [sportspeople, setSportspeople] = React.useState<Sportsperson[]>([]);
  // Don't render rows until sportspeople are loaded — prevents Combobox from
  // displaying the raw documentId hash when no matching option exists yet.
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
  React.useEffect(() => { getRef.current = get; });
  React.useEffect(() => {
    getRef.current(
      '/content-manager/collection-types/api::sportsperson.sportsperson' +
      '?page=1&pageSize=200&sort=name:ASC',
    )
      .then((res: any) => {
        const results: any[] = res?.data?.results ?? [];
        setSportspeople(
          results.map((sp: any) => ({ documentId: sp.documentId ?? '', name: sp.name ?? '' })),
        );
        setSpLoaded(true);
      })
      .catch(() => { setSpLoaded(true); }); // unblock on error too
  }, []);

  // Push / clear a form-level error whenever rows change
  React.useEffect(() => {
    if (!spLoaded) return;
    const hasInvalid = rows.some((r) => !r.documentId);
    if (typeof setFormErrors === 'function') {
      setFormErrors({
        [name]: hasInvalid
          ? 'Toți participanții trebuie să aibă un sportiv selectat.'
          : undefined,
      });
    }
  }, [rows, spLoaded, name, setFormErrors]);

  const commit = (next: Participant[]) => {
    setRows(next);
    field.onChange(name, next);
  };

  const addRow = () =>
    commit([...rows, { documentId: '', name: '', category: '', placement: null, score: null }]);

  const updateRow = (i: number, patch: Partial<Participant>) =>
    commit(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const removeRow = (i: number) => commit(rows.filter((_, idx) => idx !== i));

  const openCreateFor = (rowIndex: number, typedName: string) => {
    pendingRowRef.current = rowIndex;
    setCreateInitialName(typedName);
    setCreateModalOpen(true);
  };

  const handleCreated = (sp: CreatedSportsperson) => {
    setSportspeople((prev) =>
      [...prev, sp].sort((a, b) => a.name.localeCompare(b.name)),
    );
    const idx = pendingRowRef.current;
    if (idx !== null) updateRow(idx, { documentId: sp.documentId, name: sp.name });
    pendingRowRef.current = null;
  };

  return (
    <Box>
      <Flex direction="column" gap={2} alignItems="stretch">
        {!spLoaded && (
          <Box padding={3}>
            <Typography variant="pi" textColor="neutral500">Se încarcă sportivii…</Typography>
          </Box>
        )}

        {spLoaded && rows.length === 0 && (
          <Box padding={4} background="neutral100" style={{ borderRadius: 4, textAlign: 'center' }}>
            <Typography variant="pi" textColor="neutral500">
              Niciun participant adăugat încă.
            </Typography>
          </Box>
        )}

        {spLoaded && rows.map((row, i) => (
          <ParticipantRow
            key={i}
            row={row}
            sportspeople={sportspeople}
            hasError={!row.documentId}
            onChange={(patch) => updateRow(i, patch)}
            onRemove={() => removeRow(i)}
            onCreateSportsperson={(typedName) => openCreateFor(i, typedName)}
          />
        ))}

        {spLoaded && (
          <Button
            startIcon={<Plus />}
            variant="secondary"
            onClick={addRow}
            style={{ alignSelf: 'flex-start' }}
          >
            Adaugă participant
          </Button>
        )}
      </Flex>

      <QuickCreateSportspersonModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        initialName={createInitialName}
        onCreate={handleCreated}
      />
    </Box>
  );
}
