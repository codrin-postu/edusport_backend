/** Site pages that carry their list pages as tabs: the open tab lives in the address as `?tab=<id>`. */
export const HOST_TABS = {
  parteneri: ['pagina', 'sponsori', 'evenimente'],
  istoric: ['pagina', 'momente'],
} as const;

export type HostId = keyof typeof HOST_TABS;
export type TabId = (typeof HOST_TABS)[HostId][number];

export const TAB_LABELS: Record<TabId, string> = {
  pagina: 'Pagina',
  sponsori: 'Sponsori',
  evenimente: 'Evenimente colaborare',
  momente: 'Momente istoric',
};

export const FIRST_TAB: TabId = 'pagina';

export function hostTabItems(host: HostId): { id: TabId; label: string }[] {
  return HOST_TABS[host].map((id) => ({ id, label: TAB_LABELS[id] }));
}

/** The tab the address asks for; none, or one this host does not have, is the page form. */
export function tabFromSearch(host: HostId, search: string): TabId {
  const wanted = new URLSearchParams(search).get('tab');
  return HOST_TABS[host].find((id) => id === wanted) ?? FIRST_TAB;
}

/** The query that opens a tab; the page form has none. */
export function tabSearch(tab: TabId): string {
  return tab === FIRST_TAB ? '' : `?tab=${tab}`;
}

/** Address of a host page with a tab open; other query values (like `id`) are kept. */
export function tabAddress(base: string, tab: TabId, search = ''): string {
  const params = new URLSearchParams(search);
  params.delete('tab');
  if (tab !== FIRST_TAB) params.set('tab', tab);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}
