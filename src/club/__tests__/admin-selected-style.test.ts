import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const css = readFileSync(join(__dirname, '..', '..', 'admin', 'ui', 'styles.ts'), 'utf8');

it('the old selected inbox item (tint + inset left bar) is gone', () => {
  expect(css).not.toContain('box-shadow:inset 3px 0 0 var(--theme-primary)}');
});

it('a selected inbox item uses style E: solid primary, 6px corners, 4px inset, white text', () => {
  const fill = /\.ui-inbox-item\[aria-current="true"\]::before\{[^}]*\}/.exec(css)?.[0] ?? '';
  expect(fill).toContain('inset:4px');
  expect(fill).toContain('background:var(--theme-primary)');
  expect(fill).toContain('border-radius:var(--ui-radius-md)');
  expect(css).toContain('.ui-inbox-item[aria-current="true"]{background:none;color:var(--theme-on-primary)}');
});
