import { TABLES_COPY } from './copy';
import type { SavedViewRow, TableDefinition } from './types';

/** Ready-made views carry this season id; the route swaps in the current season's id (`readyMadeFor`). */
export const CURRENT_SEASON_ID = 'current';

const scope = (period: TableDefinition['scope']['period']): TableDefinition['scope'] => ({ seasonId: CURRENT_SEASON_ID, sectionId: null, groupId: null, period });
const view = (id: string, name: string, d: Partial<TableDefinition> & Pick<TableDefinition, 'subject' | 'scope' | 'columns'>): SavedViewRow => ({
  id, name, subject: d.subject, definition: { filters: [], groupBy: null, sort: null, ...d },
  authorId: null, authorName: TABLES_COPY.readyMade.author, mine: false, canDelete: false, readyMade: true,
});
const money = ['sportiv', 'dePlatit', 'platit', 'ramas', 'starePlata'];

export const READY_MADE: SavedViewRow[] = [
  view('rm-plati-grupa', TABLES_COPY.readyMade.platiGrupa, { subject: 'sportivi', scope: scope({ kind: 'current' }), columns: money, groupBy: 'grupa' }),
  view('rm-prezenta-grupa', TABLES_COPY.readyMade.prezentaGrupa, { subject: 'prezenta', scope: scope({ kind: 'current' }), columns: ['data', 'ora', 'sportiv', 'tip', 'plata'], groupBy: 'grupa' }),
  view('rm-sportivi-activi', TABLES_COPY.readyMade.sportiviActivi, { subject: 'sportivi', scope: scope(null), filters: [{ column: 'stare', op: 'eq', value: 'Activ' }], columns: ['sportiv', 'grupa', 'abonament', 'telefon'] }),
  view('rm-ramas', TABLES_COPY.readyMade.ramas, { subject: 'sportivi', scope: scope(null), filters: [{ column: 'ramas', op: 'gt', value: 0 }], columns: ['sportiv', 'grupa', 'dePlatit', 'platit', 'ramas'], sort: { column: 'ramas', dir: 'desc' } }),
  view('rm-expira', TABLES_COPY.readyMade.expira, { subject: 'abonamente', scope: scope(null), filters: [{ column: 'stare', op: 'eq', value: 'activ' }, { column: 'expira', op: 'lt', value: '+14d' }], columns: ['cod', 'sportiv', 'grupa', 'abonament', 'expira', 'folosite'] }),
  view('rm-sportivi-plati', TABLES_COPY.readyMade.sportiviPlati, { subject: 'sportivi', scope: scope({ kind: 'current' }), columns: ['sportiv', 'varsta', 'telefon', 'dePlatit', 'platit', 'ramas', 'starePlata'], groupBy: 'grupa' }),
];

/** The ready-made views for a real season id. */
export const readyMadeFor = (seasonId: string): SavedViewRow[] =>
  READY_MADE.map((v) => ({ ...v, definition: { ...v.definition, scope: { ...v.definition.scope, seasonId } } }));
