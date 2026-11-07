import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '../..');
const ADMIN = join(SRC, 'admin');
const CLUB = join(SRC, 'club');

/** Admin files that already import a server module before phase 11. New entries are refused in review. */
const KNOWN: string[] = [];

const FORBIDDEN_PACKAGES = ['@strapi/strapi', 'exceljs', 'pdfkit', 'knex'];

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : filesUnder(path);
    return /\.tsx?$/.test(name) && !name.endsWith('.d.ts') ? [path] : [];
  });
}

/** Specifiers of value imports and re-exports; `import type`, `export type` and all-`type` specifier lists are skipped. */
function valueImports(source: string): string[] {
  const out: string[] = [];
  const pattern = /(?:^|\n)\s*(import|export)\s+(type\s+)?([^'";]*?)\s*from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const m of source.matchAll(pattern)) {
    if (m[4] !== undefined) {
      if (m[2]) continue;
      const clause = m[3].trim();
      const braces = clause.match(/\{([^}]*)\}/);
      if (braces && !clause.replace(/\{[^}]*\}/, '').replace(/[,\s*]|as\s+\w+/g, '')) {
        const specs = braces[1].split(',').map((s) => s.trim()).filter(Boolean);
        if (specs.length > 0 && specs.every((s) => s.startsWith('type '))) continue;
      }
      out.push(m[4]);
    } else out.push(m[5] ?? m[6]);
  }
  return out;
}

function resolveLocal(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(from), spec);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function forbidden(spec: string): boolean {
  if (spec.startsWith('node:')) return true;
  if (FORBIDDEN_PACKAGES.some((p) => spec === p || spec.startsWith(`${p}/`))) return true;
  return spec.includes('strapi-store') || spec.includes('club/files/');
}

const rel = (p: string): string => relative(SRC, p);

/** For every admin file, the first chain that reaches a forbidden import inside src/club. */
export function violations(adminFiles: string[]): { adminFile: string; chain: string[] }[] {
  const found: { adminFile: string; chain: string[] }[] = [];
  for (const adminFile of adminFiles) {
    const seen = new Set<string>();
    const walk = (file: string, chain: string[], inClub: boolean): string[] | null => {
      for (const spec of valueImports(readFileSync(file, 'utf8'))) {
        const target = resolveLocal(file, spec);
        const bad = forbidden(spec) || (target !== null && forbidden(rel(target)));
        if (bad && inClub) return [...chain, spec];
        if (!target || seen.has(target) || !target.startsWith(CLUB)) continue;
        seen.add(target);
        if (forbidden(rel(target))) return [...chain, rel(target)];
        const deeper = walk(target, [...chain, rel(target)], true);
        if (deeper) return deeper;
      }
      return null;
    };
    const chain = walk(adminFile, [rel(adminFile)], false);
    if (chain) found.push({ adminFile: rel(adminFile), chain });
  }
  return found;
}

describe('admin bundle imports (11-1 T1)', () => {
  it('reaches no server module through src/club', () => {
    const bad = violations(filesUnder(ADMIN)).filter((v) => !KNOWN.includes(v.adminFile));
    expect(bad.map((v) => `${v.adminFile}: ${v.chain.join(' -> ')}`)).toEqual([]);
  });

  it('reads value imports only and flags server modules', () => {
    const source = valueImports("import { x } from '../club/presence/strapi-store';\nimport type { Y } from 'exceljs';\nimport { type Z } from 'knex';");
    expect(source).toEqual(['../club/presence/strapi-store']);
    expect(forbidden('../club/presence/strapi-store')).toBe(true);
  });
});
