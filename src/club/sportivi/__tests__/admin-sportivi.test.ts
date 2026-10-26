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
    expect(hook).toContain('req.append ? [...prev, ...p.data] : p.data');
    expect(hook).toContain('loaded.current = req.loaded;');
  });

  it('"date lipsă" and the card badge carry the triangle warning icon; the missing list reaches screen readers', () => {
    expect(read('../ui/icons.tsx')).toMatch(/export const IconWarning[\s\S]*M7 1\.6L12\.6 12\.2H1\.4z/);
    const table = read('sportivi/AthleteTable.tsx');
    expect(table).toContain('<IconWarning size={12} />');
    expect(table).toContain('{tip && <span className="ui-sr">{tip}</span>}');
    expect(read('sportivi/AthleteCards.tsx')).toContain('<IconWarning size={11} />');
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
    expect(read('sportivi/SportiviList.tsx')).toContain('navigate(athleteRecordTo(documentId), { state: { season:');
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
