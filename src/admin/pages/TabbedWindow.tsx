import * as React from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { AdminPage, Loading, Notice, PageHeader, SaveBar, Tabs, UnsavedGuard, Window } from '../ui';
import type { PageForm, SingleTypeState } from '../lib';
import { DASHBOARD_TO } from '../dashboard/menu';
import { hostTabItems, sameView, tabFromSearch, tabSearch, type HostId, type TabId } from '../../club/tab-hosts';

const SlotContext = React.createContext<HTMLElement | null>(null);

const SLOT_STYLE: React.CSSProperties = { display: 'contents' };

/** Puts a tab's own header action (like "+ Adaugă sponsor") into the host page header. */
export function HeaderAction({ children }: { children: React.ReactNode }) {
  const slot = React.useContext(SlotContext);
  return slot ? createPortal(children, slot) : null;
}

/** A site page window with a tab bar under its header; the open tab is the `?tab=` query. */
export function TabbedWindow({ host, title, children }: { host: HostId; title: string; children: (tab: TabId) => React.ReactNode }) {
  const { search } = useLocation();
  const navigate = useNavigate();
  const [slot, setSlot] = React.useState<HTMLElement | null>(null);
  const tab = tabFromSearch(host, search);
  return (
    <Window>
      <PageHeader back={{ to: DASHBOARD_TO }} title={title} actions={<span ref={setSlot} style={SLOT_STYLE} />} />
      <Tabs items={hostTabItems(host)} value={tab} onChange={(id) => navigate({ search: tabSearch(id as TabId) }, { replace: true })} />
      <SlotContext.Provider value={slot}>{children(tab)}</SlotContext.Provider>
    </Window>
  );
}

interface HostPageProps<T extends object> {
  host: HostId;
  title: string;
  page: SingleTypeState<T>;
  form: PageForm<T>;
  loadError: string;
  /** The page form, shown on the Pagina tab. */
  fields: React.ReactNode;
  /** The body of every other tab. */
  bodies: Partial<Record<TabId, React.ReactNode>>;
}

/**
 * A single-type page whose list pages are tabs. The form stays mounted (hidden)
 * while another tab is open, so unsaved edits survive tab switches; the save
 * bar shows on the Pagina tab only.
 */
export function SingleTypeHostPage<T extends object>({ host, title, page, form, loadError, fields, bodies }: HostPageProps<T>) {
  const ready = !page.loading && !page.error;
  return (
    <AdminPage>
      <TabbedWindow host={host} title={title}>
        {(tab) => (
          <>
            <div hidden={tab !== 'pagina'}>
              {page.loading && <Loading />}
              {page.error && (
                <div className="ui-body">
                  <Notice tone="danger">{loadError}</Notice>
                </div>
              )}
              {ready && fields}
            </div>
            {bodies[tab]}
            {ready && tab === 'pagina' && (
              <SaveBar {...page.saveState.bar} onSave={() => void page.save(form.value)} onDiscard={form.reset} />
            )}
          </>
        )}
      </TabbedWindow>
      <UnsavedGuard when={form.dirty} sameView={sameView} />
    </AdminPage>
  );
}
