import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const source = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');

it('EditorCard headers have no band on the left, everywhere', () => {
  const rule = /\.ui-ecard-h\{[^}]*\}/.exec(source('admin/ui/styles.ts'))?.[0] ?? '';
  expect(rule).not.toBe('');
  expect(rule).not.toContain('box-shadow');
});

it('a DrawerSection can go without a title (a drawer with one block of fields)', () => {
  const drawer = source('admin/ui/Drawer.tsx');
  expect(drawer).toContain('title?: React.ReactNode;');
  expect(drawer).toContain('{title !== undefined && (');
});
