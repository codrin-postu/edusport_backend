import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const admin = join(__dirname, '..', '..', 'admin');
const hook = readFileSync(join(admin, 'ui', 'useMenuFocus.ts'), 'utf8');
const index = readFileSync(join(admin, 'ui', 'index.ts'), 'utf8');
const table = readFileSync(join(admin, 'dashboard', 'SubmissionTable.tsx'), 'utf8');

it('MenuButton keeps its API, adds an optional chevron and wires the menu focus into its Popover', () => {
  expect(index).toContain("export { useMenuFocus, type MenuFocus } from './useMenuFocus';");
  expect(table).toContain('chevron?: boolean;');
  expect(table).toContain('chevron = true,');
  expect(table).toContain('{chevron && <IconChevronDown size={12} />}');
  expect(table).toContain('const menu = useMenuFocus(open, ref, onClose);');
  expect(table).toMatch(/onClose=\{menu\.close\}[\s\S]*?popoverRef=\{menu\.popoverRef\}\s+popoverProps=\{menu\.popoverProps\}/);
});

it('the first enabled menu item takes focus once the popover is placed', () => {
  expect(hook).toContain(`const ITEMS = '[role="menuitem"]:not(:disabled)';`);
  expect(hook).toContain('requestAnimationFrame(() => itemsOf(popoverRef.current)[0]?.focus({ preventScroll: true }))');
  expect(hook).toContain('return () => cancelAnimationFrame(frame);');
});

it('arrow keys, Home and End move between items (menuKeyTarget)', () => {
  expect(hook).toContain('const next = menuKeyTarget(e.key, items.indexOf(document.activeElement as HTMLElement), items.length);');
  expect(hook).toContain('e.preventDefault();');
  expect(hook).toContain('items[next].focus();');
});

it('a picked item and Escape give focus back to the trigger, the item before its action runs', () => {
  expect(hook).toContain('if (e.target instanceof Element && e.target.closest(ITEMS)) triggerRef.current?.focus();');
  expect(hook).toContain('popoverProps: { onKeyDown, onClickCapture }');
  expect(hook).toMatch(/const inside = popoverRef\.current\?\.contains\(document\.activeElement\) \?\? false;\s+onClose\(\);\s+if \(inside\) triggerRef\.current\?\.focus\(\);/);
});
