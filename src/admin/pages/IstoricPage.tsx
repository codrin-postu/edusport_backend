import * as React from 'react';
import {
  AdminPage,
  Notice,
  Loading,
  SaveBar,
  UnsavedGuard,
  ObjectFieldCard,
  EditorCard,
  RepeatableList,
  Textarea,
  normalizeObject,
} from '../ui';
import { useSingleType, usePageForm } from '../lib';
import MomenteIstoricBody from './MomenteIstoricPage';
import { TabbedWindow } from './TabbedWindow';
import { UID } from './routes';

/**
 * Istoric (/plugins/edusport-istoric): the historic-page single type, for
 * /despre-noi/istoric.
 *
 * Replaces the content-manager view and its five custom fields (all JSON,
 * shapes unchanged so the website reads them the same):
 *   banner:             { title, subtitle }                (component-preview PageBannerEditor)
 *   pageInfo:           { sectionHeading, sectionSubheading, introText } (HistoricPageInfoEditor)
 *   stats:              string[], each "valoare|etichetă"  (FooterNotesEditor / historic-stats)
 *   eventsOrganized:    string[]                            (FooterNotesEditor / historic-events-organized)
 *   eventsParticipated: string[]                            (FooterNotesEditor / historic-events-participated)
 * Keys the editors did not know are kept (objects are merged, not rebuilt).
 */

interface Banner {
  title: string;
  subtitle: string;
}

interface PageInfo {
  sectionHeading: string;
  sectionSubheading: string;
  introText: string;
}

interface HistoricPage {
  banner: Banner | null;
  pageInfo: PageInfo | null;
  stats: string[] | null;
  eventsOrganized: string[] | null;
  eventsParticipated: string[] | null;
}

const EMPTY_BANNER: Banner = { title: '', subtitle: '' };
const EMPTY_INFO: PageInfo = { sectionHeading: '', sectionSubheading: '', introText: '' };

function StringList({
  items,
  onChange,
  addLabel,
  itemLabel,
  placeholder,
  rows = 2,
  emptyLabel,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
  itemLabel: string;
  placeholder?: string;
  rows?: number;
  emptyLabel: string;
}) {
  return (
    <RepeatableList<string>
      items={items}
      onChange={onChange}
      getKey={(item, i) => i}
      newItem={() => ''}
      addLabel={addLabel}
      itemLabel={(_item, i) => `${itemLabel} ${i + 1}`}
      confirmDelete
      emptyLabel={emptyLabel}
      renderRow={(item, _i, api) => (
        <Textarea
          value={item}
          rows={rows}
          placeholder={placeholder}
          onChange={(e) => api.update(e.target.value)}
        />
      )}
    />
  );
}

type HistoricForm = ReturnType<typeof usePageForm<HistoricPage>>;

function HistoricFields({ form }: { form: HistoricForm }) {
  const banner = normalizeObject<Banner>(form.value.banner, EMPTY_BANNER);
  const info = normalizeObject<PageInfo>(form.value.pageInfo, EMPTY_INFO);
  const stats = Array.isArray(form.value.stats) ? form.value.stats : [];
  const eventsOrganized = Array.isArray(form.value.eventsOrganized) ? form.value.eventsOrganized : [];
  const eventsParticipated = Array.isArray(form.value.eventsParticipated) ? form.value.eventsParticipated : [];
  return (
    <div className="ui-body">
      <ObjectFieldCard<Banner>
        title="Banner pagină"
        value={banner}
        onFieldChange={(key, v) => form.set('banner', { ...banner, [key]: v })}
        fields={[
          { key: 'title', label: 'Titlu', placeholder: 'ex: Echipa noastră', span: 2 },
          {
            key: 'subtitle',
            label: 'Subtitlu',
            type: 'textarea',
            rows: 3,
            placeholder: 'ex: Antrenorii și instructorii care ghidează cursanții...',
          },
        ]}
      />

      <ObjectFieldCard<PageInfo>
        title="Secțiunea principală"
        value={info}
        onFieldChange={(key, v) => form.set('pageInfo', { ...info, [key]: v })}
        fields={[
          { key: 'sectionHeading', label: 'Titlu secțiune principală', placeholder: 'ex: Povestea noastră' },
          { key: 'sectionSubheading', label: 'Subtitlu secțiune', placeholder: 'ex: De la început până astăzi' },
          {
            key: 'introText',
            label: 'Text introducere',
            type: 'textarea',
            rows: 4,
            placeholder: 'Textul introductiv al secțiunii principale...',
            span: 2,
          },
        ]}
      />

      <EditorCard title="Statistici club" description="Format: valoare|etichetă, câte una pe rând.">
        <StringList
          items={stats}
          onChange={(next) => form.set('stats', next)}
          addLabel="Adaugă statistică"
          itemLabel="statistica"
          placeholder="ex: 10+|Competiții pe an"
          rows={1}
          emptyLabel="Nicio statistică adăugată."
        />
      </EditorCard>

      <EditorCard title="Evenimente organizate de ACS EduSport">
        <StringList
          items={eventsOrganized}
          onChange={(next) => form.set('eventsOrganized', next)}
          addLabel="Adaugă eveniment"
          itemLabel="evenimentul"
          emptyLabel="Niciun eveniment adăugat."
        />
      </EditorCard>

      <EditorCard title="Participări ale sportivilor EduSport">
        <StringList
          items={eventsParticipated}
          onChange={(next) => form.set('eventsParticipated', next)}
          addLabel="Adaugă participare"
          itemLabel="participarea"
          emptyLabel="Nicio participare adăugată."
        />
      </EditorCard>
    </div>
  );
}

const IstoricPage: React.FC = () => {
  const page = useSingleType<HistoricPage>(UID.historicPage);
  const form = usePageForm<HistoricPage>(page.data, page.saveState);
  const ready = !page.loading && !page.error;

  return (
    <AdminPage>
      <TabbedWindow host="istoric" title="Istoric">
        {(tab) => (
          <>
            <div hidden={tab !== 'pagina'}>
              {page.loading && <Loading />}
              {page.error && (
                <div className="ui-body">
                  <Notice tone="danger">Nu am putut încărca pagina de istoric.</Notice>
                </div>
              )}
              {ready && <HistoricFields form={form} />}
            </div>
            {tab === 'momente' && <MomenteIstoricBody />}
            {ready && tab === 'pagina' && (
              <SaveBar {...page.saveState.bar} onSave={() => void page.save(form.value)} onDiscard={form.reset} />
            )}
          </>
        )}
      </TabbedWindow>

      <UnsavedGuard when={form.dirty} />
    </AdminPage>
  );
};

export default IstoricPage;
