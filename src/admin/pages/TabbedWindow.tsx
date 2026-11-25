import * as React from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageHeader, Tabs, Window } from '../ui';
import { DASHBOARD_TO } from '../dashboard/menu';
import { hostTabItems, tabFromSearch, tabSearch, type HostId, type TabId } from '../../club/tab-hosts';

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
