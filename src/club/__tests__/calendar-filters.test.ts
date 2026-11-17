import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FILTER_GROUPS, toggleCategory } from '../../plugins/component-preview/admin/src/calendar/model';

const SRC = join(__dirname, '../../plugins/component-preview/admin/src');
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');

describe('toggleCategory', () => {
  it('adds a missing category and removes a present one', () => {
    const one = toggleCategory(new Set(), 'liber');
    expect([...one]).toEqual(['liber']);
    expect(toggleCategory(one, 'liber').size).toBe(0);
  });

  it('does not mutate its argument', () => {
    const before = new Set(['scoala'] as const);
    const after = toggleCategory(before, 'liber');
    expect(after).not.toBe(before);
    expect([...before]).toEqual(['scoala']);
  });

  it('toggling all four twice returns an empty set', () => {
    let s = new Set<(typeof FILTER_GROUPS)[number]['cat']>();
    for (const g of FILTER_GROUPS) s = toggleCategory(s, g.cat);
    expect(s.size).toBe(FILTER_GROUPS.length);
    for (const g of FILTER_GROUPS) s = toggleCategory(s, g.cat);
    expect(s.size).toBe(0);
  });
});

describe('calendar filter row source', () => {
  const view = read('calendar/CalendarView.tsx');

  it('uses the kit Checkbox, one per group, with a swatch and data-calcat', () => {
    expect(view).toMatch(/import \{[^}]*\bCheckbox\b[^}]*\} from '[^']*admin\/ui'/);
    expect(view).toContain('Arată:');
    expect(view).toContain('FILTER_GROUPS.map');
    expect(view).toContain('<Checkbox');
    expect(view).toContain('cal-sw');
    expect(view).toContain('data-calcat={g.cat}');
  });

  it('has no pressed-button chips and no Filtre popover button', () => {
    expect(view).not.toContain('aria-pressed={on}');
    expect(view).not.toContain('Filtre');
    expect(view).not.toContain('cal-filter"');
  });

  it('the editor toggles through toggleCategory', () => {
    expect(read('ProgramOverviewEditor.tsx')).toContain('toggleCategory');
  });
});

describe('calendar legend spacing', () => {
  it('keeps the legend tight so it stays on one row at 1280', () => {
    const css = read('calendar/styles.ts');
    expect(css).toContain('.cal-filters{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;padding:6px 12px;');
    expect(css).toContain('.cal-filter-l{display:inline-flex;align-items:center;gap:4px}');
  });
});
