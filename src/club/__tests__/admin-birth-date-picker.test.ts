import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// The admin bundle has no test runner; this reads its source.
const picker = readFileSync(join(__dirname, '..', '..', 'admin', 'ui', 'BirthDatePicker.tsx'), 'utf8');

it('renders one DateInput and no Select', () => {
  expect(picker.match(/<DateInput\b/g)).toHaveLength(1);
  expect(picker).not.toMatch(/<Select\b|from '\.\/Select'/);
});

it('maps parts to and from the ISO value and limits the range', () => {
  expect(picker).toContain('value={text || null}');
  expect(picker).toContain('pickedDate(iso, range)');
  expect(picker).toContain('birthDateRange(');
  expect(picker).toContain('min={range.min}');
  expect(picker).toContain('max={range.max}');
});

it('needs no group workaround: the Field hands its id to the one input', () => {
  expect(picker).not.toMatch(/role="group"|aria-labelledby|NoFieldContext|useFieldLabelId/);
});

it('does not call onChange while the input holds a half-typed date (badInput)', () => {
  expect(picker).toContain('if (iso === null && input.current?.validity.badInput) return;');
  expect(picker.indexOf('validity.badInput')).toBeLessThan(picker.indexOf('onChange(next)'));
});
