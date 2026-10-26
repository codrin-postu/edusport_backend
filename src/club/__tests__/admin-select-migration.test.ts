import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const SRC = join(__dirname, '..', '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'node_modules' ? [] : sources(p);
    return /\.tsx?$/.test(name) ? [p] : [];
  });
}

it('no native <select> is left in the admin: every page uses the custom Select', () => {
  const files = [...sources(join(SRC, 'admin')), ...sources(join(SRC, 'plugins'))];
  const hits = files.filter((f) => /<select[\s>]|select\.ui-input/.test(readFileSync(f, 'utf8'))).map((f) => relative(SRC, f));
  expect(hits).toEqual([]);
});

it('the Select is a combobox button with the shared list', () => {
  const select = readFileSync(join(SRC, 'admin', 'ui', 'Select.tsx'), 'utf8');
  expect(select).toContain('role="combobox"');
  expect(select).toContain('role="listbox"');
});
