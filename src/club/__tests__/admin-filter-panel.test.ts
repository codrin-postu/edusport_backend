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
