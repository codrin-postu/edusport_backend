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
  RepeatableList,
  GalleryGrid,
  Input,
  StatusBadge,
  normalizeObject,
  type GalleryImage,
} from '../ui';
import { useSingleType, usePageForm } from '../lib';
import { DASHBOARD_TO } from './menu';

/**
 * EduSport admin - custom "Pagina Voluntariat" editor, replacing the stock
 * single-type view for api::volunteer-page.volunteer-page.
 *
 * The page holds very little: five text fields, a handful of "moduri de a
 * ajuta" and a gallery. The generic content-manager view spreads that over
 * several screens because every custom field renders as its own titled block.
 * Here the same data sits on one screen, two columns.
 *
 * Load and save go through useSingleType: only the attributes that changed are
 * sent, so anything this page does not manage keeps its stored value. `content`
 * is a JSON object: edits are merged into the loaded object, so keys this page
 * does not show survive.
 */

const UID_VOLUNTEER_PAGE = 'api::volunteer-page.volunteer-page';

interface Content {
  heroTitle: string;
  heroSubtitle: string;
  introEyebrow: string;
  introHeading: string;
  introBody: string;
}

interface HelpWay {
  title: string;
  desc: string;
}

/** A media file as the content-manager returns it (kept whole in the form). */
interface MediaFile {
  id: number;
  url: string;
  name?: string | null;
  mime?: string;
  formats?: { thumbnail?: { url?: string } } | null;
}

interface VolunteerPage {
  content: Content | null;
  helpWays: HelpWay[] | null;
  gallery: MediaFile[] | null;
  updatedAt?: string;
}

const EMPTY_CONTENT: Content = {
  heroTitle: '',
  heroSubtitle: '',
  introEyebrow: '',
  introHeading: '',
  introBody: '',
};

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

const toTile = (f: MediaFile): GalleryImage => ({
  id: f.id,
  url: f.url,
  name: f.name ?? null,
  thumbnailUrl: f.formats?.thumbnail?.url ?? undefined,
  mime: f.mime,
});

/** "2026-09-04T12:35:09.448Z" -> "4 sep 2026, 12:35" */
function fmtSaved(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const months = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

// Layout only (two columns, stacked under 980px); colours and corners come
// from the shared components.
const VP_CSS = `
.vp-cols{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:14px;align-items:start}
.vp-col{display:flex;flex-direction:column;gap:14px;min-width:0}
.vp-way{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
@media (max-width:980px){.vp-cols{grid-template-columns:minmax(0,1fr)}}
`;

const count = (n: number, one: string, many: string) => (
  <StatusBadge tone="neutral">
    {n} {n === 1 ? one : many}
  </StatusBadge>
);

const VoluntariatEditPage: React.FC = () => {
  const page = useSingleType<VolunteerPage>(UID_VOLUNTEER_PAGE);
  const form = usePageForm<VolunteerPage>(page.data, page.saveState);

  const content = normalizeObject<Content>(form.value.content, EMPTY_CONTENT);
  const helpWays: HelpWay[] = Array.isArray(form.value.helpWays)
    ? form.value.helpWays.map((w) => ({ ...(w ?? {}), title: str(w?.title), desc: str(w?.desc) }))
    : [];
  const gallery = Array.isArray(form.value.gallery) ? form.value.gallery : [];
  const savedAt = typeof page.data?.updatedAt === 'string' ? page.data.updatedAt : null;

  // Tiles back to file objects: a file already in the form keeps its loaded
  // object, so a round trip does not mark the page dirty.
  const setGallery = (tiles: GalleryImage[]) => {
    const byId = new Map(gallery.map((f) => [f.id, f]));
    form.set(
      'gallery',
      tiles.map(
        (t) =>
          byId.get(t.id) ?? {
            id: t.id,
            url: t.url,
            name: t.name ?? null,
            mime: t.mime,
            formats: t.thumbnailUrl ? { thumbnail: { url: t.thumbnailUrl } } : null,
          },
      ),
    );
  };

  const setContent = <K extends keyof Content>(key: K, v: Content[K]) => form.set('content', { ...content, [key]: v });

  return (
    <AdminPage>
      <style>{VP_CSS}</style>
      <Window>
        <PageHeader
          back={{ to: DASHBOARD_TO }}
          title="Pagina Voluntariat"
          subtitle={savedAt ? `Ultima salvare ${fmtSaved(savedAt)}` : 'Textele și galeria paginii publice de voluntariat'}
        />

        {page.loading ? (
          <Loading />
        ) : page.error ? (
          <div className="ui-body">
            <Notice tone="danger">Nu am putut încărca pagina de voluntariat.</Notice>
          </div>
        ) : (
          <div className="ui-body">
            <div className="vp-cols">
              {/* ---- left: page text ---- */}
              <div className="vp-col">
                <ObjectFieldCard<Content>
                  title="Banner"
                  value={content}
                  onFieldChange={setContent}
                  fields={[
                    { key: 'heroTitle', label: 'Titlu', placeholder: 'ex: Voluntariat', span: 2 },
                    {
                      key: 'heroSubtitle',
                      label: 'Subtitlu',
                      type: 'textarea',
                      rows: 3,
                      placeholder: 'ex: Clubul crește cu oameni care dăruiesc timp.',
                    },
                  ]}
                />

                <ObjectFieldCard<Content>
                  title="Introducere"
                  value={content}
                  onFieldChange={setContent}
                  fields={[
                    { key: 'introEyebrow', label: 'Supratitlu', placeholder: 'ex: De ce voluntariat' },
                    { key: 'introHeading', label: 'Titlu', placeholder: 'ex: Timpul tău face diferența' },
                    {
                      key: 'introBody',
                      label: 'Text',
                      type: 'textarea',
                      rows: 3,
                      placeholder: 'Un paragraf despre ce înseamnă voluntariatul la club.',
                    },
                  ]}
                />
              </div>

              {/* ---- right: help ways + gallery ---- */}
              <div className="vp-col">
                <EditorCard title="Moduri de a ajuta" headerAction={count(helpWays.length, 'mod', 'moduri')}>
                  <RepeatableList<HelpWay>
                    items={helpWays}
                    onChange={(next) => form.set('helpWays', next)}
                    getKey={(_, i) => i}
                    newItem={() => ({ title: '', desc: '' })}
                    addLabel="Adaugă un mod de a ajuta"
                    emptyLabel="Niciun mod de a ajuta. Secțiunea nu apare pe site."
                    itemLabel={(w, i) => w.title.trim() || `modul ${i + 1}`}
                    reorder
                    confirmDelete={{
                      title: 'Ștergi rândul?',
                      message: 'Rândul dispare din lista de moduri de a ajuta.',
                      detail: 'Modificarea se aplică după ce apeși Salvează.',
                    }}
                    aria-label="Moduri de a ajuta"
                    renderRow={(w, i, { update }) => (
                      <div className="vp-way">
                        <Input
                          value={w.title}
                          placeholder="Titlu, ex: La competiții"
                          aria-label={`Titlu ${i + 1}`}
                          onChange={(e) => update({ title: e.target.value })}
                        />
                        <Input
                          value={w.desc}
                          placeholder="Descriere scurtă"
                          aria-label={`Descriere ${i + 1}`}
                          onChange={(e) => update({ desc: e.target.value })}
                        />
                      </div>
                    )}
                  />
                </EditorCard>

                <EditorCard
                  title="Galerie"
                  description={
                    gallery.length === 0
                      ? 'Momentan nu există imagini, iar galeria nu apare pe site.'
                      : 'Imaginile apar în galeria de pe pagina publică, în ordinea de aici.'
                  }
                  headerAction={count(gallery.length, 'imagine', 'imagini')}
                >
                  <GalleryGrid
                    images={gallery.map(toTile)}
                    onChange={setGallery}
                    reorder
                    columns={4}
                    addLabel="Adaugă imagine"
                    aria-label="Galerie"
                    confirmRemove="Imaginea nu va mai apărea în galeria paginii de voluntariat."
                  />
                </EditorCard>
              </div>
            </div>
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

export default VoluntariatEditPage;
