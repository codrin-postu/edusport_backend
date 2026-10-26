import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const toast = readFileSync(join(__dirname, '..', '..', 'admin', 'ui', 'Toast.tsx'), 'utf8');

it('ToastOptions carries an action with a label and a handler', () => {
  expect(toast).toContain('export interface ToastAction {');
  expect(toast).toContain('action?: ToastAction;');
  expect(toast).toContain('action: opts?.action');
});

it('the action runs once and closes the toast', () => {
  expect(toast).toContain('action.onClick();');
  expect(toast).toContain('disabled={leaving}');
});

it('a toast with an action waits while the pointer or the focus is on it', () => {
  expect(toast).toContain('const pausable = urgent || item.action !== undefined;');
  expect(toast).toContain('onFocus={item.action ? pause : undefined}');
  expect(toast).toContain('onBlur={item.action ? arm : undefined}');
});
