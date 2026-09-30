import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminPage, Window, PageHeader, EmptyState, LinkOutCard } from '../ui';
import { EVENIMENTE_COLABORARE_TO, UID, strapiEditorUrl } from './routes';

/**
 * Eveniment colaborare (EVENIMENT_COLABORARE_EDIT_TO). Placeholder: the page is built in its own step, see
 * docs/admin-ui/CUSTOM-PAGES.md, "How to build a page". Until then the
 * Strapi editor stays one click away (?strapi=1 skips the redirect).
 */
const EvenimentColaborareEditPage: React.FC = () => {
  const [params] = useSearchParams();
  const id = params.get('id');
  return (
    <AdminPage>
      <Window>
        <PageHeader back={{ to: EVENIMENTE_COLABORARE_TO }} title="Eveniment colaborare" />
        <div className="ui-body">
          <EmptyState>În lucru</EmptyState>
          <LinkOutCard
            title="Editorul Strapi"
            body="Până când pagina este gata, conținutul se editează în continuare în editorul Strapi."
            href={strapiEditorUrl(UID.collaborationEvent, 'collection', id ?? undefined)}
            linkLabel="Deschide în editorul Strapi"
          />
        </div>
      </Window>
    </AdminPage>
  );
};

export default EvenimentColaborareEditPage;
