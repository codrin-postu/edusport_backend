import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const source = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');
const panel = source('admin/ui/FilterPanel.tsx');

it('the trigger opens a 540px dropdown dialog and says whether it is open', () => {
  expect(panel).toContain('aria-haspopup="dialog"');
  expect(panel).toContain('aria-expanded={open}');
  expect(panel).toContain('DROPDOWN_WIDTH = 540');
});

it('options are a group named by the section: radios with a clearing row, checkboxes in role group', () => {
  expect(panel).toContain('<RadioGroup');
  expect(panel).toContain('singleRows(section, shown)');
  expect(panel).toContain('role="group" aria-labelledby={labelId}');
});

it('the total is announced on desktop and on phones', () => {
  expect(panel.match(/role="status" aria-live="polite"/g)).toHaveLength(2);
});

it('phone drill-in moves focus to the section title and back to the row just left', () => {
  expect(panel).toContain('titleRef.current?.focus()');
  expect(panel).toContain('rows.current.get(left.current)?.focus()');
});

it('the phone row cuts a long value with an ellipsis', () => {
  expect(source('admin/ui/styles.ts')).toMatch(/\.ui-fm-row small\{[^}]*text-overflow:ellipsis/);
});

it('the open section is a light outlined block with a primary bar and title (filters-v3), not a solid fill', () => {
  const css = source('admin/ui/styles.ts');
  expect(css).toContain('.ui-fnav-item[aria-current="true"]{background:var(--theme-surface);box-shadow:0 0 0 1px var(--theme-border),inset 3px 0 0 var(--theme-primary)}');
  expect(css).toContain('.ui-fnav-item[aria-current="true"] b{color:var(--theme-primary)}');
  expect(css).not.toContain('.ui-fnav-item[aria-current="true"]{background:var(--theme-primary)');
});

it('a section without an "all" row (the sort) never shows its value as chosen', () => {
  expect(panel).toContain('const isSet = (s: FilterSection): boolean => s.selected.length > 0 && s.allLabel !== null;');
  expect(panel.match(/data-set=\{isSet\(s\) \|\| undefined\}/g)).toHaveLength(2);
});
