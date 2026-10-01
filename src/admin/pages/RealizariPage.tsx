import * as React from 'react';
import {
  AdminPage,
  Window,
  PageHeader,
  Notice,
  Loading,
  SaveBar,
  UnsavedGuard,
  ObjectFieldCard,
  EditorCard,
  LinkOutCard,
  RepeatableList,
  GalleryGrid,
  Textarea,
  normalizeObject,
  type GalleryImage,
} from '../ui';
import { useSingleType, usePageForm } from '../lib';
import { DASHBOARD_TO, COMPETITII_TO } from '../dashboard/menu';
import { UID } from './routes';

/**
 * Realizări (/despre-noi/realizari on the site): the realizari-page single type.
 *
 * Replaces the content-manager view, field for field:
 *   banner               RealizariPageBannerEditor, JSON { bannerTitle, bannerSubtitle }.
 *   notableAchievements  FooterNotesEditor (realizari-achievements), JSON string[].
 *   galleryImages        native media field (multiple, images).
 *   competitions         CompetitionsLink: a link to Competiții, no value of its own.
 * JSON objects are merged, not rebuilt, so keys the editors did not know survive.
 */

interface Banner {
  bannerTitle: string;
  bannerSubtitle: string;
}

/** A media file as the content-manager returns it (kept whole in the form). */
interface MediaFile {
  id: number;
  url: string;
  name?: string | null;
  mime?: string;
  formats?: { thumbnail?: { url?: string } } | null;
}

interface RealizariPageData {
  banner: Banner | null;
  notableAchievements: string[] | null;
  galleryImages: MediaFile[] | null;
}

const EMPTY_BANNER: Banner = { bannerTitle: '', bannerSubtitle: '' };

const toTile = (f: MediaFile): GalleryImage => ({
  id: f.id,
  url: f.url,
  name: f.name ?? null,
  thumbnailUrl: f.formats?.thumbnail?.url ?? undefined,
  mime: f.mime,
});

const RealizariPage: React.FC = () => {
  const page = useSingleType<RealizariPageData>(UID.realizariPage);
  const form = usePageForm<RealizariPageData>(page.data, page.saveState);

  const banner = normalizeObject<Banner>(form.value.banner, EMPTY_BANNER);
  const achievements = Array.isArray(form.value.notableAchievements) ? form.value.notableAchievements : [];
  const gallery = Array.isArray(form.value.galleryImages) ? form.value.galleryImages : [];

  // Tiles back to file objects: a file already in the form keeps its loaded
  // object, so a round trip does not mark the page dirty.
  const setGallery = (tiles: GalleryImage[]) => {
    const byId = new Map(gallery.map((f) => [f.id, f]));
    form.set(
      'galleryImages',
      tiles.map((t) => byId.get(t.id) ?? { id: t.id, url: t.url, name: t.name ?? null, mime: t.mime, formats: t.thumbnailUrl ? { thumbnail: { url: t.thumbnailUrl } } : null }),
    );
  };

  return (
    <AdminPage>
      <Window>
        <PageHeader
          back={{ to: DASHBOARD_TO }}
          title="Realizări"
          subtitle="Bannerul, palmaresul și galeria foto de pe pagina /despre-noi/realizari"
        />

        {page.loading ? (
          <Loading />
        ) : page.error ? (
          <div className="ui-body">
            <Notice tone="danger">Nu am putut încărca pagina realizărilor.</Notice>
          </div>
        ) : (
          <div className="ui-body">
            <ObjectFieldCard<Banner>
              title="Pagina Realizări - Banner"
              description="Titlul și subtitlul bannerului pentru pagina /despre-noi/realizari."
              value={banner}
              onFieldChange={(key, v) => form.set('banner', { ...banner, [key]: v })}
              fields={[
                { key: 'bannerTitle', label: 'Titlu banner', hint: 'ex: Realizările noastre', placeholder: 'ex: Realizările noastre', span: 2 },
                {
                  key: 'bannerSubtitle',
                  label: 'Subtitlu banner',
                  hint: 'Textul de sub titlul bannerului',
                  type: 'textarea',
                  rows: 3,
                  placeholder: 'Subtitlul bannerului...',
                },
              ]}
            />

            <EditorCard
              title="Realizări notabile"
              description="Lista realizărilor importante ale clubului, afișată în secțiunea Palmares de pe pagina Realizări."
            >
              <RepeatableList<string>
                items={achievements}
                onChange={(next) => form.set('notableAchievements', next)}
                getKey={(_, i) => i}
                newItem={() => ''}
                addLabel="Adaugă realizare"
                emptyLabel="Niciun element adăugat"
                itemLabel={(_, i) => `realizarea ${i + 1}`}
                reorder
                aria-label="Realizări notabile"
                renderRow={(text, i, { update }) => (
                  <Textarea
                    value={text ?? ''}
                    rows={2}
                    aria-label={`Realizări notabile ${i + 1}`}
                    onChange={(e) => update(e.target.value)}
                  />
                )}
              />
            </EditorCard>

            <EditorCard
              title="Galerie foto competiții"
              description="Fotografiile afișate în galeria paginii Realizări, în ordinea de aici."
            >
              <GalleryGrid images={gallery.map(toTile)} onChange={setGallery} reorder aria-label="Galerie foto competiții" confirmRemove="Imaginea nu va mai apărea în galeria foto a competițiilor." />
            </EditorCard>

            <LinkOutCard
              title="Competiții & Rezultate"
              description="Competițiile și rezultatele sportivilor sunt gestionate separat, ca înregistrări individuale, organizate pe sezoane."
              body="Adaugă sau editează competițiile și rezultatele din secțiunea dedicată."
              href={`/admin${COMPETITII_TO}`}
              linkLabel="Gestionează competițiile"
            />
          </div>
        )}

        {!page.loading && !page.error && (
          <SaveBar {...page.saveState.bar} onSave={() => void page.save(form.value)} onDiscard={form.reset} />
        )}
      </Window>

      <UnsavedGuard when={form.dirty} />
    </AdminPage>
  );
};

export default RealizariPage;
