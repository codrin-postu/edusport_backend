import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@strapi/admin/strapi-admin', () => ({ useFetchClient: () => ({}), getFetchClient: () => ({}) }));
vi.mock('@strapi/design-system', () => ({}));
vi.mock('@strapi/icons', () => ({}));
import { Builder } from '../../../admin/dashboard/sportivi/tabele/Builder';
import { NewViewModal } from '../../../admin/dashboard/sportivi/tabele/NewViewModal';
import { ResultTable } from '../../../admin/dashboard/sportivi/tabele/ResultTable';
import { ViewBar } from '../../../admin/dashboard/sportivi/tabele/ViewBar';
import { CATALOG, GROUP_LABELS } from '../catalog';
import type { CatalogAnswer } from '../catalog-api';
import { READY_MADE } from '../ready-made';
import type { SavedViewRow, TableResult, TableRow } from '../types';

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

  it('the builder renders every section with the exact labels, the chosen columns first', () => {
    const out = html(React.createElement(Builder, { definition: READY_MADE[0].definition!, catalog, onChange: noop }));
    for (const t of ['Subiect', 'Sfera', 'Sezon', 'Secțiune', 'Grupă', 'Perioada', 'Coloane, în ordine', 'Filtre', '+ filtru', 'Grupează după', 'Sortare', 'Sportivi', 'Plăți', 'Abonamente', 'Prezență']) expect(out, t).toContain(t);
    expect(out).toContain('Tot sezonul');
    expect(out).toContain('draggable="true"');
  });

  it('the view bar offers the buttons actionsFor gives and both downloads', () => {
    const base = { ready: READY_MADE, saved: [] as SavedViewRow[], canDownload: true, downloading: null, onPick: noop, onSave: noop, onSaveAsNew: noop, onDuplicate: noop, onRemove: noop, onDownload: noop };
    const ready = html(React.createElement(ViewBar, { ...base, current: READY_MADE[0], dirty: true }));
    expect(ready).toContain('Salvează ca nouă');
    expect(ready).toContain('Duplică');
    expect(ready).toContain('Descarcă .xlsx');
    expect(ready).toContain('Descarcă .csv');
    expect(ready).not.toContain('Șterge');
    const mine: SavedViewRow = { ...READY_MADE[0], id: 'v1', readyMade: false, mine: true, canDelete: true, authorId: '1', authorName: 'Ana' };
    const own = html(React.createElement(ViewBar, { ...base, saved: [mine], current: mine, dirty: true }));
    expect(own).toContain('Șterge');
    expect(own.replace('Salvează ca nouă', '')).toContain('Salvează');
    expect(html(React.createElement(ViewBar, { ...base, saved: [mine], current: mine, dirty: false })).replace('Salvează ca nouă', '')).not.toContain('Salvează');
  });

  it('the new-view modal is closed until opened', () => {
    expect(html(React.createElement(NewViewModal, { open: false, initialName: '', onSave: async () => null, onClose: noop }))).toBe('');
  });
});
