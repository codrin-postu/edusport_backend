import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { radius } from '../../admin/ui/tokens';

// The admin bundle has no test runner; these read its source.
const source = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');

it('Radio is a native radio inside a radiogroup, so arrow keys move and choose', () => {
  const radio = source('admin/ui/Radio.tsx');
  expect(radio).toContain('role="radiogroup"');
  expect(radio).toContain('type="radio"');
});

it('the mark uses the radio radius token, with the decided shape (square, same as Checkbox)', () => {
  expect(source('admin/ui/styles.ts')).toContain('border-radius:var(--ui-radius-radio)');
  expect(radius.radio).toBe('4px');
});

it('the checked mark is a filled square inside the box, never a round dot (no circles except the spinner)', () => {
  const css = source('admin/ui/styles.ts');
  const mark = css.match(/\.ui-radio input::before\{([^}]*)\}/);
  expect(mark?.[1]).toContain('width:8px;height:8px;border-radius:var(--ui-radius-none);background:var(--theme-primary)');
  expect(mark?.[1]).not.toContain('50%');
  expect(radius.none).toBe('0');
  expect(css).toContain('.ui-radio input:checked::before{opacity:1}');
});

it('choice cards sit side by side and stack on phones', () => {
  const css = source('admin/ui/styles.ts');
  expect(css).toContain('.ui-radios--card{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))');
  expect(css).toContain('@media (max-width:640px){${R} .ui-radios--card{grid-template-columns:minmax(0,1fr)}}');
});
