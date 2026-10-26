import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const src = readFileSync(join(__dirname, '..', '..', 'admin', 'dashboard', 'SubmissionTable.tsx'), 'utf8');

it('takes page extras: params in the list and export queries, meta, toolbar, list slot, bulk slot', () => {
  expect(src).toContain('export interface SubmissionTableExtras {');
  expect(src).toContain('export default function SubmissionTablePage({ cfg, extras }: { cfg: SubmissionTableCfg; extras?: SubmissionTableExtras })');
  expect(src.match(/Object\.assign\((params|p), JSON\.parse\(extraKey\) as Record<string, string>\);/g)).toHaveLength(2);
  expect(src).toContain('React.useEffect(() => setPage(1), [extraKey]);');
  expect(src).toContain('const meta = listMeta(body);');
  expect(src).toContain('onMetaRef.current?.(meta);');
  expect(src).toContain('{extras?.toolbar}');
  expect(src).toContain('{extras?.aboveList}');
  expect(src).toContain('{extras?.bulkActions?.([...selectedIds], () => {');
});

it('exposes the list meta and a refetch to the page renderers', () => {
  expect(src).toContain('pageMeta: Record<string, unknown>;');
  expect(src).toContain('refetch: () => void;');
  expect(src).toMatch(/const api: TableApi = \{[\s\S]*?pageMeta,[\s\S]*?refetch,[\s\S]*?\};/);
});

it('offers per-row status values; none shows the badge and hides the panel status box', () => {
  expect(src).toContain('statusMenu?: (row: Row) => readonly string[];');
  expect(src).toContain('if (options.length === 0) return statusTag(r);');
  expect(src).toContain('statusOptions(r).length === 0 ? null : (');
  expect(src).toContain('options={options.map((v) => ({ value: v, label: v }))}');
});

it('renders sortable compact headers and keeps the Sortare select on its own options', () => {
  expect(src).toContain('headers: CompactHeader[] | ((api: TableApi) => CompactHeader[]);');
  expect(src).toContain('function CompactTh(');
  expect(src).toContain('<CompactTh key={headerLabel(h)} header={h} sort={sort} onSort={sortBy} />');
  expect(src).toContain("value={sortOptions.some((o) => o.value === sort) ? sort : ''}");
  expect(src).toContain('const [sort, setSort] = React.useState<string>(\'newest\');');
});

it('has no em dash left in a quoted string (copy rule)', () => {
  expect(src).not.toMatch(/'[^'\n]*—[^'\n]*'/);
  expect(src).toContain('placeholder={emptyLabel ?? SEASON_EMPTY_LABEL}');
});
