import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SPORTIVI_PATH } from '../../sportivi/routes';
import { TABLES_COPY as C } from '../copy';
import { READY_MADE } from '../ready-made';
import { TABLES_AREA, readTablesQuery, tablesTo } from '../routes';
import type { SavedViewRow, TableDefinition } from '../types';
import { actionsFor, groupHeader, isDirty, windowed } from '../view-state';

const def: TableDefinition = { subject: 'plati', scope: { seasonId: 's1', sectionId: null, groupId: null, period: { kind: 'current' } }, columns: ['data', 'suma'], filters: [{ column: 'suma', op: 'gt', value: 10 }], groupBy: 'grupa', sort: null };
const saved = (over: Partial<SavedViewRow> = {}): SavedViewRow => ({ id: 'v1', name: 'A', subject: 'plati', definition: def, authorId: '1', authorName: 'Ana', mine: true, canDelete: true, readyMade: false, ...over });

describe('Tabele copy', () => {
  it('has the exact texts of the brief', () => {
    expect(C.tabs).toEqual({ lista: 'Listă', tabele: 'Tabele' });
    expect([C.view, C.readyGroup, C.savedGroup, C.readyHint, C.save, C.saveAsNew, C.duplicate, C.remove, C.xlsx, C.csv, C.editMobile]).toEqual([
      'Vizualizare', 'Gata făcute', 'Salvate', 'Gata făcută', 'Salvează', 'Salvează ca nouă', 'Duplică', 'Șterge', 'Descarcă .xlsx', 'Descarcă .csv', 'Editează tabelul']);
    expect([C.subject, C.scope, C.season, C.section, C.group, C.all, C.period, C.wholeSeason, C.columns, C.filters, C.addFilter, C.groupBy, C.none, C.sort]).toEqual([
      'Subiect', 'Sfera', 'Sezon', 'Secțiune', 'Grupă', 'Toate', 'Perioada', 'Tot sezonul', 'Coloane, în ordine', 'Filtre', '+ filtru', 'Grupează după', 'Fără', 'Sortare']);
    expect([C.total, C.newTitle, C.name, C.giveUp, C.saved, C.savedShort, C.deleted, C.undo, C.empty]).toEqual([
      'Total', 'Vizualizare nouă', 'Nume', 'Renunță', 'Vizualizare salvată.', 'Salvat.', 'Vizualizare ștearsă.', 'Anulează', 'Niciun rând pentru alegerile astea.']);
    expect(C.subtotal('Grupa A')).toBe('Subtotal Grupa A');
    expect(C.copyOf('Plăți')).toBe('Plăți (copie)');
    expect(C.confirmDelete('Plăți')).toBe('Ștergi vizualizarea "Plăți"?');
    expect(C.errors).toEqual({
      tooMany: 'Tabelul are peste 5.000 de rânduri. Restrânge sfera sau filtrele.', tooSlow: 'Tabelul durează prea mult. Restrânge sfera.',
      nameTaken: 'Există deja o vizualizare cu numele ăsta.', notAuthor: 'Doar autorul poate modifica vizualizarea.',
      tooManyViews: 'Prea multe vizualizări salvate. Șterge una.', download: 'Descărcarea nu a reușit.',
    });
  });

  it('shares its texts with the server messages (one source)', () => {
    expect(C.errors.nameTaken).toBe(C.views.duplicate);
    expect(C.errors.tooManyViews).toBe(C.views.tooMany);
    expect(C.errors.notAuthor).toBe(C.views.notAuthor);
    expect([C.saved, C.savedShort, C.deleted]).toEqual([C.views.saved, C.views.updated, C.views.deleted]);
  });

  it('keeps the ready-made names the views use', () => {
    expect(READY_MADE.map((v) => v.name)).toEqual(['Plăți pe grupă luna aceasta', 'Prezență pe grupă', 'Sportivi activi', 'Rămas de plată', 'Abonamente care expiră', 'Sportivi pe grupă, cu plăți']);
  });

  it('every COPY NEEDED value is one of the known gaps, and nothing else is missing copy', () => {
    const found: string[] = [];
    const walk = (v: unknown, path: string): void => {
      if (typeof v === 'string' && v.includes('COPY NEEDED')) found.push(path);
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
    };
    walk(C, 'TABLES_COPY');
    expect(found).toEqual([
      'TABLES_COPY.brokenView', 'TABLES_COPY.ops.in', 'TABLES_COPY.ops.empty', 'TABLES_COPY.ops.notEmpty', 'TABLES_COPY.notices.columnDropped', 'TABLES_COPY.notices.filterDropped', 'TABLES_COPY.notices.groupByDropped', 'TABLES_COPY.notices.sectionMissing',
      'TABLES_COPY.notices.groupMissing', 'TABLES_COPY.notices.seasonMissing', 'TABLES_COPY.notices.periodReset']);
  });

  it('the source has no forbidden characters', () => {
    expect(readFileSync(new URL('../copy.ts', import.meta.url), 'utf8')).not.toMatch(/[—–·„”“]|\p{Extended_Pictographic}/u);
  });
});

describe('address', () => {
  it('is the money area', () => {
    expect(TABLES_AREA).toBe('money');
  });

  it('reads ?vedere=tabele&v=<id>; anything else is the list', () => {
    expect(readTablesQuery('?vedere=tabele&v=rm-ramas')).toEqual({ tab: 'tabele', viewId: 'rm-ramas' });
    expect(readTablesQuery('vedere=tabele')).toEqual({ tab: 'tabele', viewId: null });
    expect(readTablesQuery('?vedere=lista&v=x')).toEqual({ tab: 'lista', viewId: null });
    expect(readTablesQuery('')).toEqual({ tab: 'lista', viewId: null });
    expect(readTablesQuery('?v=x')).toEqual({ tab: 'lista', viewId: null });
    expect(readTablesQuery('?vedere=tabele&v=%20')).toEqual({ tab: 'tabele', viewId: null });
  });

  it('builds the address and round-trips', () => {
    expect(tablesTo(null)).toBe(`${SPORTIVI_PATH}?vedere=tabele`);
    expect(tablesTo('a b/c')).toBe(`${SPORTIVI_PATH}?vedere=tabele&v=a%20b%2Fc`);
    expect(readTablesQuery(tablesTo('a b/c').split('?')[1])).toEqual({ tab: 'tabele', viewId: 'a b/c' });
  });
});

describe('isDirty', () => {
  it('compares definitions by value, not by key order', () => {
    expect(isDirty(def, structuredClone(def))).toBe(false);
    expect(isDirty(def, { sort: null, groupBy: 'grupa', filters: [{ value: 10, op: 'gt', column: 'suma' }], columns: ['data', 'suma'], scope: { period: { kind: 'current' }, groupId: null, sectionId: null, seasonId: 's1' }, subject: 'plati' })).toBe(false);
  });
  it('sees a column order, filter, sort, scope or group change', () => {
    expect(isDirty(def, { ...def, columns: ['suma', 'data'] })).toBe(true);
    expect(isDirty(def, { ...def, filters: [] })).toBe(true);
    expect(isDirty(def, { ...def, sort: { column: 'suma', dir: 'asc' } })).toBe(true);
    expect(isDirty(def, { ...def, scope: { ...def.scope, period: null } })).toBe(true);
    expect(isDirty(def, { ...def, groupBy: null })).toBe(true);
  });
});

describe('actionsFor [5.5]', () => {
  it('own view: save only when dirty, save as new, duplicate, remove', () => {
    expect(actionsFor(saved(), false)).toEqual({ save: false, saveAsNew: true, duplicate: true, remove: true });
    expect(actionsFor(saved(), true)).toEqual({ save: true, saveAsNew: true, duplicate: true, remove: true });
  });
  it("someone else's view: never save; remove only for a Super Admin (canDelete)", () => {
    const theirs = saved({ mine: false, canDelete: false });
    expect(actionsFor(theirs, true)).toEqual({ save: false, saveAsNew: true, duplicate: true, remove: false });
    expect(actionsFor(saved({ mine: false, canDelete: true }), true)).toEqual({ save: false, saveAsNew: true, duplicate: true, remove: true });
  });
  it('a ready-made view: save as new and duplicate only, even dirty', () => {
    for (const v of READY_MADE) expect(actionsFor(v, true), v.id).toEqual({ save: false, saveAsNew: true, duplicate: true, remove: false });
  });
  it('a broken view can only be removed (by who may)', () => {
    expect(actionsFor(saved({ broken: true, definition: null }), true)).toEqual({ save: false, saveAsNew: false, duplicate: false, remove: true });
    expect(actionsFor(saved({ broken: true, definition: null, mine: false, canDelete: false }), false)).toEqual({ save: false, saveAsNew: false, duplicate: false, remove: false });
  });
});

describe('groupHeader and windowed', () => {
  it('writes "<grupă>, <n> <noun>" with the Romanian "de"', () => {
    expect(groupHeader('sportivi', 'Intermediari Bronze', 12)).toBe('Intermediari Bronze, 12 sportivi');
    expect(groupHeader('plati', 'Ianuarie', 1)).toBe('Ianuarie, 1 plată');
    expect(groupHeader('abonamente', 'Avansați', 8)).toBe('Avansați, 8 abonamente');
    expect(groupHeader('prezenta', 'Avansați', 40)).toBe('Avansați, 40 de prezențe');
    expect(groupHeader('sportivi', 'X', 101)).toBe('X, 101 sportivi');
  });
  it('windows above 1.000 rows only', () => {
    expect([windowed(0), windowed(1000), windowed(1001), windowed(5000)]).toEqual([false, false, true, true]);
  });
});
