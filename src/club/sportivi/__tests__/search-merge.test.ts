import { describe, expect, it } from 'vitest';
import type { AthleteCard, MergePreview, MergeSideView } from '../../athletes/api-types';
import {
  ADD_COPY, SEARCH_COPY, SEARCH_FAILED, cardSubline, movedOption, noResultsText, resultsText, searchUrl, showNewRow, withoutAthlete,
} from '../search-view';
import { MERGE_COPY, initialMerge, keptName, mergeRequest, mergeRows, withKept, withPick } from '../merge-view';

const card = (over: Partial<AthleteCard> = {}): AthleteCard => ({
  documentId: 'a1', name: 'Maria Pop', birthDate: '14.03.2016', lastGroup: { name: 'Primii Pași', season: '2025-2026' },
  lastRegistrationSeason: '2025-2026', contactName: 'Ana Pop', status: 'activ', ...over,
});

describe('search rows (spec 4.1, 6.7)', () => {
  it('two lines: the name, then birth date, last group with its season, and parent with commas', () => {
    expect(cardSubline(card())).toBe('14.03.2016, Primii Pași 2025-2026, Ana Pop');
    expect(cardSubline(card({ birthDate: null, lastGroup: null }))).toBe('Ana Pop');
    expect(cardSubline(card({ birthDate: null, lastGroup: null, contactName: null }))).toBe('');
  });

  it('"Sportiv nou" always shows under the search results (Needs decision 2, RESOLVED option B)', () => {
    expect(showNewRow(null)).toBe(false);
    expect(showNewRow({ q: 'Ion', cards: [card()] })).toBe(true);
    expect(showNewRow({ q: 'Ion', cards: [] })).toBe(true);
    expect(noResultsText({ q: 'Zzz', cards: [] })).toBe('Niciun sportiv găsit pentru "Zzz".');
  });

  it('query, the record itself left out of the merge search, copy', () => {
    expect(searchUrl('  maria pop ')).toBe('/api/club/athletes/search?q=maria%20pop');
    expect(withoutAthlete([card(), card({ documentId: 'a2' })], 'a1').map((c) => c.documentId)).toEqual(['a2']);
    expect(withoutAthlete([card()], undefined)).toHaveLength(1);
    expect(SEARCH_COPY).toEqual({ placeholder: 'Nume, data nașterii, părinte sau telefon', newAthlete: 'Sportiv nou' });
    expect([ADD_COPY.title, ADD_COPY.name, ADD_COPY.birth, ADD_COPY.contact, ADD_COPY.phone, ADD_COPY.email]).toEqual([
      'Adaugă sportiv', 'Nume complet', 'Data nașterii', 'Persoana de contact', 'Telefon', 'E-mail',
    ]);
  });
});

const side = (documentId: string, name: string, fields: Partial<MergeSideView['fields']>): MergeSideView => ({
  documentId, name, status: 'activ', profileSlug: null, registrations: 1,
  fields: { name, birthDate: '21.06.2015', contactName: 'Dan Ilie', phone: '0755 777 888', email: '', ...fields },
});
const preview: MergePreview = {
  kept: side('a1', 'Sara Ilie', { email: 'dan@example.com' }),
  removed: side('a2', 'Sara-Maria Ilie', { phone: '0755 000 000' }),
  differing: ['name', 'phone', 'email'],
};

describe('search announcements and keys', () => {
  it('announces the count with the list plurals, or the empty-state text', () => {
    expect(resultsText({ q: 'Ion', cards: [card()] })).toBe('1 rezultat');
    expect(resultsText({ q: 'Ion', cards: [card(), card({ documentId: 'a2' })] })).toBe('2 rezultate');
    expect(resultsText({ q: 'Ion', cards: Array.from({ length: 20 }, (_, i) => card({ documentId: `a${i}` })) })).toBe('20 de rezultate');
    expect(resultsText({ q: 'Ion', cards: [] })).toBe('Niciun sportiv găsit pentru "Ion".');
  });

  it('a failed search has its own text', () => {
    expect(SEARCH_FAILED).toBe('Nu am putut încărca datele.');
  });

  it('ArrowUp / ArrowDown stop at the ends, Home / End jump, other keys do not move', () => {
    expect(movedOption('ArrowDown', 0, 3)).toBe(1);
    expect(movedOption('ArrowDown', 2, 3)).toBe(2);
    expect(movedOption('ArrowUp', 0, 3)).toBe(0);
    expect(movedOption('ArrowUp', 2, 3)).toBe(1);
    expect(movedOption('Home', 2, 3)).toBe(0);
    expect(movedOption('End', 0, 3)).toBe(2);
    expect(movedOption('ArrowDown', 0, 0)).toBeNull();
    expect(movedOption('Enter', 0, 3)).toBeNull();
    expect(movedOption('toString', 0, 3)).toBeNull();
  });
});

describe('merge (spec 6.6)', () => {
  it('opens with the current record kept and its values (Needs decision 3c, option A)', () => {
    expect(mergeRequest(preview, initialMerge())).toEqual({ keptId: 'a1', removedId: 'a2', take: [] });
    expect(keptName(preview, initialMerge())).toBe('Sara Ilie');
  });

  it('a value picked from the other record is taken', () => {
    expect(mergeRequest(preview, withPick(initialMerge(), 'phone', 'b')).take).toEqual(['phone']);
    expect(mergeRequest(preview, withPick(initialMerge(), 'birthDate', 'b')).take).toEqual([]);
  });

  it('switching the kept record restarts the picks from it and swaps the ids', () => {
    const picked = withPick(initialMerge(), 'phone', 'b');
    const other = withKept('b');
    expect(other).toEqual({ kept: 'b', picks: {} });
    expect(mergeRequest(preview, other)).toEqual({ keptId: 'a2', removedId: 'a1', take: [] });
    expect(mergeRequest(preview, withPick(other, 'email', 'a')).take).toEqual(['email']);
    expect(keptName(preview, other)).toBe('Sara-Maria Ilie');
    expect(mergeRequest(preview, picked).keptId).toBe('a1');
  });

  it('rows per field, differences flagged, empty values blank', () => {
    expect(mergeRows(preview).map((r) => [r.label, r.a, r.b, r.differs])).toEqual([
      ['Nume și prenume', 'Sara Ilie', 'Sara-Maria Ilie', true],
      ['Data nașterii', '21.06.2015', '21.06.2015', false],
      ['Persoana de contact', 'Dan Ilie', 'Dan Ilie', false],
      ['Telefon', '0755 777 888', '0755 000 000', true],
      ['E-mail', 'dan@example.com', '', true],
    ]);
  });

  it('confirmation copy (spec Open 3)', () => {
    expect(MERGE_COPY.confirmTitle).toBe('Unești cele două fișe?');
    expect(MERGE_COPY.confirmMessage('Sara Ilie')).toBe('Rămâne fișa „Sara Ilie”. Cealaltă se șterge. Acțiunea nu poate fi anulată.');
    expect([MERGE_COPY.confirmLabel, MERGE_COPY.title, MERGE_COPY.kept]).toEqual(['Unește', 'Unește cu alt sportiv', 'Rămâne']);
  });
});
