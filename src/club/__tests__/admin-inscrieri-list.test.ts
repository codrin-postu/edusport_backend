import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const root = join(__dirname, '..', '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const page = read('src', 'admin', 'dashboard', 'InscrieriPage.tsx');
const controls = read('src', 'admin', 'dashboard', 'inscrieri', 'ListControls.tsx');
const css = read('src', 'admin', 'dashboard', 'inscrieri', 'styles.ts');
const checker = read('scripts', 'admin-ui-check.mjs');

it('list cells: number, date, name with the "Sportiv existent" line, school, age, status, parent, wish', () => {
  expect(page).toContain('headers: (api) => compactHeaders(readListMeta(api.pageMeta).multipleSchools)');
  expect(page).toContain('{showsExistingLine(r) && (');
  expect(page).toContain('{multiple && <td className="ins-school">{cellText(r.schoolName)}</td>}');
  expect(page).toContain('<td className="ui-num">{ageText(r.age)}</td>');
  expect(page).toContain('<td>{wishText(r.membershipAnswer)}</td>');
});

it('uses the spec search placeholder, the status menu without "Confirmat" and "Nume sportiv" everywhere', () => {
  expect(page).toContain('searchPlaceholder: LIST_COPY.searchPlaceholder');
  expect(page).toContain('statusMenu: statusMenuValues');
  expect(page).not.toContain('Nume copil');
  expect(page).toContain("{ key: 'age', label: 'Vârstă', type: 'text', readOnly: true, width: 90, render: (row) => ageText(row.age) }");
  expect(page).toContain('colConfigVersion: 2');
});

it('opens one registration from ?open=<documentId> (plan 3-5 links), else the filtered list', () => {
  expect(page).toContain('const open = readOpenParam(useLocation().search);');
  expect(page).toContain('params: open ? openListParams(open) : listParams(existing, school, meta)');
});

it('passes the filter, the school tabs and the bulk move as table extras', () => {
  expect(page).toContain('params: open ? openListParams(open) : listParams(existing, school, meta)');
  expect(page).toContain('toolbar: <ExistingFilter value={existing} onChange={setExisting} />');
  expect(page).toContain('{open && <BackToList />}');
  expect(page).toContain('<SchoolTabs meta={meta} value={school} onChange={setSchool} />');
  expect(page).toContain('bulkActions: meta.multipleSchools ? (ids, done) => <BulkMoveSchool ids={ids} meta={meta} done={done} /> : undefined');
  expect(controls).toContain('if (!meta.multipleSchools) return null;');
  expect(controls).toContain('placeholder={LIST_COPY.all}');
});

it('the bulk move outlives the bar: unticking rows mid-move neither aborts it nor skips the list reload', () => {
  expect(controls).toContain('await moveSchool(detachedClient.post, CLUB_URLS.moveSchoolBulk');
  expect(controls).not.toContain('useStableClient');
  expect(page).toContain('(ids, done) => <BulkMoveSchool ids={ids} meta={meta} done={done} />');
  expect(controls).toContain('placeholder={LIST_COPY.pickSchool} options={moveTargets(meta, null)}');
});

it('keeps rows one height and colours on tokens; the inscrieri folder is held to the colour rule', () => {
  expect(css).toContain('.ui-root .sbt-clist td{height:50px;padding-top:0;padding-bottom:0}');
  expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|dashed|dotted|border-radius:(?!var\(--ui-radius-)/i);
  expect(css).not.toContain('`');
  expect(checker).toContain("join(ADMIN, 'dashboard', 'inscrieri') + sep");
});
