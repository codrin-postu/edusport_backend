import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@strapi/admin/strapi-admin', () => ({ useFetchClient: () => ({}), getFetchClient: () => ({}) }));
vi.mock('@strapi/design-system', () => ({}));
vi.mock('@strapi/icons', () => ({}));
import { ControlRow } from '../../../admin/dashboard/sportivi/tabele/ControlRow';
import { ExportMenu } from '../../../admin/dashboard/sportivi/tabele/ExportMenu';
import { ResultTable } from '../../../admin/dashboard/sportivi/tabele/ResultTable';
import { CATALOG, GROUP_LABELS } from '../catalog';
import type { CatalogAnswer } from '../catalog-api';
import { TABLES_COPY } from '../copy';
import { READY_MADE } from '../ready-made';
import type { TableDefinition, TableResult, TableRow } from '../types';

/** Server-side render of the pure parts of the screen: every branch renders, and the text and structure the brief asks for is there. */
const catalog: CatalogAnswer = {
  subjects: CATALOG, groupLabels: GROUP_LABELS, today: '2026-11-20', maxRows: 5000, defaultViewId: 'rm-plati-grupa', readyMade: READY_MADE,
  seasons: [{ id: 's26', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', isCurrent: true }],
  sections: [{ id: 'sec1', name: 'Club' }], groups: [{ id: 'g1', name: 'Avansați', sectionId: 'sec1', active: true }],
};
const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const row = (i: number): TableRow => ({ athleteId: `a${i}`, groupKeys: {}, cells: { sportiv: `Ana ${i}`, suma: 1200 } });
const cols = [CATALOG.plati.columns.find((c) => c.key === 'sportiv')!, CATALOG.plati.columns.find((c) => c.key === 'suma')!];
const grouped = (n: number): TableResult => ({
  subject: 'plati', groupBy: 'grupa', columns: cols, count: n, notices: [], total: { suma: 1200 * n },
  rows: Array.from({ length: n }, (_, i) => row(i)),
  groups: [{ key: 'g1', label: 'Avansați', count: n, subtotal: { suma: 1200 * n }, rows: Array.from({ length: n }, (_, i) => row(i)) }],
});
const noop = () => undefined;

describe('Tabele render', () => {
  it('a grouped result shows the header with its count, rows, "Subtotal <grupă>" and "Total" with money', () => {
    const out = html(React.createElement(ResultTable, { result: grouped(2), sort: null, onSort: noop, collapsed: new Set(), onToggle: noop }));
    expect(out).toContain('Avansați, 2 plăți');
    expect(out).toContain('Subtotal Avansați');
    expect(out).toContain('Total');
    expect(out).toContain('1.200 RON');
    expect(out).toContain('2.400 RON');
    expect(out).toContain('Ana 1');
    expect(out).toContain('aria-expanded="true"');
  });

  it('a collapsed group keeps header and subtotal but not its rows', () => {
    const out = html(React.createElement(ResultTable, { result: grouped(2), sort: { column: 'suma', dir: 'desc' }, onSort: noop, collapsed: new Set(['g1']), onToggle: noop }));
    expect(out).not.toContain('Ana 1');
    expect(out).toContain('Subtotal Avansați');
    expect(out).toContain('aria-expanded="false"');
    expect(out).toContain('aria-sort="descending"');
  });

  it('an empty result says so', () => {
    expect(html(React.createElement(ResultTable, { result: { ...grouped(0), groups: [], rows: [] }, sort: null, onSort: noop, collapsed: new Set(), onToggle: noop }))).toContain('Niciun rând pentru alegerile astea.');
  });

  it('above 1.000 rows it renders one window of 200 lines with a pager', () => {
    const out = html(React.createElement(ResultTable, { result: grouped(1500), sort: null, onSort: noop, collapsed: new Set(), onToggle: noop }));
    expect(out.match(/<tr/g)?.length).toBeLessThan(210);
    expect(out).toContain('ui-pager');
  });

  it('the spreadsheet aspect adds a "#" column numbering rows only, not group or subtotal lines', () => {
    const out = html(React.createElement(ResultTable, { result: grouped(2), sort: null, onSort: noop, collapsed: new Set(), onToggle: noop, aspect: 'foaie' }));
    expect(out).toContain('>#</th>');
    expect(out.match(/<td class="tbl-n">\d+<\/td>/g)).toEqual(['<td class="tbl-n">1</td>', '<td class="tbl-n">2</td>']);
    expect(html(React.createElement(ResultTable, { result: grouped(2), sort: null, onSort: noop, collapsed: new Set(), onToggle: noop }))).not.toContain('>#</th>');
  });
});

describe('Tabele control row and export', () => {
  // Popover lays itself out in a layout effect, which React warns about on the server only; every other error still shows.
  beforeAll(() => {
    const real = console.error.bind(console);
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => { if (!args.join(' ').includes('useLayoutEffect')) real(...args); });
  });
  afterAll(() => vi.restoreAllMocks());
  const definition: TableDefinition = { subject: 'plati', scope: { seasonId: 's26', sectionId: null, groupId: null, period: null }, columns: ['data', 'sportiv', 'suma'], filters: [{ column: 'sportiv', op: 'eq', value: 'Ana' }], groupBy: null, sort: null };

  it('shows the table, scope, filter button, group-by, column count and aspect', () => {
    const control = html(React.createElement(ControlRow, { definition, catalog, onChange: noop, aspect: 'lista', onAspect: noop }));
    for (const text of ['Tabel:', 'Plăți', '2026-2027', 'Tot sezonul', 'Secțiune:', 'Grupă:', 'Grupează:', 'Sportiv: Ana', '+ Filtru', 'Coloane (3)', 'Aspect:', 'Listă', 'Foaie de calcul']) expect(control).toContain(text);
    expect(control).not.toContain('Subiect');
  });
  it('the export menu is a closed button with the right rows and columns known to it', () => {
    const out = html(React.createElement(ExportMenu, { canDownload: true, downloading: null, rows: 12, columns: 3, onDownload: noop }));
    expect(out).toContain('Exportă');
    expect(TABLES_COPY.export.exact(12, 3)).toBe('Exact ce vezi: 12 rânduri, 3 coloane, cu filtrele aplicate');
    expect(TABLES_COPY.export.exact(1, 1)).toBe('Exact ce vezi: 1 rând, 1 coloană, cu filtrele aplicate');
    expect(out).not.toContain('disabled');
    expect(html(React.createElement(ExportMenu, { canDownload: false, downloading: null, rows: 0, columns: 0, onDownload: noop }))).toContain('disabled');
  });
});
