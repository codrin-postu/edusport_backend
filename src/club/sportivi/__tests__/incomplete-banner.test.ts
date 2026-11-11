import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INCOMPLETE_HIDDEN_KEY, INCOMPLETE_HIDDEN_MS, incompleteHidden } from '../incomplete-banner';

const source = (p: string) => readFileSync(join(__dirname, '..', '..', '..', p), 'utf8');

describe('incompleteHidden', () => {
  const now = 1_800_000_000_000;
  it('is hidden within 24 hours of the close', () => {
    expect(incompleteHidden(String(now - 1000), now)).toBe(true);
    expect(incompleteHidden(String(now - INCOMPLETE_HIDDEN_MS + 1), now)).toBe(true);
  });
  it('is shown again after 24 hours', () => {
    expect(incompleteHidden(String(now - INCOMPLETE_HIDDEN_MS), now)).toBe(false);
  });
  it('reads a missing, garbage or future value as not hidden', () => {
    expect(incompleteHidden(null, now)).toBe(false);
    expect(incompleteHidden(undefined, now)).toBe(false);
    expect(incompleteHidden('', now)).toBe(false);
    expect(incompleteHidden('abc', now)).toBe(false);
    expect(incompleteHidden(String(now + 5000), now)).toBe(false);
  });
  it('uses the agreed key', () => {
    expect(INCOMPLETE_HIDDEN_KEY).toBe('edusport.sportivi.incompleteHidden');
  });
});
