import * as React from 'react';
import { AdminPage, Window, PageHeader, EmptyState, LinkOutCard } from '../ui';
import { DASHBOARD_TO } from '../dashboard/menu';
import { UID, strapiEditorUrl } from './routes';

/**
 * Prețuri (PRETURI_TO). Placeholder: the page is built in its own step, see
 * docs/admin-ui/CUSTOM-PAGES.md, "How to build a page". Until then the
 * Strapi editor stays one click away (?strapi=1 skips the redirect).
 */
const PreturiPage: React.FC = () => {
  return (
    <AdminPage>
      <Window>
        <PageHeader back={{ to: DASHBOARD_TO }} title="Prețuri" />
        <div className="ui-body">
          <EmptyState>În lucru</EmptyState>
          <LinkOutCard
            title="Editorul Strapi"
            body="Până când pagina este gata, conținutul se editează în continuare în editorul Strapi."
            href={strapiEditorUrl(UID.pricing, 'single')}
            linkLabel="Deschide în editorul Strapi"
          />
        </div>
      </Window>
    </AdminPage>
  );
};

export default PreturiPage;
