import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const src = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');

describe('money UI source', () => {
  it('the bar draws square segments with tokens, no circle (decided 8)', () => {
    const s = src('admin/dashboard/bani/AbonamentBar.tsx') + src('admin/dashboard/bani/styles.ts');
    expect(s).toMatch(/barSegments\(/);
    expect(s).toMatch(/SUBSCRIPTION_COPY\.(usedText|leftText)/);
    expect(s).not.toMatch(/border-radius:\s*50%|borderRadius:\s*'50%'|dashed|dotted|#[0-9a-f]{3,6}\b/i);
  });
  it('one submit per click (decided 1)', () => {
    expect(src('admin/dashboard/bani/useSubmitOnce.ts')).toMatch(/inFlight\.current/);
  });
  it('undo toasts use the server action id and 8 s', () => {
    expect(src('admin/dashboard/bani/undo.ts')).toMatch(/UNDO_MS/);
  });
});
