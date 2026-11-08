import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import tables from '../../../api/club/controllers/tables';
import tableRoutes from '../../../api/club/routes/13-tables';
import { areaOfRoute } from '../../admin-area';

const SRC = join(__dirname, '../../..');
const routes = tableRoutes.routes;
const source = readFileSync(join(SRC, 'api/club/controllers/tables.ts'), 'utf8');

function staticBeforeParams(paths: string[]): boolean {
  const prefixes = [...new Set(paths.map((p) => p.split('/').slice(0, 3).join('/')))];
  return prefixes.every((prefix) => {
    const own = paths.filter((p) => p.startsWith(`${prefix}/`) || p === prefix);
    const firstParam = own.findIndex((p) => p.includes(':'));
    return firstParam < 0 || own.slice(firstParam).every((p) => p.includes(':'));
  });
}

describe('13-tables routes', () => {
  it('are exactly the table routes, in order', () => {
    expect(routes.map((r) => `${r.method} ${r.path} ${r.handler}`)).toEqual([
      'GET /club/tables/catalog tables.catalog', 'POST /club/tables/query tables.query', 'POST /club/tables/export tables.export',
      'GET /club/table-views tables.views', 'POST /club/table-views tables.createView',
      'PUT /club/table-views/:documentId tables.updateView', 'DELETE /club/table-views/:documentId tables.deleteView',
    ]);
  });

  it('every route is adminRoute money, and every handler exists', () => {
    for (const r of routes) {
      expect(areaOfRoute(r.config), r.path).toBe('money');
      expect(typeof (tables as Record<string, unknown>)[r.handler.split('.')[1]], r.handler).toBe('function');
    }
    expect(source).not.toMatch(/areaOfRoute|adminGuard/);
  });

  it('declare fixed paths before parameter paths', () => {
    expect(staticBeforeParams(routes.map((r) => r.path))).toBe(true);
  });
});

describe('the tables controller (source)', () => {
  it('limits queries and exports, starts the budget inside the limiter, and logs downloads', () => {
    expect(source).toContain('exportLimit(');
    expect(source).toContain('startBudget(10_000');
    expect(source).toContain('downloadLogLine(');
    expect(source).toContain("'tables-xlsx'");
    expect(source).toContain("'tables-csv'");
    expect(source.match(/startBudget\(/g)?.length).toBe(1);
  });

  it('sends both content types and names the files from the file-name helpers', () => {
    expect(source).toContain("'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'");
    expect(source).toContain("'text/csv; charset=utf-8'");
    expect(source).toMatch(/xlsxName\(/);
    expect(source).toMatch(/csvName\(/);
  });

  it('reads through the stores only (no strapi.db.query), builds the views store per request, and passes the verified admin to the log', () => {
    expect(source).not.toContain('strapi.db.query');
    expect(source).toMatch(/strapiTableViewStore\(strapi\)/);
    expect(source).not.toMatch(/^const \w+ = strapiTableViewStore/m);
    expect(source).toContain('verifiedAdminId(');
    expect(source).toContain('callerOf(');
  });

  it('names the files and the xlsx sheet after the view name from the body', () => {
    expect(source).toMatch(/csvName\(table\.subject, today, request\.data\.name\)/);
    expect(source).toMatch(/xlsxName\(table\.subject, today, request\.data\.name\)/);
    expect(source).toMatch(/tableXlsx\(table, request\.data\.name \?\? CATALOG\[table\.subject\]\.label\)/);
  });

  it('the download log line carries no names and no file names', () => {
    const lines = source.split('\n').filter((l) => l.includes('downloadLogLine('));
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l).not.toMatch(/name|filename|email/i);
  });

  it('has no xlsx gate: the xlsx download is always served', () => {
    expect(source).not.toMatch(/XLSX_READY|TABLES_NO_XLSX|501/);
  });
});
