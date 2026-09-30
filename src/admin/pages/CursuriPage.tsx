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
  Field,
  Input,
  Textarea,
  RepeatableList,
  normalizeObject,
} from '../ui';
import { useSingleType, usePageForm } from '../lib';
import { DASHBOARD_TO } from '../dashboard/menu';
import { UID } from './routes';

/**
 * Cursuri (/cursuri on the site): the cursuri-page single type.
 *
 * Replaces the content-manager view and its four custom fields
 * (component-preview CursuriPageBannerEditor `banner`, CursuriPageAboutEditor
 * `aboutSection`, CursuriPageInfoSectionEditor `infoSection`,
 * CursuriPagePromoCardEditor `promoCard`). All four are JSON attributes; the
 * shapes stay exactly as those editors wrote them, so the website reads them
 * unchanged:
 *   banner:       { title, scheduleDays, scheduleTimes, locationName, locationUrl }
 *   aboutSection: { eyebrow, heading, content, locationBullet, levelsBullet, coachesBullet, videoUrl, videoLabel }
 *   infoSection:  { sectionLabel, tips: string[], closingLine }
 *   promoCard:    { eyebrow, title, description, subscriptionInfoTitle, subscriptionBullets: string[] }
 * Keys the editors did not know are kept (the objects are merged, not rebuilt).
 *
 * The video stays a link: the website plays `aboutSection.videoUrl` through
 * its YouTube embed only, so an uploaded file would not play there.
 */

interface Banner {
  title: string;
  scheduleDays: string;
  scheduleTimes: string;
  locationName: string;
  locationUrl: string;
}

interface About {
  eyebrow: string;
  heading: string;
  content: string;
  locationBullet: string;
  levelsBullet: string;
  coachesBullet: string;
  videoUrl: string;
  videoLabel: string;
}

interface InfoSection {
  sectionLabel: string;
  tips: string[];
  closingLine: string;
}

interface PromoCard {
  eyebrow: string;
  title: string;
  description: string;
  subscriptionInfoTitle: string;
  subscriptionBullets: string[];
}

interface CursuriPageData {
  banner: Banner | null;
  aboutSection: About | null;
  infoSection: InfoSection | null;
  promoCard: PromoCard | null;
}

const EMPTY_BANNER: Banner = { title: '', scheduleDays: '', scheduleTimes: '', locationName: '', locationUrl: '' };
const EMPTY_ABOUT: About = {
  eyebrow: '',
  heading: '',
  content: '',
  locationBullet: '',
  levelsBullet: '',
  coachesBullet: '',
  videoUrl: '',
  videoLabel: '',
};
const EMPTY_INFO: InfoSection = { sectionLabel: '', tips: [], closingLine: '' };
const EMPTY_PROMO: PromoCard = { eyebrow: '', title: '', description: '', subscriptionInfoTitle: '', subscriptionBullets: [] };

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : String(x ?? ''))) : []);

/**
 * Stable React keys for a list whose items carry no id (strings, plain JSON
 * objects). A row keeps its key while it is edited (same index, new value),
 * moved (same value, new index) or when rows around it are added / removed,
 * so inputs keep focus and expanded state survives.
 */
function useRowKeys<T>(items: readonly T[]): (item: T, index: number) => number {
  const ref = React.useRef<{ items: readonly T[]; keys: number[]; next: number }>({ items: [], keys: [], next: 1 });
  const st = ref.current;
  if (st.items !== items) {
    const used = new Set<number>();
    const keys: Array<number | undefined> = items.map((it, i) => {
      if (i < st.items.length && Object.is(st.items[i], it)) {
        used.add(i);
        return st.keys[i];
      }
      return undefined;
    });
    items.forEach((it, i) => {
      if (keys[i] !== undefined) return;
      const j = st.items.findIndex((old, k) => !used.has(k) && Object.is(old, it));
      if (j >= 0) {
        used.add(j);
        keys[i] = st.keys[j];
      }
    });
    const leftover = st.keys.filter((_, k) => !used.has(k));
    st.keys = keys.map((k) => k ?? leftover.shift() ?? st.next++);
    st.items = items;
  }
  return (_item, index) => st.keys[index];
}

/** A `string[]` edited as a list of text areas (the plugin's InlineStringList). */
function StringList({
  label,
  hint,
  items,
  onChange,
  itemName,
  addLabel,
  emptyLabel = 'Nicio intrare',
}: {
  label: string;
  hint?: string;
  items: string[];
  onChange: (next: string[]) => void;
  /** e.g. "Sfat": aria labels "Sfat 2", delete "Șterge sfat 2". */
  itemName: string;
  addLabel: string;
  emptyLabel?: string;
}) {
  const keyOf = useRowKeys(items);
  return (
    <div className="ui-field">
      <div className="ui-label">{label}</div>
      <RepeatableList<string>
        items={items}
        onChange={onChange}
        getKey={keyOf}
        newItem={() => ''}
        addLabel={addLabel}
        emptyLabel={emptyLabel}
        aria-label={label}
        itemLabel={(_, i) => `${itemName.toLowerCase()} ${i + 1}`}
        renderRow={(text, i, row) => (
          <Textarea aria-label={`${itemName} ${i + 1}`} rows={2} value={text} onChange={(e) => row.update(e.target.value)} />
        )}
      />
      {hint && <div className="ui-hint">{hint}</div>}
    </div>
  );
}

const CursuriPage: React.FC = () => {
  const page = useSingleType<CursuriPageData>(UID.cursuriPage);
  const form = usePageForm<CursuriPageData>(page.data, page.saveState);

  const banner = normalizeObject<Banner>(form.value.banner, EMPTY_BANNER);
  const about = normalizeObject<About>(form.value.aboutSection, EMPTY_ABOUT);
  const info = normalizeObject<InfoSection>(form.value.infoSection, EMPTY_INFO);
  const promo = normalizeObject<PromoCard>(form.value.promoCard, EMPTY_PROMO);
  const tips = React.useMemo(() => strings(info.tips), [info.tips]);
  const bullets = React.useMemo(() => strings(promo.subscriptionBullets), [promo.subscriptionBullets]);

  return (
    <AdminPage>
      <Window>
        <PageHeader
          back={{ to: DASHBOARD_TO }}
          title="Cursuri"
          subtitle="Bannerul, prezentarea, cardul promo și informațiile practice de pe pagina /cursuri"
        />

        {page.loading ? (
          <Loading />
        ) : page.error ? (
          <div className="ui-body">
            <Notice tone="danger">Nu am putut încărca pagina cursurilor.</Notice>
          </div>
        ) : (
          <div className="ui-body">
            <ObjectFieldCard<Banner>
              title="Banner Pagina Cursuri"
              description="Titlul și informațiile de orar afișate în header-ul paginii /cursuri."
              value={banner}
              onFieldChange={(key, v) => form.set('banner', { ...banner, [key]: v })}
              sections={[
                { keys: ['title'] },
                { title: 'Orar și locație', keys: ['scheduleDays', 'scheduleTimes', 'locationName', 'locationUrl'] },
              ]}
              fields={[
                {
                  key: 'title',
                  label: 'Titlu banner',
                  hint: 'Titlul mare afișat pe banner-ul paginii, ex: Cursuri de Patinaj',
                  placeholder: 'ex: Cursuri de Patinaj',
                  span: 2,
                },
                { key: 'scheduleDays', label: 'Zile de curs', hint: 'ex: Sâmbătă & Duminică', placeholder: 'ex: Sâmbătă & Duminică' },
                { key: 'scheduleTimes', label: 'Ore de curs', hint: 'ex: 10:00–10:50 & 11:00–11:50', placeholder: 'ex: 10:00–10:50 & 11:00–11:50' },
                { key: 'locationName', label: 'Locație', hint: 'Numele locației, ex: AFI Cotroceni', placeholder: 'ex: AFI Cotroceni' },
                {
                  key: 'locationUrl',
                  label: 'Link locație',
                  hint: 'URL Google Maps sau altă pagină a locației',
                  type: 'url',
                  placeholder: 'ex: https://maps.google.com/...',
                },
              ]}
            />

            <ObjectFieldCard<About>
              title="Secțiunea Despre Cursuri"
              description="Prezentarea școlii de patinaj: titlu, text descriptiv, puncte cheie și link video opțional."
              value={about}
              onFieldChange={(key, v) => form.set('aboutSection', { ...about, [key]: v })}
              sections={[
                { keys: ['eyebrow', 'heading', 'content'] },
                { title: 'Puncte cheie', keys: ['locationBullet', 'levelsBullet', 'coachesBullet'] },
                { title: 'Video', keys: ['videoUrl', 'videoLabel'] },
              ]}
              fields={[
                { key: 'eyebrow', label: 'Etichetă mică', hint: 'Textul mic deasupra titlului, ex: Despre noi', placeholder: 'ex: Despre noi' },
                { key: 'heading', label: 'Titlu secțiune', hint: 'ex: Școala de patinaj EduSport', placeholder: 'ex: Școala de patinaj EduSport' },
                {
                  key: 'content',
                  label: 'Text principal',
                  hint: 'Descrierea principală. Separă paragrafele cu o linie goală.',
                  type: 'textarea',
                  rows: 5,
                  placeholder: 'Descrierea principală a școlii...',
                },
                { key: 'locationBullet', label: 'Bullet locație', hint: 'ex: Patinoar AFI Cotroceni', placeholder: 'ex: Patinoar AFI Cotroceni' },
                {
                  key: 'levelsBullet',
                  label: 'Bullet niveluri',
                  hint: 'ex: Toate nivelurile de vârstă și experiență',
                  placeholder: 'ex: Toate nivelurile de vârstă și experiență',
                },
                {
                  key: 'coachesBullet',
                  label: 'Bullet antrenori',
                  hint: 'ex: Antrenori cu experiență internațională',
                  placeholder: 'ex: Antrenori cu experiență internațională',
                  span: 2,
                },
                {
                  key: 'videoUrl',
                  label: 'Link video',
                  hint: 'URL YouTube sau alt video, opțional',
                  type: 'url',
                  placeholder: 'ex: https://youtube.com/watch?v=...',
                },
                {
                  key: 'videoLabel',
                  label: 'Text link video',
                  hint: 'Textul afișat pe linkul video, ex: Urmărește un curs',
                  placeholder: 'ex: Urmărește un curs',
                },
              ]}
            />

            <ObjectFieldCard<PromoCard>
              title="Card Promo Abonament"
              description="Cardul albastru care promovează abonamentul de club afișat pe pagina /cursuri."
              value={promo}
              onFieldChange={(key, v) => form.set('promoCard', { ...promo, [key]: v })}
              sections={[
                { keys: ['eyebrow', 'title', 'description'] },
                { title: 'Informații abonament', keys: ['subscriptionInfoTitle'] },
              ]}
              fields={[
                { key: 'eyebrow', label: 'Etichetă mică', hint: 'Textul mic deasupra titlului, ex: Devino Membru', placeholder: 'ex: Devino Membru' },
                { key: 'title', label: 'Titlu card', hint: 'Titlul cardului promo, ex: Abonament de Club', placeholder: 'ex: Abonament de Club' },
                {
                  key: 'description',
                  label: 'Descriere',
                  hint: 'Textul descriptiv al cardului promo',
                  type: 'textarea',
                  rows: 3,
                  placeholder: 'Descrierea cardului promo...',
                },
                {
                  key: 'subscriptionInfoTitle',
                  label: 'Titlu info abonament',
                  hint: 'Titlul listei de informații, ex: Ce include abonamentul?',
                  placeholder: 'ex: Ce include abonamentul?',
                  span: 2,
                },
              ]}
            >
              <StringList
                label="Informații abonament"
                hint="Câte un punct pe rând"
                items={bullets}
                onChange={(subscriptionBullets) => form.set('promoCard', { ...promo, subscriptionBullets })}
                itemName="Punct"
                addLabel="Adaugă punct"
              />
            </ObjectFieldCard>

            <ObjectFieldCard<InfoSection>
              title="Secțiunea Informații Practice"
              description="Sfaturile și regulile afișate la finalul paginii /cursuri (secțiunea Ce trebuie să știi)."
              value={info}
              onFieldChange={(key, v) => form.set('infoSection', { ...info, [key]: v })}
              fields={[{ key: 'sectionLabel', label: 'Titlu secțiune', hint: 'ex: Ce trebuie să știi', placeholder: 'ex: Ce trebuie să știi', span: 2 }]}
            >
              <StringList
                label="Sfaturi & reguli"
                hint="Câte un sfat sau regulă pe rând"
                items={tips}
                onChange={(next) => form.set('infoSection', { ...info, tips: next })}
                itemName="Sfat"
                addLabel="Adaugă sfat"
              />
              <Field label="Linie de închidere" hint="Textul final afișat după lista de sfaturi, opțional">
                <Input
                  value={info.closingLine ?? ''}
                  placeholder="ex: Ne rezervăm dreptul de a modifica orarul..."
                  onChange={(e) => form.set('infoSection', { ...info, closingLine: e.target.value })}
                />
              </Field>
            </ObjectFieldCard>
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

export default CursuriPage;
