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
  normalizeObject,
} from '../ui';
import { useSingleType, usePageForm } from '../lib';
import { DASHBOARD_TO } from '../dashboard/menu';
import { UID } from './routes';

/**
 * Pagina Echipă (/despre-noi/echipa on the site): the team-page single type.
 *
 * Replaces the content-manager view and its two custom fields,
 * component-preview PageBannerEditor (`banner`) and TeamPageInfoEditor
 * (`pageInfo`). Both are JSON attributes; the shapes stay exactly as those
 * editors wrote them, so the website reads them unchanged:
 *   banner:   { title, subtitle }
 *   pageInfo: { introText }
 * Keys the editors did not know are kept (the objects are merged, not rebuilt).
 * The members themselves are the team-member collection (Membri echipă).
 */

interface Banner {
  title: string;
  subtitle: string;
}

interface PageInfo {
  introText: string;
}

interface TeamPage {
  banner: Banner | null;
  pageInfo: PageInfo | null;
}

const EMPTY_BANNER: Banner = { title: '', subtitle: '' };
const EMPTY_INFO: PageInfo = { introText: '' };

const PaginaEchipaPage: React.FC = () => {
  const page = useSingleType<TeamPage>(UID.teamPage);
  const form = usePageForm<TeamPage>(page.data, page.saveState);

  const banner = normalizeObject<Banner>(form.value.banner, EMPTY_BANNER);
  const info = normalizeObject<PageInfo>(form.value.pageInfo, EMPTY_INFO);

  return (
    <AdminPage>
      <Window>
        <PageHeader
          back={{ to: DASHBOARD_TO }}
          title="Pagina Echipă"
        />

        {page.loading ? (
          <Loading />
        ) : page.error ? (
          <div className="ui-body">
            <Notice tone="danger">Nu am putut încărca pagina echipei.</Notice>
          </div>
        ) : (
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
              title="Introducere"
              value={info}
              onFieldChange={(key, v) => form.set('pageInfo', { ...info, [key]: v })}
              fields={[
                {
                  key: 'introText',
                  label: 'Text introducere',
                  type: 'textarea',
                  rows: 4,
                  placeholder: 'Textul de introducere al paginii echipei...',
                },
              ]}
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

export default PaginaEchipaPage;
