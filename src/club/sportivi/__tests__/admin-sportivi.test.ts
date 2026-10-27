import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(join(__dirname, '..', '..', '..', 'admin', 'dashboard', p), 'utf8');

describe('API client and styles (Task 5)', () => {
  it('calls exactly the plan 3-2 routes', () => {
    const api = read('sportivi/api.ts');
    for (const path of [
      "'/api/club/athletes'", '/history`', '/status`', '/profile`', '/profile/visibility`', '/merge-preview?kept=', '/merge`',
      '/api/club/athlete-duplicates/', 'searchUrl(q)',
    ]) expect(api).toContain(path);
  });

  it('the CSS keeps to tokens: no backtick inside, no dashed or dotted lines, no pills or circles', () => {
    const css = read('sportivi/styles.ts');
    const body = css.slice(css.indexOf('`') + 1, css.lastIndexOf('`'));
    expect(body).not.toContain('`');
    expect(body).not.toMatch(/dashed|dotted|50%|999px/);
    expect(body).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });

  it('the search reuses the confirm window wording and two-line rows', () => {
    const s = read('sportivi/AthleteSearch.tsx');
    expect(s).toContain('SEARCH_COPY.placeholder');
    expect(s).toContain('cardSubline(c)');
    expect(s).toContain('showNewRow(result)');
  });
});

describe('athlete search accessibility (Task 5 review)', () => {
  const s = read('sportivi/AthleteSearch.tsx');

  it('follows the SearchableSelect combobox pattern', () => {
    for (const attr of ['role="combobox"', 'aria-expanded={open}', 'aria-controls=', 'aria-activedescendant=', 'role="listbox"', 'role="option"']) {
      expect(s).toContain(attr);
    }
    expect(s).toContain('movedOption(e.key, active, options.length)');
    expect(s).toMatch(/e\.key === 'Enter'[\s\S]*\.pick\(\)/);
    expect(s).toMatch(/e\.key === 'Escape'[\s\S]*clear\(\)/);
  });

  it('Enter picks only from the answer to the text in the box, never from the previous one', () => {
    expect(s).toContain("e.key === 'Enter' && options[active] && result?.q === e.currentTarget.value.trim()");
  });

  it('"Sportiv nou" is the last option', () => {
    expect(s).toContain("[...rows, { key: '', name: SEARCH_COPY.newAthlete");
  });

  it('a hidden live region announces the count, and a failed search shows its own text', () => {
    expect(s).toContain('<span className="ui-sr" role="status" aria-live="polite">{statusText(search)}</span>');
    expect(s).toContain('failed ? SEARCH_FAILED : result ? resultsText(result)');
    expect(s).toContain("{failed && <p className=\"ui-error\">{SEARCH_FAILED}</p>}");
    expect(s).toContain('.catch(() => { if (!off) setSearch({ result: null, failed: true }); })');
  });
});

describe('list screens (Task 6)', () => {
  it('pages come from listRequest: phone appends only the next page, a remembered page reloads 1..N', () => {
    const hook = read('sportivi/useAthleteList.ts');
    expect(hook).toContain('listRequest(wanted, phone, loaded.current)');
    expect(hook).toContain('if (req.loaded.page !== wanted.page) {');
    expect(hook).toContain('const restart = React.useCallback(() => setState(withPage(remembered, 1)), [setState]);');
    expect(hook).toContain('req.append ? [...prev, ...p.data] : p.data');
    expect(hook).toContain('loaded.current = req.loaded;');
  });

  it('the triangle warning marker: "date lipsă" on rows, "Date incomplete" on phone cards (polish 5); the missing list reaches screen readers', () => {
    expect(read('../ui/icons.tsx')).toMatch(/export const IconWarning[\s\S]*M7 1\.6L12\.6 12\.2H1\.4z/);
    const marker = read('sportivi/MissingMarker.tsx');
    expect(marker).toContain('<IconWarning size={12} />');
    expect(marker).toContain('{card ? LIST_COPY.cardIncompleteMarker : LIST_COPY.incompleteMarker}');
    expect(marker).toContain('{tip && <span className="ui-sr">{tip}</span>}');
    expect(read('sportivi/AthleteTable.tsx')).toContain('<MissingMarker row={row} />');
    expect(read('sportivi/AthleteCards.tsx')).toContain('<MissingMarker row={r} card />');
  });

  it('toolbar on one row with the search magnifier; chips of the chosen filters with the match count (filters-v3)', () => {
    const bar = read('sportivi/ListToolbar.tsx');
    expect(bar).toContain('<IconSearch />');
    expect(bar).toContain('withoutChip(state, chip)');
    expect(bar).toContain('matchingText(page.pagination.total)');
    expect(bar).toContain('incompleteShown(list.state)');
    expect(read('sportivi/SportiviList.tsx')).toContain('<ActiveFilters list={list} phone={phone} />');
  });

  it('header and toolbar as spec 5: no Export, no Coloane, sort in the sheet on phones', () => {
    const list = read('sportivi/SportiviList.tsx');
    const bar = read('sportivi/ListToolbar.tsx');
    expect(list).toContain('LIST_COPY.subtitle');
    expect(bar).toContain('<FilterPanel');
    expect(bar).toContain('phone ? [...filters, sortSection(state)] : filters');
    expect(`${list}${bar}`).not.toMatch(/Export|Coloane/);
  });

  it('rows open the record with the selected season; phone cards load 30 more', () => {
    const list = read('sportivi/SportiviList.tsx');
    expect(list).toContain('const season = seasonValue(list.state, list.page) || null;');
    expect(list).toContain('navigate(athleteRecordTo(documentId), { state: { season } })');
    expect(read('sportivi/AthleteCards.tsx')).toContain('LIST_COPY.more');
    expect(read('sportivi/AthleteTable.tsx')).toContain('withHeaderSort(state, sortKey)');
  });
});

describe('merge window (Task 9)', () => {
  const merge = read('sportivi/MergeDialog.tsx');

  it('search first when no other record is given, then the comparison', () => {
    expect(merge).toContain('<AthleteSearch api={api} exclude={record.documentId}');
    expect(merge).toContain('api.mergePreview(keptId, otherId)');
  });

  it('keeping the other record opens it in the season the record was showing', () => {
    expect(read('sportivi/AthleteRecordPage.tsx')).toContain(
      'navigate(athleteRecordTo(keptId), { replace: true, state: { season: seasonFromState(state) } })',
    );
  });

  it('kept record and per-field choice, confirmation naming the kept record', () => {
    expect(merge).toContain('label={MERGE_COPY.kept}');
    expect(merge).toContain('withPick(state, row.field, side)');
    expect(merge).toContain('MERGE_COPY.confirmMessage(keptName(preview, state))');
    expect(merge).toContain('mergeRequest(preview, state)');
  });

  it('modal on desktop, full-height sheet on phones', () => {
    expect(merge).toContain('desktop="modal" modalSize="lg" fullHeight');
  });

  it('focus lands on the search box or the first field radio, field radios name their field (Task 9 review)', () => {
    expect(merge).toContain('initialFocusRef={searchRef}');
    expect(merge).toContain('inputRef={searchRef}');
    expect(merge).toContain("querySelector<HTMLElement>('tbody input[type=radio]')");
    expect(merge).toContain('<span className="ui-sr">{`${row.label}: `}</span>{row[side]}');
    expect(read('sportivi/AthleteSearch.tsx')).toContain('ref={inputRef} type="search"');
  });
});

describe('athlete record (Task 7)', () => {
  it('one route: the splat after /plugins/edusport-sportivi/ is the record id', () => {
    const page = read('SportiviPage.tsx');
    expect(page).toContain("recordIdFromSplat(useParams()['*'])");
    expect(page).toContain('<AthleteRecordPage key={id} documentId={id} />');
    expect(page).not.toContain('content-manager');
  });

  it('desktop page with back link; phone full-height sheet with a footer for the tab buttons', () => {
    const rec = read('sportivi/AthleteRecordPage.tsx');
    expect(rec).toContain('back={{ to: SPORTIVI_PATH, label: RECORD_COPY.back }}');
    expect(rec).toContain('fullHeight');
    expect(rec).toContain('<RecordFooterContext.Provider value={setFooter}>');
    expect(rec).toContain("hidden={tab !== 'date'}");
    expect(rec).toContain("active={tab === 'date'}");
    expect(rec).toContain('onSaved={loaded.reload}');
    expect(rec).toContain('aria-label={tabs.find((t) => t.id === tab)?.label}');
    expect(rec).toContain("{record.status === 'inactiv' && <StatusBadge tone=\"neutral\">{STATUS_WORDS.inactiv}</StatusBadge>}");
  });

  it('Date tab: Editează, picker, draft check, footer only while visible', () => {
    const date = read('sportivi/DateTab.tsx');
    for (const s of [
      'RECORD_COPY.edit', '<BirthDatePicker', 'checkDraft(draft, false)', 'useRecordFooter(props.active ? buttons : null)', 'registrationPanelTo(',
      'await onSaved();', "focusId(editing ? fieldId('name') : EDIT_ID)", 'focusId(fieldId(check.field))', "required id={fieldId('name')}",
    ]) {
      expect(date).toContain(s);
    }
  });

  it('Documente through the admin-guarded routes; Istoric with the shared time format', () => {
    expect(read('sportivi/DocumentsTab.tsx')).toContain('registrationDocumentUrl(d.registrationDocumentId, d.kind)');
    expect(read('sportivi/DocumentsTab.tsx')).toContain('<span className="ui-sr"> {d.label}</span>');
    expect(read('sportivi/DocumentsTab.tsx')).toContain("import { downloadPdf, registrationDocumentUrl, viewPdf } from '../inscrieri/downloadPdf';");
    expect(read('inscrieri/downloadPdf.ts')).toContain("if (!tab) throw new Error('popup blocked');");
    expect(read('inscrieri/downloadPdf.ts')).not.toContain('window.location');
    expect(read('sportivi/HistoryTab.tsx')).toContain('historyWhen(l.at)');
  });
});

describe('desktop layout (user, 2026-10-27)', () => {
  it('the list page fits the window; the table scrolls under sticky headers, the footer stays', () => {
    const list = read('sportivi/SportiviList.tsx');
    expect(list).toContain('<AdminPage fit>');
    expect(list).toContain('{phone ? <AthleteCards list={list} onOpen={open} /> : <AthleteTable list={list} onOpen={open} />}');
    const table = read('sportivi/AthleteTable.tsx');
    expect(table).toContain('<div className="ui-table-wrap">');
    expect(table).toContain('<div className="spv-foot">');
    expect(read('sportivi/AthleteRecordPage.tsx')).not.toMatch(/<AdminPage fit/);
  });
});

describe('Adaugă sportiv (Task 11)', () => {
  it('search first, "Sportiv nou" form, birth date required', () => {
    const add = read('sportivi/AddAthleteDialog.tsx');
    expect(add).toContain('onNew={(text) => setForm(newAthleteDraft(text))}');
    expect(add).toContain('checkDraft(form, true)');
    expect(add).toContain('hint={ADD_COPY.optional}');
    expect(add).toContain('desktop="modal" modalSize="md" fullHeight');
    expect(add).toContain('initialFocusRef={form ? undefined : searchRef}');
    expect(add).toContain('inputRef={searchRef}');
  });

  it('opened from the list header and from the dashboard', () => {
    expect(read('sportivi/SportiviList.tsx')).toContain('wantsAddAthlete(search)');
    const dash = read('DashboardPage.tsx');
    expect(dash).toContain("{ label: 'Adaugă sportiv', to: addAthleteTo, ic: 'S' },");
    expect(dash).not.toContain('SPORTIV_EDIT_TO');
  });

  it('a found athlete opens in the season chosen in the list', () => {
    expect(read('sportivi/SportiviList.tsx')).toContain('<AddAthleteDialog api={api} season={season} onClose={closeAdd} />');
    expect(read('sportivi/AddAthleteDialog.tsx')).toContain('onPick={(c) => navigate(athleteRecordTo(c.documentId), { state: { season } })}');
  });
});

describe('Profil public (Task 8)', () => {
  const editor = read('sportivi/ProfileEditor.tsx');

  it('name read-only from the athlete, slug read-only, nothing of them saved', () => {
    expect(editor).toContain('<Input value={athleteName} readOnly disabled />');
    expect(editor).toContain('hint={RECORD_COPY.profile.nameHint}');
    expect(editor).toContain('<Input value={v.slug} readOnly disabled />');
    const body = editor.slice(editor.indexOf('function buildBody'), editor.indexOf('// ---- skate-results'));
    expect(body).toContain('skateResultsSlug');
    expect(body).not.toMatch(/\bname:|\bslug:|showPublicPage:/);
  });

  it('the page switch goes through the athlete route; no delete and no page chrome', () => {
    expect(editor).toContain('api.setVisibility(athleteId, v.showPublicPage)');
    expect(editor).not.toMatch(/ConfirmDialog|PageHeader|SPORTIV_DELETE_COPY|export default/);
    expect(editor).toContain('{ready && active && !inFooter && <SaveBar');
  });

  it('every section of today stays', () => {
    for (const s of ['Identitate', 'Poveste', 'Echipă și discipline', 'Mișcări și hobby-uri', 'Obiectiv de carieră', 'Rezultate competiții', 'Galerie', 'Programe pe sezon', 'Fotografie', '<ActiveSinceField', 'Vizibilitate pe site']) {
      expect(editor).toContain(s);
    }
  });

  it('"Activ din" with the zi / lună / an selects, never the native date input; cancel reads "Anulează" as in Date', () => {
    const field = read('sportivi/ActiveSinceField.tsx');
    expect(field).toContain("const LABEL = 'Activ din';");
    expect(field).toContain('<BirthDatePicker value={parts} onChange={change} today={anchor()} clearable />');
    expect(field).toContain("if (iso !== null || isEmpty(next)) onChange(iso ?? '');");
    expect(editor).toContain('activeSince: form.activeSince || null,');
    expect(editor).not.toContain('DateInput');
    expect(editor).toContain('discardLabel={RECORD_COPY.cancel}');
    expect(editor).toContain("{ label: RECORD_COPY.cancel, variant: 'secondary'");
    expect(editor).not.toContain('Renunță');
  });

  it('skate-results lines joined by commas, no middle dot', () => {
    expect(editor).not.toContain('\u00b7');
  });

  it('the tab: note, "Creează profil public", stays mounted once opened', () => {
    const tab = read('sportivi/ProfileTab.tsx');
    expect(tab).toContain('RECORD_COPY.profile.note');
    expect(tab).toContain('RECORD_COPY.profile.create');
    expect(read('sportivi/AthleteRecordPage.tsx')).toContain("seen.includes('profil') && (");
  });
});

describe('menu, duplicates, merge wiring (Task 10)', () => {
  it('"..." menu with the spec dialogs', () => {
    const menu = read('sportivi/RecordMenu.tsx');
    for (const s of ['menuItems(record.status)', 'RECORD_COPY.menu.button', 'RECORD_COPY.inactiveDialog.title', 'RECORD_COPY.deleteDialog.message(', "api.setStatus(record.documentId, 'inactiv')", 'navigate(SPORTIVI_PATH, { replace: true })']) {
      expect(menu).toContain(s);
    }
  });

  it('duplicate line: Unește with the other record, Nu e același copil', () => {
    const dups = read('sportivi/DuplicateLines.tsx');
    expect(dups).toContain('onMerge(d.documentId)');
    expect(dups).toContain('api.dismissDuplicate(pairId)');
    expect(dups).toContain('RECORD_COPY.duplicate.line(d.name)');
  });

  it('the record mounts the menu, the lines and the merge window', () => {
    const rec = read('sportivi/AthleteRecordPage.tsx');
    expect(rec).toContain('<RecordMenu');
    expect(rec).toContain('<DuplicateLines');
    expect(rec).toContain('<MergeDialog');
    expect(rec).toContain('if (keptId === documentId) void loaded.reload();');
  });
});
