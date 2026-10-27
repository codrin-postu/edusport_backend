import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const COPY_DIR = new URL('../copy/', import.meta.url);
const FORBIDDEN = /[—–·„”“]|\p{Extended_Pictographic}/u;
const files = readdirSync(COPY_DIR).filter((f) => f.endsWith('.ts'));

describe('presence copy', () => {
  it('has no em or en dash, middle dot, curly quotes or emoji', () => {
    for (const f of files) {
      expect(readFileSync(new URL(f, COPY_DIR), 'utf8'), f).not.toMatch(FORBIDDEN);
    }
  });

  it('copy.ts re-exports every copy module, one line each', () => {
    const barrel = readFileSync(new URL('../copy.ts', import.meta.url), 'utf8');
    const exported = barrel.split('\n').filter((l) => l.startsWith('export * from'));
    expect(exported).toEqual(files.map((f) => `export * from './copy/${f.replace(/\.ts$/, '')}';`));
  });
});
