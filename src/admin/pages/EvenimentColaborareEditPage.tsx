import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AdminPage,
  Window,
  PageHeader,
  Notice,
  Loading,
  Button,
  SaveBar,
  UnsavedGuard,
  releaseUnsavedGuards,
  EditorCard,
  Field,
  FieldRow,
  Input,
  Textarea,
  NumberInput,
  GalleryGrid,
  adminToast,
  type GalleryImage,
} from '../ui';
import { ConfirmDialog } from '../ConfirmDialog';
import { useCollectionEntry, usePageForm } from '../lib';
import { EVENIMENTE_COLABORARE_TO, EVENIMENT_COLABORARE_EDIT_TO, UID } from './routes';

/**
 * Eveniment colaborare: one collaboration-event entry. `?id=<documentId>`
 * edits it, no id creates one; after the first save the URL moves to the new
 * id. Delete sits in the header behind a ConfirmDialog.
 *
 * Every attribute of the type, as the content-manager edited it:
 *   title (string, required), partner (string), date (string: free text such
 *   as "Decembrie 2024", the site prints it as typed), description (text),
 *   image (single image), order (integer, the site sorts by it ascending).
 */

interface MediaFile {
  id: number;
  url: string;
  name?: string | null;
  mime?: string;
  formats?: { thumbnail?: { url?: string } } | null;
}

interface CollaborationEvent {
  title: string | null;
  partner: string | null;
  date: string | null;
  description: string | null;
  image: MediaFile | null;
  order: number | null;
}

const toTile = (f: MediaFile | null): GalleryImage | null =>
  f ? { id: f.id, url: f.url, name: f.name ?? null, thumbnailUrl: f.formats?.thumbnail?.url ?? undefined, mime: f.mime } : null;

const editUrl = (documentId: string) => `${EVENIMENT_COLABORARE_EDIT_TO}?id=${encodeURIComponent(documentId)}`;

const EvenimentColaborareEditPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const id = params.get('id');

  const entry = useCollectionEntry<CollaborationEvent>(UID.collaborationEvent, id);
  const form = usePageForm<CollaborationEvent>(entry.data, entry.saveState);
  const [showErrors, setShowErrors] = React.useState(false);
  const [asking, setAsking] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  // First save of a new entry: move to its own URL.
  React.useEffect(() => {
    if (!id && entry.documentId) navigate(editUrl(entry.documentId), { replace: true });
  }, [id, entry.documentId, navigate]);

  const v = form.value;
  const titleMissing = !(v.title ?? '').trim();
  const isNew = !id;

  const setText = (key: 'title' | 'partner' | 'date' | 'description') => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    form.set(key, e.target.value);

  const setImage = (tiles: Array<GalleryImage | null>) => {
    const t = tiles[0] ?? null;
    if (!t) return form.set('image', null);
    if (v.image && v.image.id === t.id) return;
    form.set('image', { id: t.id, url: t.url, name: t.name ?? null, mime: t.mime, formats: t.thumbnailUrl ? { thumbnail: { url: t.thumbnailUrl } } : null });
  };

  const save = () => {
    if (titleMissing) {
      setShowErrors(true);
      adminToast.error('Completează titlul evenimentului.');
      return;
    }
    setShowErrors(false);
    void entry.save(form.value);
  };

  const discard = () => {
    setShowErrors(false);
    form.reset();
  };

  const confirmDelete = async () => {
    setDeleting(true);
    const ok = await entry.remove();
    setDeleting(false);
    setAsking(false);
    if (ok) {
      releaseUnsavedGuards();
      navigate(EVENIMENTE_COLABORARE_TO);
    }
  };

  const heading = isNew ? 'Eveniment nou' : (entry.data?.title ?? '').trim() || 'Eveniment colaborare';
  const ready = !entry.loading && !entry.error;

  return (
    <AdminPage>
      <Window>
        <PageHeader
          back={{ to: EVENIMENTE_COLABORARE_TO, label: 'Evenimente colaborare' }}
          title={heading}
          subtitle="Eveniment realizat împreună cu un partener, afișat pe pagina /parteneri"
          actions={
            ready && entry.exists ? (
              <Button variant="danger" onClick={() => setAsking(true)}>
                Șterge
              </Button>
            ) : undefined
          }
        />

        {entry.loading ? (
          <Loading />
        ) : entry.error ? (
          <div className="ui-body">
            <Notice tone="danger">Nu am putut încărca evenimentul. Poate a fost șters între timp.</Notice>
          </div>
        ) : (
          <div className="ui-body">
            <EditorCard title="Detalii eveniment" description="Textele afișate pe cardul evenimentului.">
              <div className="ui-stack">
                <Field label="Titlu" required error={showErrors && titleMissing ? 'Titlul este obligatoriu.' : undefined}>
                  <Input value={v.title ?? ''} placeholder="ex: Cupa de Iarnă" onChange={setText('title')} />
                </Field>
                <FieldRow>
                  <Field label="Partener" hint="Numele partenerului cu care a fost realizat evenimentul">
                    <Input value={v.partner ?? ''} placeholder="ex: AFI Cotroceni" onChange={setText('partner')} />
                  </Field>
                  <Field label="Dată" hint="Text liber, afișat exact cum este scris">
                    <Input value={v.date ?? ''} placeholder="ex: Decembrie 2024" onChange={setText('date')} />
                  </Field>
                </FieldRow>
                <Field label="Descriere">
                  <Textarea value={v.description ?? ''} rows={4} placeholder="Câteva rânduri despre eveniment..." onChange={setText('description')} />
                </Field>
              </div>
            </EditorCard>

            <EditorCard title="Imagine" description="Fotografia afișată pe cardul evenimentului.">
              <GalleryGrid slots={1} images={[toTile(v.image ?? null)]} onChange={setImage} slotLabels={['Imagine eveniment']} columns={4} />
            </EditorCard>

            <EditorCard title="Afișare">
              <Field label="Ordine afișare" hint="Evenimentele apar pe /parteneri în ordine crescătoare după acest număr.">
                <NumberInput value={v.order ?? null} onChange={(n) => form.set('order', n)} allowEmpty />
              </Field>
            </EditorCard>
          </div>
        )}

        {ready && <SaveBar {...entry.saveState.bar} onSave={save} onDiscard={discard} />}
      </Window>

      <ConfirmDialog
        open={asking}
        title="Ștergi evenimentul?"
        message={`„${heading}” va fi șters definitiv și dispare de pe pagina /parteneri.`}
        busy={deleting}
        onCancel={() => setAsking(false)}
        onConfirm={() => void confirmDelete()}
      />
      <UnsavedGuard when={form.dirty} />
    </AdminPage>
  );
};

export default EvenimentColaborareEditPage;
