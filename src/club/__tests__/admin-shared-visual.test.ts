import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const source = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');
const css = source('admin/ui/styles.ts');

it('a scrolling table holds its screen-reader-only header text, so the page never scrolls sideways', () => {
  expect(css).toContain('.ui-table-wrap{position:relative;overflow-x:auto}');
  expect(source('admin/dashboard/SubmissionTable.tsx')).toContain('.ui-root .sbt-sheetwrap{position:relative;overflow-x:auto;');
});

it('the desktop window of a BottomSheet has the same X as the phone sheet (proto v5)', () => {
  const sheet = source('admin/ui/BottomSheet.tsx');
  expect(sheet).toContain('headerExtra={<CloseButton dismissable={dismissable} onClose={props.onClose} />}');
  expect(sheet).toContain('<CloseButton dismissable={dismissable} onClose={onClose} />');
});

it('the save bar mark is the warning triangle, not a round "!" (no circles except the spinner)', () => {
  expect(source('admin/ui/SaveBarView.tsx')).toContain('{isSaving ? <Spin /> : <IconWarning size={16} />}');
  const icon = css.match(/\.ui-savebar-icon\{([^}]*)\}/);
  expect(icon?.[1]).not.toContain('border-radius');
});

it('the page back link is a primary link, as in the prototype', () => {
  expect(css).toContain('.ui-ph-back{display:inline-flex;align-items:center;gap:var(--ui-space-1);font-size:var(--ui-fs-body);font-weight:600;color:var(--theme-primary);');
});

it('Înscrieri with the panel open: every list column fits (prototype split padding, wrapping headers, badges hug)', () => {
  const ins = source('admin/dashboard/inscrieri/styles.ts');
  expect(source('admin/dashboard/SubmissionTable.tsx')).toContain("<div className={cx('sbt-split', selected && 'sbt-split--panel')}>");
  expect(ins).toContain('@media (min-width:1041px){.ui-root .sbt-split--panel .sbt-clist th,.ui-root .sbt-split--panel .sbt-clist td{padding-left:8px;padding-right:8px}');
  expect(ins).toContain('.ui-root .sbt-tag{min-width:0}');
  expect(ins).toContain('.ui-root .sbt-clist td.ins-school{white-space:normal;line-height:1.25}');
});

it('Înscrieri panel: the four tabs fit 360px, the card comparison wraps its cells (proto v5)', () => {
  const ins = source('admin/dashboard/inscrieri/styles.ts');
  expect(ins).toContain('.ui-root .ins-tabs .ui-tab{padding:9px 8px}');
  expect(ins).toContain('.ui-root .ins-mcard .ins-cmp{table-layout:fixed;font-size:11.5px}');
  expect(ins).toContain('.ui-root .ins-mcard .ins-cmp td{overflow-wrap:anywhere}');
});

it('list toolbar on phones: the season select keeps its text, "Sortare:" stays with its select, the search shows a magnifier', () => {
  const table = source('admin/dashboard/SubmissionTable.tsx');
  expect(table).toContain('@media (max-width:640px){.ui-root .sbt-season{flex-wrap:wrap}.ui-root .sbt-season .ui-input{flex:none}.ui-root .sbt-stat{text-align:left}}');
  expect(table).toContain('<span className="sbt-sort">');
  expect(table).toMatch(/<div className="ui-table-search sbt-search">\s+<IconSearch size=\{14\} \/>/);
});
