import * as React from 'react';
import {
  AdminPage,
  Notice,
  Loading,
  SaveBar,
  UnsavedGuard,
  ObjectFieldCard,
  normalizeObject,
} from '../ui';
import { useSingleType, usePageForm } from '../lib';
import SponsoriBody from '../dashboard/SponsoriPage';
import EvenimenteColaborareBody from './EvenimenteColaborarePage';
import { TabbedWindow } from './TabbedWindow';
import { UID } from './routes';

/**
 * Pagina Parteneri (/plugins/edusport-pagina-parteneri): the partners-page
 * single type, for /parteneri.
 *
 * Replaces the content-manager view and its custom field:
 *   content: JSON, { heroTitle, heroSubtitle, introEyebrow, introHeading,
 *            introBody, ctaEyebrow, ctaHeading, ctaBody } (PartnersContentEditor)
 * The nav-only `links` field has no stored value; Sponsori and Evenimente
 * colaborare are tabs of this page.
 * Keys the content editor did not know are kept (merged, not rebuilt).
 */

interface Content {
  heroTitle: string;
  heroSubtitle: string;
  introEyebrow: string;
  introHeading: string;
  introBody: string;
  ctaEyebrow: string;
  ctaHeading: string;
  ctaBody: string;
}

interface PartnersPage {
  content: Content | null;
  links: unknown;
}

const EMPTY_CONTENT: Content = {
  heroTitle: '',
  heroSubtitle: '',
  introEyebrow: '',
  introHeading: '',
  introBody: '',
  ctaEyebrow: '',
  ctaHeading: '',
  ctaBody: '',
};

type PartnersForm = ReturnType<typeof usePageForm<PartnersPage>>;

function PartnersFields({ form }: { form: PartnersForm }) {
  const content = normalizeObject<Content>(form.value.content, EMPTY_CONTENT);
  const change = (key: keyof Content, v: string) => form.set('content', { ...content, [key]: v });
  return (
    <div className="ui-body">
      <ObjectFieldCard<Content>
        title="Antet (hero)"
        value={content}
        onFieldChange={change}
        fields={[
          { key: 'heroTitle', label: 'Titlu', placeholder: 'ex: Parteneri' },
          { key: 'heroSubtitle', label: 'Subtitlu', type: 'textarea', rows: 3, placeholder: 'ex: Împreună cu partenerii și sponsorii noștri...', span: 2 },
        ]}
      />

      <ObjectFieldCard<Content>
        title="De ce parteneriat"
        value={content}
        onFieldChange={change}
        fields={[
          { key: 'introEyebrow', label: 'Etichetă mică', placeholder: 'ex: De ce parteneriat' },
          { key: 'introHeading', label: 'Titlu secțiune', placeholder: 'ex: Susține o comunitate în creștere' },
          { key: 'introBody', label: 'Text', type: 'textarea', rows: 3, placeholder: 'ex: Un parteneriat cu clubul înseamnă vizibilitate...', span: 2 },
        ]}
      />

      <ObjectFieldCard<Content>
        title="Colaborează (secțiunea formular)"
        value={content}
        onFieldChange={change}
        fields={[
          { key: 'ctaEyebrow', label: 'Etichetă mică', placeholder: 'ex: Hai să colaborăm' },
          { key: 'ctaHeading', label: 'Titlu', placeholder: 'ex: Sponsorizează sau organizează un eveniment' },
          { key: 'ctaBody', label: 'Text', type: 'textarea', rows: 3, placeholder: 'ex: Vrei să sponsorizezi clubul sau să organizăm împreună un eveniment?', span: 2 },
        ]}
      />
    </div>
  );
}

const PaginaParteneriPage: React.FC = () => {
  const page = useSingleType<PartnersPage>(UID.partnersPage);
  const form = usePageForm<PartnersPage>(page.data, page.saveState);
  const ready = !page.loading && !page.error;

  return (
    <AdminPage>
      <TabbedWindow host="parteneri" title="Pagina Parteneri">
        {(tab) => (
          <>
            <div hidden={tab !== 'pagina'}>
              {page.loading && <Loading />}
              {page.error && (
                <div className="ui-body">
                  <Notice tone="danger">Nu am putut încărca pagina de parteneri.</Notice>
                </div>
              )}
              {ready && <PartnersFields form={form} />}
            </div>
            {tab === 'sponsori' && <SponsoriBody />}
            {tab === 'evenimente' && <EvenimenteColaborareBody />}
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

export default PaginaParteneriPage;
