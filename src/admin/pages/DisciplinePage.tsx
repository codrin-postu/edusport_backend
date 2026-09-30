import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AdminPage,
  Window,
  PageHeader,
  Button,
  Field,
  Input,
  Modal,
  Notice,
  DataTable,
  type DataColumn,
  useSaveState,
} from '../ui';
import { ConfirmDialog } from '../ConfirmDialog';
import { useCollection, type Row } from '../lib';
import { DASHBOARD_TO } from '../dashboard/menu';
import { UID } from './routes';

/**
 * Discipline (/plugins/edusport-discipline): the discipline collection.
 *
 * Tiny content type (one required, unique `name` string) with no dedicated
 * component-preview editor - it was edited straight in the content-manager
 * list/edit view. List + create/edit in a Modal, delete with ConfirmDialog,
 * per docs/admin-ui/CUSTOM-PAGES.md ("Collections: Discipline and Momente
 * istoric = list + edit in a Modal"). A redirected entry URL arrives as
 * `?id=<documentId>`: that entry's modal opens automatically.
 */

interface Discipline {
  name: string;
}

interface Draft {
  documentId: string | null;
  name: string;
}

const DisciplinePage: React.FC = () => {
  const collection = useCollection<Discipline>(UID.discipline, { sort: 'name:ASC' });
  const [params, setParams] = useSearchParams();

  const [draft, setDraft] = React.useState<Draft | null>(null);
  const save = useSaveState();
  const openedFromUrl = React.useRef(false);

  const openNew = React.useCallback(() => {
    save.reset();
    setDraft({ documentId: null, name: '' });
  }, [save]);

  const openEdit = React.useCallback(
    (row: Row<Discipline>) => {
      save.reset();
      setDraft({ documentId: row.documentId, name: row.name });
    },
    [save],
  );

  const closeDraft = () => {
    if (save.saving) return;
    setDraft(null);
    save.reset();
    if (params.get('id')) {
      const next = new URLSearchParams(params);
      next.delete('id');
      setParams(next, { replace: true });
    }
  };

  // A redirected content-manager URL (?id=<documentId>) opens that entry's modal once.
  React.useEffect(() => {
    if (openedFromUrl.current || collection.loading) return;
    const id = params.get('id');
    if (!id) return;
    openedFromUrl.current = true;
    const row = collection.items.find((r) => r.documentId === id);
    if (row) openEdit(row);
  }, [params, collection.loading, collection.items, openEdit]);

  const saveDraft = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      save.setError('Numele este obligatoriu.');
      return;
    }
    const ok = draft.documentId
      ? await collection.update(draft.documentId, { name })
      : Boolean(await collection.create({ name }));
    if (ok) closeDraft();
  };

  const [target, setTarget] = React.useState<Row<Discipline> | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const confirmRemove = async () => {
    if (!target) return;
    setDeleting(true);
    const ok = await collection.remove(target.documentId);
    setDeleting(false);
    if (ok) setTarget(null);
  };

  const columns: DataColumn<Row<Discipline>>[] = [
    { key: 'name', header: 'Nume', value: (r) => r.name, sortable: true },
    {
      key: 'delete',
      header: '',
      searchable: false,
      align: 'right',
      render: (r) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setTarget(r);
          }}
        >
          Șterge
        </Button>
      ),
    },
  ];

  return (
    <AdminPage>
      <Window>
        <PageHeader
          back={{ to: DASHBOARD_TO }}
          title="Discipline"
          subtitle="Disciplinele sportive practicate în club."
          actions={<Button onClick={openNew}>+ Adaugă disciplină</Button>}
        />

        <div className="ui-body">
          {collection.error && <Notice tone="danger">Nu am putut încărca disciplinele.</Notice>}

          <DataTable<Row<Discipline>>
            columns={columns}
            rows={collection.items}
            getRowKey={(r) => r.documentId}
            onRowClick={(r) => openEdit(r)}
            rowLabel={(r) => `Editează ${r.name}`}
            loading={collection.loading}
            empty="Nicio disciplină adăugată."
            noMatches="Nicio disciplină pentru căutarea curentă."
            searchPlaceholder="Caută după nume..."
          />
        </div>
      </Window>

      {draft && (
        <Modal
          open
          onClose={closeDraft}
          dismissable={!save.saving}
          title={draft.documentId ? 'Editează disciplina' : 'Disciplină nouă'}
          size="sm"
          footer={
            <>
              <Button variant="secondary" disabled={save.saving} onClick={closeDraft}>
                Anulează
              </Button>
              <Button disabled={save.saving} loading={save.saving} onClick={() => void saveDraft()}>
                {save.saving ? 'Se salvează...' : 'Salvează'}
              </Button>
            </>
          }
        >
          <Field label="Nume" error={save.error} required>
            <Input
              value={draft.name}
              placeholder="ex: Patinaj artistic"
              onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
            />
          </Field>
        </Modal>
      )}

      <ConfirmDialog
        open={target !== null}
        title="Ștergi disciplina?"
        message={`„${target?.name ?? ''}" se șterge definitiv.`}
        busy={deleting}
        onCancel={() => !deleting && setTarget(null)}
        onConfirm={() => void confirmRemove()}
      />
    </AdminPage>
  );
};

export default DisciplinePage;
