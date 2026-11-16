import * as React from 'react';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@strapi/admin/strapi-admin', () => ({ useFetchClient: () => ({}), getFetchClient: () => ({}) }));
vi.mock('@strapi/design-system', () => ({}));
vi.mock('@strapi/icons', () => ({}));
import { FilterChips } from '../../../admin/dashboard/sportivi/tabele/FilterChips';
import { MetaRow } from '../../../admin/dashboard/sportivi/tabele/MetaRow';
import { TypeBar } from '../../../admin/dashboard/sportivi/tabele/TypeBar';
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
  it('a grouped result shows the header with its count, rows and "Total" lines with money', () => {
    const out = html(React.createElement(ResultTable, { result: grouped(2), sort: null, onSort: noop, collapsed: new Set(), onToggle: noop }));
    expect(out).toContain('Avansați');
    expect(out).toContain('2 plăți');
    expect(out).toContain('>Total<');
    expect(out).not.toContain('Subtotal');
    expect(out).not.toContain('Total general');
    expect(out).toContain('1.200 RON');
    expect(out).toContain('2.400 RON');
    expect(out).toContain('Ana 1');
    expect(out).toContain('aria-expanded="true"');
  });

  it('the count of a result equals the rendered rows, and a plati result with rows is not the empty state', () => {
    const result: TableResult = { ...grouped(4), groupBy: null, groups: null };
    const out = html(React.createElement(ResultTable, { result, sort: null, onSort: noop, collapsed: new Set(), onToggle: noop }));
    expect(out.match(/Ana \d/g)).toHaveLength(result.count);
    expect(out).not.toContain('Nicio plată');
  });

  it('a collapsed group keeps header and subtotal but not its rows', () => {
    const out = html(React.createElement(ResultTable, { result: grouped(2), sort: { column: 'suma', dir: 'desc' }, onSort: noop, collapsed: new Set(['g1']), onToggle: noop }));
    expect(out).not.toContain('Ana 1');
    expect(out).toContain('>Total<');
    expect(out).toContain('aria-expanded="false"');
    expect(out).toContain('aria-sort="descending"');
  });

  it('a table with no money column has no total lines, and a status value is a badge', () => {
    const stare = CATALOG.abonamente.columns.find((c) => c.key === 'stare')!;
    const res: TableResult = { ...grouped(2), subject: 'abonamente', columns: [cols[0], stare], total: {}, groups: null, groupBy: null, rows: [{ athleteId: 'a1', groupKeys: {}, cells: { sportiv: 'Ana', stare: 'activ' } }] };
    const out = html(React.createElement(ResultTable, { result: res, sort: null, onSort: noop, collapsed: new Set(), onToggle: noop }));
    expect(out).not.toContain('Total');
    expect(out).toContain('ui-badge');
  });

  it('several groups end with Total general', () => {
    const g = grouped(1);
    const res: TableResult = { ...g, groups: [...g.groups!, { ...g.groups![0], key: 'g2', label: 'Începători' }] };
    expect(html(React.createElement(ResultTable, { result: res, sort: null, onSort: noop, collapsed: new Set(), onToggle: noop }))).toContain('Total general');
  });

  it('an empty result says so', () => {
    expect(html(React.createElement(ResultTable, { result: { ...grouped(0), groups: [], rows: [] }, sort: null, onSort: noop, collapsed: new Set(), onToggle: noop }))).toContain('Nicio plată.');
  });

  it('above 1.000 rows it renders one window of 200 lines with a pager', () => {
    const out = html(React.createElement(ResultTable, { result: grouped(1500), sort: null, onSort: noop, collapsed: new Set(), onToggle: noop }));
    expect(out.match(/<tr/g)?.length).toBeLessThan(210);
    expect(out).toContain('ui-pager');
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

  it('shows the five types, the one period, the chip, the Filtru button, grouping and column count, with no row labels', () => {
    const bar = html(React.createElement(TypeBar, { definition, catalog, onChange: noop }));
    for (const text of ['Sportivi', 'Plăți', 'Abonamente', 'Prezență', 'Prezență pe ședințe', 'Sezonul 2026-2027']) expect(bar).toContain(text);
    const chips = html(React.createElement(FilterChips, { definition: { ...definition, filters: [{ column: 'metoda', op: 'eq', value: 'Card' }] }, catalog, onChange: noop }));
    expect(chips).toContain('Metodă: Card');
    expect(chips).toContain('aria-label="Șterge"');
    expect(chips).toContain('Filtru');
    const meta = html(React.createElement(MetaRow, { definition, columns: CATALOG.plati.columns, count: 12, onChange: noop }));
    for (const text of ['12 plăți', 'Negrupat', 'Coloane (3)']) expect(meta).toContain(text);
    for (const label of ['Tabel:', 'Secțiune:', 'Grupă:', 'Grupează:', 'Filtre', 'Perioada:']) expect(bar + chips + meta).not.toContain(`>${label}`);
  });
  it('Prezență pe ședințe shows a group select reading Selectează, no Filtru, no grouping, no columns', () => {
    const sed: TableDefinition = { ...definition, subject: 'sedinte', columns: ['sportiv', 'total'], filters: [] };
    const chips = html(React.createElement(FilterChips, { definition: sed, catalog, onChange: noop }));
    expect(chips).toContain('Selectează');
    expect(chips).not.toContain('Filtru');
    const meta = html(React.createElement(MetaRow, { definition: sed, columns: [], count: 3, onChange: noop }));
    expect(meta).toContain('3 sportivi');
    expect(meta).not.toContain('Negrupat');
    expect(meta).not.toContain('Coloane');
  });
  it('the download is a split button: primary "Descarcă Excel" and an arrow menu, both off when nothing can be downloaded', () => {
    const out = html(React.createElement(ExportMenu, { canDownload: true, downloading: null, onDownload: noop }));
    expect(out).toContain('Descarcă Excel');
    expect(out).toContain('aria-haspopup="menu"');
    expect(out).not.toContain('disabled');
    const off = html(React.createElement(ExportMenu, { canDownload: false, downloading: null, onDownload: noop }));
    expect(off.match(/disabled/g)?.length).toBe(2);
  });
});

const tabele = (file: string) => readFileSync(join(__dirname, '../../../admin/dashboard/sportivi/tabele', file), 'utf8');

describe('Tabele table source', () => {
  it('the columns popover has a search, a checkbox per column and Sus and Jos buttons, no visible label', () => {
    const src = tabele('ColumnsPopover.tsx');
    expect(src).toContain('MenuButton');
    expect(src).toContain('<Input');
    expect(src).toContain('<Checkbox');
    expect(src).toContain('moveColumnTo');
    expect(src).not.toContain('<h4');
    expect(TABLES_COPY.columnSearch).toBe('Caută');
    expect([TABLES_COPY.moveUp, TABLES_COPY.moveDown]).toEqual(['Sus', 'Jos']);
  });
  it('the table has collapsible groups, totals through tableLines, sortable headers and a link to the athlete', () => {
    const src = tabele('ResultTable.tsx');
    expect(src).toContain('aria-expanded');
    expect(src).toContain('tableLines');
    expect(src).toContain('aria-sort');
    expect(src).toContain('eduLinkHref');
  });
  it('there is no sort select and no Sortare text under tabele', () => {
    for (const file of readdirSync(join(__dirname, '../../../admin/dashboard/sportivi/tabele'))) expect(tabele(file), file).not.toMatch(/Sortare|<Select[^>]*sort/i);
    expect(JSON.stringify(TABLES_COPY)).not.toContain('Sortare');
  });
});

describe('Tabele shell source', () => {
  it('the header has the rail toggle, the title, "Salvează tabelul" and the split download', () => {
    const header = tabele('TableHeader.tsx');
    expect(header).toContain('aria-expanded');
    expect(header).toContain('aria-controls');
    expect(header).toMatch(/<h1[^>]*>\{title\}<\/h1>/);
    expect(header).toContain('TABLES_COPY.saveTable');
    expect(header).toContain('<ExportMenu');
    expect(TABLES_COPY.saveTable).toBe('Salvează tabelul');
    const split = tabele('ExportMenu.tsx');
    expect(split).toContain('TABLES_COPY.export.button');
    expect(split).toContain('EXPORT_FORMATS');
    expect(TABLES_COPY.export.button).toBe('Descarcă Excel');
  });
  it('the page has no Aspect, Listă or Foaie de calcul and no helper text on the export', () => {
    for (const file of readdirSync(join(__dirname, '../../../admin/dashboard/sportivi/tabele'))) {
      const src = tabele(file);
      for (const word of ['Aspect', 'Listă', 'Foaie de calcul', 'aspect', 'Exact ce vezi']) expect(src, `${file} ${word}`).not.toContain(word);
    }
    expect(JSON.stringify(TABLES_COPY)).not.toMatch(/Aspect|Foaie de calcul|Exact ce vezi/);
  });
  it('up to the tablet width the rail is a slide-over with a scrim that closes on pick', () => {
    const rail = tabele('SavedRail.tsx');
    expect(tabele('TabelePage.tsx')).toMatch(/useMediaQuery\(OVERLAY_QUERY\)/);
    expect(tabele('TabelePage.tsx')).toContain('RAIL_OVERLAY_MAX');
    expect(rail).toContain('tbl-scrim');
    expect(rail).toMatch(/onPick\(v\.id\);\s*if \(overlay\) onClose\(\)/);
  });
  it('the page remembers the rail in localStorage inside try/catch', () => {
    const page = tabele('TabelePage.tsx');
    expect(page).toContain('RAIL_KEY');
    expect(page).toMatch(/try \{[^}]*localStorage\.getItem\(RAIL_KEY\)[^}]*\} catch/);
    expect(page).toMatch(/try \{[^}]*localStorage\.setItem\(RAIL_KEY[^}]*\} catch/);
  });
});
