import { ABONAMENTE_PATH, DE_INCASAT_PATH, PLATI_PATH } from '../prezenta/routes';
import { isMonth, monthOf } from '../presence/dates';

export const CONTABILITATE_PATH = '/plugins/edusport-contabilitate';
const OLD_BANI_PATH = '/plugins/edusport-bani';

export type ContabTab = 'restante' | 'abonamente' | 'plati' | 'pe-grupe';
/** `rest` = the tab's own filter params (everything except `tab` and `month`). */
export type ContabQuery = { tab: ContabTab; month: string; rest: URLSearchParams };

const TABS: readonly ContabTab[] = ['restante', 'abonamente', 'plati', 'pe-grupe'];

/** The address of Contabilitate: default tab Restante and the current month; a month after today's is the current one. */
export function readContabQuery(search: string, today: string): ContabQuery {
  const params = new URLSearchParams(search);
  const current = monthOf(today);
  const month = params.get('month');
  const rest = new URLSearchParams(params);
  rest.delete('tab');
  rest.delete('month');
  return {
    tab: TABS.find((t) => t === params.get('tab')) ?? 'restante',
    month: isMonth(month) && month <= current ? month : current,
    rest,
  };
}

/** `tab` first, then `month`, then the filter params in the order given. */
export function contabTo(q: { tab?: ContabTab; month?: string; params?: Record<string, string> }): string {
  const out = new URLSearchParams();
  if (q.tab !== undefined) out.set('tab', q.tab);
  if (q.month !== undefined) out.set('month', q.month);
  for (const [k, v] of Object.entries(q.params ?? {})) out.set(k, v);
  const qs = out.toString();
  return qs ? `${CONTABILITATE_PATH}?${qs}` : CONTABILITATE_PATH;
}

const onPath = (path: string, base: string): boolean => path === base || path.startsWith(`${base}/`);

/** Old money page address -> new one, keeping month and filter params. null when `path` is not an old money page. */
export function oldMoneyRedirect(path: string, search: string): string | null {
  const params = new URLSearchParams(search);
  let tab: ContabTab;
  if (onPath(path, ABONAMENTE_PATH)) tab = 'abonamente';
  else if (onPath(path, PLATI_PATH)) tab = 'plati';
  else if (onPath(path, DE_INCASAT_PATH)) tab = 'restante';
  else if (onPath(path, OLD_BANI_PATH)) tab = params.get('view') === 'contabilitate' ? 'pe-grupe' : 'restante';
  else return null;
  const month = params.get('month') ?? undefined;
  const carried: Record<string, string> = {};
  for (const [k, v] of params) if (k !== 'tab' && k !== 'view' && k !== 'month') carried[k] = v;
  return contabTo({ tab, month, params: carried });
}
