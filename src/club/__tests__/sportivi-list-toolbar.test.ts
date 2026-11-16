import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { showSortSelect } from '../sportivi/list-view';

const read = (p: string) => readFileSync(resolve(__dirname, '../../', p), 'utf8');

describe('showSortSelect', () => {
  it('is on only on phones, where the list is cards without column headers', () => {
    expect(showSortSelect(true)).toBe(true);
    expect(showSortSelect(false)).toBe(false);
  });
});

describe('ListToolbar', () => {
  const src = read('admin/dashboard/sportivi/ListToolbar.tsx');
  it('renders the Sortare select only when showSortSelect says so', () => {
    expect(src).toContain('showSortSelect(phone)');
    expect(src).toMatch(/showSortSelect\(phone\) && \(\s*<label className="spv-sort">/);
    expect(src).not.toContain('!phone && (\n        <label');
  });
});

describe('filter popup scroll', () => {
  const css = read('admin/ui/styles.ts');
  const rule = (sel: string) => {
    const at = css.indexOf(`${sel}{`);
    expect(at).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf('}', at));
  };
  it('scrolls the left list and the right content separately, each bounded by the token', () => {
    for (const sel of ['.ui-fnav', '.ui-fpane']) {
      const r = rule(sel);
      expect(r).toContain('overflow-y:auto');
      expect(r).toContain('max-height:var(--ui-fdesk-max)');
    }
    expect(rule('.ui-fdesk')).toContain('--ui-fdesk-max:');
  });
});
