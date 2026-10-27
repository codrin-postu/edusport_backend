import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const adminDir = join(__dirname, '..', '..', 'admin');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('no bounce scroll in the admin', () => {
  it('app.tsx injects one global overscroll-behavior: none rule', () => {
    const app = readFileSync(join(adminDir, 'app.tsx'), 'utf8');
    expect(app).toMatch(/html,\s*body,\s*\*\s*\{\s*overscroll-behavior:\s*none;?\s*\}/);
  });

  it('no admin source sets overscroll-behavior to contain or auto', () => {
    const offenders = walk(adminDir)
      .filter((f) => /\.(tsx?|css)$/.test(f))
      .filter((f) => /overscroll-behavior(-[xy])?\s*:\s*(contain|auto)/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
