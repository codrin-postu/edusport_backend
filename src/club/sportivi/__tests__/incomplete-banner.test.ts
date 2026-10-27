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

describe('banner wiring (source)', () => {
  it('Notice renders the close button only when onDismiss is set', () => {
    const notice = source('admin/ui/Notice.tsx');
    expect(notice).toContain('onDismiss?: () => void');
    expect(notice).toMatch(/onDismiss &&[\s\S]*aria-label="Închide"[\s\S]*onClick=\{onDismiss\}/);
    expect(notice).toContain('iconOnly');
  });
  it('a notice without a title is centred', () => {
    expect(source('admin/ui/Notice.tsx')).toContain('ui-notice--plain');
    expect(source('admin/ui/styles.ts')).toMatch(/\.ui-notice--plain\{align-items:center\}/);
  });
  it('IncompleteBanner passes onDismiss and keeps the dismissal in sessionStorage', () => {
    const bar = source('admin/dashboard/sportivi/ListToolbar.tsx');
    expect(bar).toContain('onDismiss={');
    expect(bar).toContain('INCOMPLETE_HIDDEN_KEY');
    expect(bar).toContain('sessionStorage');
  });
});
