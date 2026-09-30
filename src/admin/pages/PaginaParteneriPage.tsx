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
  LinkOutCard,
  normalizeObject,
} from '../ui';
import { useSingleType, usePageForm } from '../lib';
import { DASHBOARD_TO, SPONSORI_TO } from '../dashboard/menu';
import { EVENIMENTE_COLABORARE_TO, UID } from './routes';

/**
 * Pagina Parteneri (/plugins/edusport-pagina-parteneri): the partners-page
 * single type, for /parteneri.
 *
 * Replaces the content-manager view and its two custom fields:
 *   content: JSON, { heroTitle, heroSubtitle, introEyebrow, introHeading,
 *            introBody, ctaEyebrow, ctaHeading, ctaBody } (PartnersContentEditor)
 *   links:   nav-only field, no stored value worth editing here
 *            (component-preview PartnersLinksEditor) - kept as two
 *            LinkOutCard pointers to the Sponsori page and the Evenimente
 *            colaborare collection, same as the plugin editor.
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

const PaginaParteneriPage: React.FC = () => {
  const page = useSingleType<PartnersPage>(UID.partnersPage);
  const form = usePageForm<PartnersPage>(page.data, page.saveState);

  const content = normalizeObject<Content>(form.value.content, EMPTY_CONTENT);

  return (
    <AdminPage>
      <Window>
        <PageHeader
          back={{ to: DASHBOARD_TO }}
          title="Pagina Parteneri"
          subtitle="Textele de antet, „De ce parteneriat” și secțiunea de colaborare de pe pagina /parteneri"
        />

        {page.loading ? (
          <Loading />
        ) : page.error ? (
          <div className="ui-body">
            <Notice tone="danger">Nu am putut încărca pagina de parteneri.</Notice>
          </div>
        ) : (
          <div className="ui-body">
            <ObjectFieldCard<Content>
              title="Antet (hero)"
              description="Titlul și subtitlul din partea de sus a paginii."
              value={content}
              onFieldChange={(key, v) => form.set('content', { ...content, [key]: v })}
              fields={[
                { key: 'heroTitle', label: 'Titlu', placeholder: 'ex: Parteneri' },
                { key: 'heroSubtitle', label: 'Subtitlu', type: 'textarea', rows: 3, placeholder: 'ex: Împreună cu partenerii și sponsorii noștri...', span: 2 },
              ]}
            />

            <ObjectFieldCard<Content>
              title="De ce parteneriat"
              value={content}
              onFieldChange={(key, v) => form.set('content', { ...content, [key]: v })}
              fields={[
                { key: 'introEyebrow', label: 'Etichetă mică', placeholder: 'ex: De ce parteneriat' },
                { key: 'introHeading', label: 'Titlu secțiune', placeholder: 'ex: Susține o comunitate în creștere' },
                { key: 'introBody', label: 'Text', type: 'textarea', rows: 3, placeholder: 'ex: Un parteneriat cu clubul înseamnă vizibilitate...', span: 2 },
              ]}
            />

            <ObjectFieldCard<Content>
              title="Colaborează (secțiunea formular)"
              value={content}
              onFieldChange={(key, v) => form.set('content', { ...content, [key]: v })}
              fields={[
                { key: 'ctaEyebrow', label: 'Etichetă mică', placeholder: 'ex: Hai să colaborăm' },
                { key: 'ctaHeading', label: 'Titlu', placeholder: 'ex: Sponsorizează sau organizează un eveniment' },
                { key: 'ctaBody', label: 'Text', type: 'textarea', rows: 3, placeholder: 'ex: Vrei să sponsorizezi clubul sau să organizăm împreună un eveniment?', span: 2 },
              ]}
            />

            <LinkOutCard
              title="Sponsori"
              description="Logo-urile afișate în banda de sponsori sunt gestionate separat, ca înregistrări individuale."
              body="Adaugă, ordonează sau editează sponsorii din secțiunea dedicată."
              href={`/admin${SPONSORI_TO}`}
              linkLabel="Gestionează sponsorii"
              external={false}
            />

            <LinkOutCard
              title="Evenimente & colaborări"
              description="Evenimentele realizate împreună cu partenerii sunt înregistrări individuale."
              body="Adaugă sau editează evenimentele de colaborare din secțiunea dedicată."
              href={`/admin${EVENIMENTE_COLABORARE_TO}`}
              linkLabel="Gestionează evenimentele"
              external={false}
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

export default PaginaParteneriPage;
