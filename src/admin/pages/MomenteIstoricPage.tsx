import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AdminPage,
  Window,
  PageHeader,
  Button,
  Field,
  Input,
  Textarea,
  Modal,
  Notice,
  DataTable,
  type DataColumn,
  useSaveState,
  adminToast,
} from '../ui';
import { ConfirmDialog } from '../ConfirmDialog';
import { useCollection, type Row } from '../lib';
import { DASHBOARD_TO } from '../dashboard/menu';
import { UID } from './routes';

/**
 * Momente istoric (/plugins/edusport-momente-istoric): the history-milestone
 * collection, the timeline entries on /despre-noi/istoric.
 *
 * No dedicated component-preview editor - edited straight in the
 * content-manager list/edit view. List (sorted by `order`, same as the
 * website) + create/edit in a Modal, reorder (Sus/Jos, the type has an
 * integer `order` field), delete with ConfirmDialog, per
 * docs/admin-ui/CUSTOM-PAGES.md. A redirected entry URL arrives as
 * `?id=<documentId>`: that entry's modal opens automatically.
 */

interface Milestone {
  year: string;
  title: string;
  description: string | null;
  order: number | null;
}

interface Draft {
  documentId: string | null;
  year: string;
  title: string;
  description: string;
}

const EMPTY_DRAFT: Draft = { documentId: null, year: '', title: '', description: '' };

const MomenteIstoricPage: React.FC = () => {
  const collection = useCollection<Milestone>(UID.historyMilestone);
  const [params, setParams] = useSearchParams();

  const [draft, setDraft] = React.useState<Draft | null>(null);
  const save = useSaveState();
  const openedFromUrl = React.useRef(false);

  const openNew = React.useCallback(() => {
    save.reset();
    setDraft({ ...EMPTY_DRAFT });
  }, [save]);

  const openEdit = React.useCallback(
    (row: Row<Milestone>) => {
      save.reset();
      setDraft({
        documentId: row.documentId,
        year: row.year,
        title: row.title,
        description: row.description ?? '',
      });
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
    const year = draft.year.trim();
    const title = draft.title.trim();
    if (!year || !title) {
      save.setError('Anul și titlul sunt obligatorii.');
      return;
    }
    const body = { year, title, description: draft.description.trim() || null };
    const ok = draft.documentId
      ? await collection.update(draft.documentId, body)
      : Boolean(
          await collection.create({
            ...body,
            order: collection.items.reduce((m, r) => Math.max(m, r.order ?? 0), 0) + 1,
          }),
        );
    if (ok) closeDraft();
  };

  const [target, setTarget] = React.useState<Row<Milestone> | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const confirmRemove = async () => {
    if (!target) return;
    setDeleting(true);
    const ok = await collection.remove(target.documentId);
    setDeleting(false);
    if (ok) setTarget(null);
  };

  const [reordering, setReordering] = React.useState(false);
  const move = async (documentId: string, dir: -1 | 1) => {
    if (reordering) return;
    const items = collection.items;
    const from = items.findIndex((r) => r.documentId === documentId);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= items.length) return;
    const next = items.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setReordering(true);
    const ok = await collection.reorder(next);
    setReordering(false);
    if (!ok) adminToast.error('Nu am putut salva ordinea. Încearcă din nou.');
  };

  const columns: DataColumn<Row<Milestone>>[] = [
    { key: 'year', header: 'An', value: (r) => r.year, sortable: true, width: '90px' },
    { key: 'title', header: 'Titlu', value: (r) => r.title, sortable: true },
    { key: 'description', header: 'Descriere', value: (r) => r.description ?? '', render: (r) => <span className="ui-hint">{r.description || '—'}</span> },
    {
      key: 'move',
      header: '',
      searchable: false,
      align: 'right',
      render: (r) => {
        const index = collection.items.findIndex((x) => x.documentId === r.documentId);
        return (
          <>
            <Button
              variant="ghost"
              size="sm"
              title="Mută mai sus"
              disabled={reordering || index <= 0}
              onClick={(e) => {
                e.stopPropagation();
                void move(r.documentId, -1);
              }}
            >
              Sus
            </Button>{' '}
            <Button
              variant="ghost"
              size="sm"
              title="Mută mai jos"
              disabled={reordering || index < 0 || index >= collection.items.length - 1}
              onClick={(e) => {
                e.stopPropagation();
                void move(r.documentId, 1);
              }}
            >
              Jos
            </Button>
          </>
        );
      },
    },
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
          title="Momente istoric"
          subtitle="Intrările de pe linia de timp a istoricului clubului (pagina /despre-noi/istoric)."
          actions={<Button onClick={openNew}>+ Adaugă moment</Button>}
        />

        <div className="ui-body">
          {collection.error && <Notice tone="danger">Nu am putut încărca momentele din istoric.</Notice>}

          <DataTable<Row<Milestone>>
            columns={columns}
            rows={collection.items}
            getRowKey={(r) => r.documentId}
            onRowClick={(r) => openEdit(r)}
            rowLabel={(r) => `Editează ${r.title}`}
            loading={collection.loading}
            empty="Niciun moment adăugat."
            noMatches="Niciun moment pentru căutarea curentă."
            searchPlaceholder="Caută după an sau titlu..."
            pageSize={0}
          />
        </div>
      </Window>

      {draft && (
        <Modal
          open
          onClose={closeDraft}
          dismissable={!save.saving}
          title={draft.documentId ? 'Editează momentul' : 'Moment nou'}
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
          <div className="ui-grid2">
            <Field label="An" required>
              <Input
                value={draft.year}
                placeholder="ex: 2018"
                onChange={(e) => setDraft((d) => (d ? { ...d, year: e.target.value } : d))}
              />
            </Field>
            <Field label="Titlu" required>
              <Input
                value={draft.title}
                placeholder="ex: Înființarea clubului"
                onChange={(e) => setDraft((d) => (d ? { ...d, title: e.target.value } : d))}
              />
            </Field>
          </div>
          <Field label="Descriere" error={save.error}>
            <Textarea
              rows={3}
              value={draft.description}
              placeholder="Descrierea momentului..."
              onChange={(e) => setDraft((d) => (d ? { ...d, description: e.target.value } : d))}
            />
          </Field>
        </Modal>
      )}

      <ConfirmDialog
        open={target !== null}
        title="Ștergi momentul?"
        message={`„${target?.title ?? ''}" (${target?.year ?? ''}) se șterge definitiv.`}
        busy={deleting}
        onCancel={() => !deleting && setTarget(null)}
        onConfirm={() => void confirmRemove()}
      />
    </AdminPage>
  );
};

export default MomenteIstoricPage;
