import { describe, expect, it } from 'vitest';
import type { AthleteCard, ConfirmContext, RegistrationMatchView } from '../athletes/api-types';
import {
  acsLines,
  confirmBody,
  confirmFailure,
  confirmGate,
  contextAthleteId,
  errorStatus,
  groupChoices,
  highlightParts,
  initialWindow,
  intentParts,
  mainNowLine,
  newAthleteHint,
  seasonHeading,
  seasonNote,
  windowReducer,
  type WindowAction,
  type WindowState,
} from '../inscrieri-confirm';

const card = (over: Partial<AthleteCard> = {}): AthleteCard => ({
  documentId: 'a1', name: 'Maria Dumitrescu', birthDate: '14.03.2014', lastGroup: { name: 'Primii Pași', season: '2025-2026' },
  lastRegistrationSeason: '2025-2026', contactName: 'Mihaela Dumitrescu', status: 'activ', ...over,
});
const view = (over: Partial<RegistrationMatchView> = {}): RegistrationMatchView => ({
  confirmed: false, athleteId: null, canConfirm: true, canUndo: false, birthDateReadable: true, notAttendedLastSeason: false,
  existing: card(), preselect: 'existing', comparison: [], candidates: [], ...over,
});
const ctx = (over: Partial<ConfirmContext> = {}): ConfirmContext => ({
  registrationNumber: '2026-0142',
  newAthlete: { name: 'Maria Dumitrescu', birthDate: '14.03.2014' },
  season: { label: '2026-2027', running: true, endedText: null },
  groups: [
    { sectionId: 'afi', sectionName: 'Școala de Patinaj - AFI Cotroceni', groups: [{ documentId: 'g-pp', name: 'Primii Pași' }, { documentId: 'g-in', name: 'Începători' }] },
    { sectionId: 'club', sectionName: 'Club', groups: [{ documentId: 'g-pro', name: 'Profesioniști' }] },
  ],
  mainGroupNow: null,
  acs: { seasonLabel: '2026-2027', current: null, next: 'in_asteptare', wish: 'da' },
  subscriptionIntent: 'Abonament 8 ședințe grup',
  comparison: [],
  defaultUpdateFields: ['phone'],
  blocked: null,
  ...over,
});
const run = (s: WindowState, ...actions: WindowAction[]) => actions.reduce(windowReducer, s);

describe('start (spec 4.1)', () => {
  it('Sigur: "Sportiv existent" preselected', () => {
    expect(initialWindow(view())).toMatchObject({ mode: 'choose', choice: 'existing', ticks: null, groupId: null, makeMain: false });
  });

  it('Probabil: nothing chosen, the button disabled with the hint (r3 c1)', () => {
    const s = initialWindow(view({ preselect: null }));
    expect(s.choice).toBeNull();
    expect(confirmGate(s, ctx(), false)).toEqual({ disabled: true, hint: 'Alege "Sportiv existent" sau "Sportiv nou"', notice: null });
  });

  it('no match: "Sportiv nou"', () => {
    const s = initialWindow(view({ existing: null, preselect: null }));
    expect([s.athlete, s.choice, contextAthleteId(s)]).toEqual([null, 'new', null]);
  });
});

describe('choices, search and ticks (spec 4.1, 4.2)', () => {
  it('the context follows the chosen athlete; "Sportiv nou" asks for none', () => {
    const s = initialWindow(view());
    expect(contextAthleteId(s)).toBe('a1');
    expect(contextAthleteId(run(s, { type: 'choose', choice: 'new' }))).toBeNull();
  });

  it('ticks start from the defaults, then follow the admin', () => {
    const s = run(initialWindow(view()), { type: 'tick', field: 'name', on: true, defaults: ['phone'] });
    expect(s.ticks).toEqual(['phone', 'name']);
    expect(run(s, { type: 'tick', field: 'phone', on: false, defaults: ['phone'] }).ticks).toEqual(['name']);
  });

  it('a pick from the search becomes the existing athlete with its own defaults', () => {
    const ticked = run(initialWindow(view({ preselect: null })), { type: 'tick', field: 'email', on: true, defaults: [] }, { type: 'toggleCompare' }, { type: 'openSearch' }, { type: 'query', text: 'Dumit' });
    expect([ticked.mode, ticked.query]).toEqual(['search', 'Dumit']);
    const picked = run(ticked, { type: 'pick', card: card({ documentId: 'a2', name: 'Andrei Dumitrescu' }) });
    expect(picked).toMatchObject({ mode: 'choose', choice: 'existing', ticks: null, compareOpen: false });
    expect(picked.athlete?.documentId).toBe('a2');
  });

  it('"Sportiv nou" from the search, and "Anulează" back to the cards', () => {
    const s = run(initialWindow(view()), { type: 'openSearch' }, { type: 'pickNew' });
    expect([s.mode, s.choice, s.athlete?.documentId]).toEqual(['choose', 'new', 'a1']);
    expect(run(initialWindow(view()), { type: 'openSearch' }, { type: 'closeSearch' }).mode).toBe('choose');
  });

  it('clearing the group clears the main group tick', () => {
    const s = run(initialWindow(view()), { type: 'group', groupId: 'g-pp' }, { type: 'main', on: true }, { type: 'group', groupId: null });
    expect([s.groupId, s.makeMain]).toEqual([null, false]);
  });

  it('switching to "Sportiv nou" clears the main group tick', () => {
    const s = run(initialWindow(view()), { type: 'group', groupId: 'g-pp' }, { type: 'main', on: true }, { type: 'choose', choice: 'new' });
    expect([s.groupId, s.makeMain]).toEqual(['g-pp', false]);
  });
});

describe('request body (spec 4.3, 4.5)', () => {
  it('existing athlete: the default ticks when the table was never opened', () => {
    const s = run(initialWindow(view()), { type: 'group', groupId: 'g-pp' });
    expect(confirmBody(s, ctx())).toEqual({ choice: 'existing', athleteId: 'a1', groupId: 'g-pp', makeMain: false, updateFields: ['phone'] });
  });

  it('the main group tick counts only with a current main group and a picked group', () => {
    const s = run(initialWindow(view()), { type: 'group', groupId: 'g-pp' }, { type: 'main', on: true });
    expect(confirmBody(s, ctx())?.makeMain).toBe(false);
    expect(confirmBody(s, ctx({ mainGroupNow: { name: 'Profesioniști', sectionName: 'Club' } }))?.makeMain).toBe(true);
  });

  it('new athlete: no athlete id, no field updates', () => {
    const s = run(initialWindow(view()), { type: 'choose', choice: 'new' }, { type: 'tick', field: 'email', on: true, defaults: [] });
    expect(confirmBody(s, ctx())).toEqual({ choice: 'new', athleteId: null, groupId: null, makeMain: false, updateFields: [] });
  });

  it('season ended: the group is never sent (r3b c9)', () => {
    const s = run(initialWindow(view()), { type: 'group', groupId: 'g-pp' });
    expect(confirmBody(s, ctx({ season: { label: '2025-2026', running: false, endedText: 'x' } }))?.groupId).toBeNull();
  });

  it('nothing chosen: no body', () => {
    expect(confirmBody(initialWindow(view({ preselect: null })), ctx())).toBeNull();
  });
});

describe('gate and blocked states (spec 4.7)', () => {
  it('blocked windows show the spec texts', () => {
    const s = initialWindow(view());
    expect(confirmGate(s, ctx({ blocked: 'birth-date' }), false)).toEqual({ disabled: true, hint: null, notice: 'Data nașterii nu poate fi citită. Corectați-o în Date.' });
    expect(confirmGate(s, ctx({ blocked: 'confirmed' }), false).notice).toBe('Înscrierea a fost deja confirmată de alt administrator.');
    expect(confirmGate(s, ctx({ blocked: 'not-confirmable' }), false).notice).toBe('Datele s-au schimbat. Reîncarcă pagina.');
  });

  it('disabled while loading or without a context; the search keeps the chosen athlete (proto v5)', () => {
    const s = initialWindow(view());
    expect(confirmGate(s, ctx(), false).disabled).toBe(false);
    expect(confirmGate(s, ctx(), true).disabled).toBe(true);
    expect(confirmGate(s, null, false).disabled).toBe(true);
    expect(confirmGate(run(s, { type: 'openSearch' }), ctx(), false).disabled).toBe(false);
    expect(confirmGate(run(initialWindow(view({ preselect: null })), { type: 'openSearch' }), ctx(), false).disabled).toBe(true);
  });
});

describe('season, groups, A.C.S. and intent lines (spec 4.3, 4.4)', () => {
  it('season note: none while running, the ended line, the no-season line', () => {
    expect(seasonNote(ctx())).toBeNull();
    const ended = 'Sezonul 2025-2026 s-a încheiat. Se leagă doar fișa sportivului.';
    expect(seasonNote(ctx({ season: { label: '2025-2026', running: false, endedText: ended } }))).toBe(ended);
    expect(seasonNote(ctx({ season: { label: null, running: false, endedText: null } }))).toBe('Se leagă doar fișa sportivului.');
  });

  it('season heading with the school, without it, and none without a season', () => {
    expect(seasonHeading(ctx(), 'Școala de Patinaj - AFI Cotroceni')).toBe('Școala de Patinaj - AFI Cotroceni, sezonul 2026-2027');
    expect(seasonHeading(ctx(), null)).toBe('Sezonul 2026-2027');
    expect(seasonHeading(ctx({ season: { label: null, running: false, endedText: null } }), 'X')).toBeNull();
  });

  it('groups: "Fără grupă deocamdată" first, then the school, then Club, each option under its section', () => {
    expect(groupChoices(ctx().groups)).toEqual([
      { value: '', label: 'Fără grupă deocamdată' },
      { value: 'g-pp', label: 'Primii Pași', group: 'Școala de Patinaj - AFI Cotroceni' },
      { value: 'g-in', label: 'Începători', group: 'Școala de Patinaj - AFI Cotroceni' },
      { value: 'g-pro', label: 'Profesioniști', group: 'Club' },
    ]);
  });

  it('A.C.S.: the status change and the wish, apart; nothing when the season ended', () => {
    expect(acsLines(ctx())).toEqual({ status: 'Membru A.C.S. 2026-2027: Nu → În așteptare', wish: 'Dorește să fie membru (formular): Da' });
    expect(acsLines(ctx({ acs: { seasonLabel: '2026-2027', current: 'da', next: null, wish: 'nu' } }))).toEqual({
      status: 'Membru A.C.S. 2026-2027: Da', wish: 'Dorește să fie membru (formular): Nu',
    });
    expect(acsLines(ctx({ acs: { seasonLabel: '2026-2027', current: null, next: null, wish: null } }))?.wish).toBe('Dorește să fie membru (formular):');
    expect(acsLines(ctx({ season: { label: '2025-2026', running: false, endedText: 'x' } }))).toBeNull();
  });

  it('main group now, intent, new athlete hint', () => {
    expect(mainNowLine(ctx())).toBeNull();
    expect(mainNowLine(ctx({ mainGroupNow: { name: 'Profesioniști', sectionName: 'Club' } }))).toBe('Grupă principală acum: Profesioniști (Club)');
    expect(intentParts(ctx())).toEqual({ item: 'Abonament 8 ședințe grup', note: ', doar intenția părintelui; abonamentul se adaugă când e cumpărat' });
    expect(intentParts(ctx({ subscriptionIntent: null }))).toBeNull();
    expect(newAthleteHint(ctx(), true)).toBe('Se creează o fișă nouă: Maria Dumitrescu, 14.03.2014');
    expect(newAthleteHint(ctx(), false)).toBe('Se creează o fișă nouă: Maria Dumitrescu');
  });
});

describe('search rows mark the typed text (proto v5)', () => {
  it('ignores case and diacritics and keeps the name as written', () => {
    expect(highlightParts('Maria Dumitrescu', 'dumit')).toEqual({ before: 'Maria ', match: 'Dumit', after: 'rescu' });
    expect(highlightParts('Ștefan Tănase', 'stefan t')).toEqual({ before: '', match: 'Ștefan T', after: 'ănase' });
    expect(highlightParts('Ana Ilie', ' ilie ')).toEqual({ before: 'Ana ', match: 'Ilie', after: '' });
  });

  it('nothing to mark without text or without a match', () => {
    expect(highlightParts('Maria Dumitrescu', '  ')).toBeNull();
    expect(highlightParts('Maria Dumitrescu', '0722')).toBeNull();
  });
});

describe('failures (spec 4.7)', () => {
  const fetchError = (status: number, message?: string) => ({ status, response: { data: { error: { status, message } } } });

  it('reads the status from the admin fetch error', () => {
    expect([errorStatus(fetchError(409)), errorStatus({ response: { status: 500 } }), errorStatus(new Error('x')), errorStatus(null)]).toEqual([409, 500, null, null]);
  });

  it('another admin confirmed it: the server text, close and refresh', () => {
    expect(confirmFailure(fetchError(409, 'Înscrierea a fost deja confirmată de alt administrator.'))).toEqual({
      text: 'Înscrierea a fost deja confirmată de alt administrator.', close: true,
    });
    expect(confirmFailure(fetchError(409)).text).toBe('Înscrierea a fost deja confirmată de alt administrator.');
  });

  it('anything else: "nothing was saved", the window stays, never the raw server text', () => {
    expect(confirmFailure(fetchError(500))).toEqual({ text: 'Confirmarea nu a reușit. Nimic nu a fost salvat.', close: false });
    expect(confirmFailure(new Error('network'))).toEqual({ text: 'Confirmarea nu a reușit. Nimic nu a fost salvat.', close: false });
    expect(confirmFailure(fetchError(500, 'Internal Server Error'))).toEqual({ text: 'Confirmarea nu a reușit. Nimic nu a fost salvat.', close: false });
  });
});
