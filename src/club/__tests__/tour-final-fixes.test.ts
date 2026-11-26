import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');

function adminFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const full = join(dir, n);
    if (statSync(full).isDirectory()) return adminFiles(full);
    return /\.(ts|tsx)$/.test(n) ? [full] : [];
  });
}

describe('admin API paths', () => {
  it('no admin file sends a getFetchClient path that starts with /club/', () => {
    const bad = adminFiles(join(__dirname, '..', '..', 'admin')).filter((f) => /\.(get|post|put|patch|del|delete)\(\s*['"`]\/club\//.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });

  it('the tour, switches and Funcții page use /api/club', () => {
    expect(read('admin/tour/progressStore.ts')).toContain("'/api/club/onboarding'");
    expect(read('admin/lib/useFeatures.ts')).toContain("'/api/club/features'");
    expect(read('admin/pages/FunctiiPage.tsx')).toContain("'/api/club/features'");
  });
});

describe('leaving a flow', () => {
  const src = read('admin/tour/TourRoot.tsx');
  it('releases the unsaved guards, then navigates, and uninstalls the fetch guard after the route change', () => {
    const leave = src.slice(src.indexOf('function leaveToPrimiiPasi'));
    expect(leave.indexOf('releaseUnsavedGuards()')).toBeGreaterThan(-1);
    expect(leave.indexOf('releaseUnsavedGuards()')).toBeLessThan(leave.indexOf('spaNavigate(PRIMII_PASI_TO)'));
    const send = src.slice(src.indexOf('const send = React.useCallback'));
    expect(send.indexOf('handleEffect(prev, effect)')).toBeLessThan(send.indexOf('uninstallAfterRoute()'));
    expect(src).not.toMatch(/setTimeout\(/);
    expect(src).toMatch(/canReleaseGuard\(\{ pathname: window\.location\.pathname[^}]*\}\)\) \{\s*stop\(\);\s*uninstallFetchGuard\(\)/);
    expect(src).toMatch(/stopWatching\?\.\(\);\s*uninstallFetchGuard\(\)/);
  });
  it('never calls spaNavigate directly for the leave', () => {
    expect(src.match(/spaNavigate\(PRIMII_PASI_TO\)/g)).toHaveLength(1);
  });
});
