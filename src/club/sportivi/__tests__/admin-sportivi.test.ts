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
