import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const source = (p: string) => readFileSync(join(SRC, p), 'utf8');

describe('plan 4-6 final fixes, pinned in the source', () => {
  const steps = source('admin/pages/sezoane/NewSeasonSteps.tsx');
  const dialog = source('admin/pages/sezoane/NewSeasonDialog.tsx');
  const hook = source('admin/pages/sezoane/useNewSeason.ts');
  const editor = source('plugins/component-preview/admin/src/ProgramOverviewEditor.tsx');
  const programTab = source('admin/dashboard/grupe/ProgramTab.tsx');
  const calendar = source('admin/dashboard/grupe/GroupCalendar.tsx');

  it('I1: step 2 is one ui-table per section with the header ticks in the column heads, kids in a full-width row, phone cards', () => {
    for (const s of ['className="ui-table"', 'NEW_SEASON_COPY.colGroup', 'NEW_SEASON_COPY.colIn(', 'NEW_SEASON_COPY.childHeader', 'NEW_SEASON_COPY.childMainHeader(', 'colSpan={4}', 'phoneLine(', 'childPhoneLine(', 'phoneAllMembers', 'summaryParts', '<b key={i}>']) expect(steps, s).toContain(s);
    expect(steps).toMatch(/<th scope="col"><HeaderBox/);
    expect(steps).not.toContain('grp-ua-row');
  });

  it('I2: section headings, key/value rows and the step counter on the right', () => {
    expect(steps).toContain('ui-sec-title grp-sec');
    expect(steps).toContain('grp-kv grp-kv--rows');
    expect(dialog).toContain('aside={');
    expect(dialog).not.toMatch(/title=\{<>/);
    const css = source('admin/dashboard/grupe/styles.ts');
    expect(css).toContain('.grp-kv--rows{grid-template-columns:150px');
    expect(css).toContain('border-bottom:1px solid var(--theme-border-subtle)');
  });

  it('I3: an empty Program tab is an EmptyState with both buttons in one row, the hint under them, and a season-aware calendar', () => {
    expect(programTab).toContain('<EmptyState action={action}>');
    expect(programTab).toContain('grp-acts');
    expect(programTab.indexOf('grp-acts')).toBeLessThan(programTab.indexOf('{hint &&'));
    expect(programTab).toContain('seasonWindow(page.season?.label)');
    expect(programTab).toContain('season={season}');
    expect(calendar).toContain('calendarOpenDate(');
    expect(calendar).toContain('inSeasonWindow(');
    const roster = source('admin/dashboard/grupe/RosterTab.tsx');
    expect(roster.indexOf('NEW_SEASON_COPY.copyMembers(from.season)')).toBeLessThan(roster.indexOf('NEW_SEASON_COPY.copyMembersHint'));
  });

  it('I4: the general calendar draws one break chip per day from `blackouts` and drops the cancelled sessions', () => {
    for (const s of ['body?.blackouts', 'breakDaysIn(', 'withoutBlackoutSessions(', "type: 'vacanta'"]) expect(editor, s).toContain(s);
  });

  it('I5: the calendar reloads after a Pauză save or delete and after an undo', () => {
    expect(editor).toContain('useGrupeRefresh(() => setReloadKey');
    const breaks = source('admin/dashboard/program/useBreaks.ts');
    expect(breaks.match(/grupeChanged\(\)/g)?.length).toBe(2);
    expect(breaks).toContain('setFailed(false)');
  });

  it('I6: the group date panel is read-only for a past season, names the group, opens the date\'s season on Program, GRUPE_CSS loaded', () => {
    expect(editor).toContain('readOnly={groupDate.readOnly}');
    expect(editor).toContain('isPastSeasonDate(');
    expect(editor).toContain("groupPageTo(groupDate.o.groupId ?? '', seasonLabelOf(");
    expect(editor).toContain("'program')");
    expect(editor).toContain('groupName=');
    expect(source('admin/dashboard/grupe/DatePanel.tsx')).toContain('{p.groupName && <p className="spv-name">');
    expect(source('admin/dashboard/ProgramEditPage.tsx')).toContain('SPORTIVI_CSS + GRUPE_CSS');
    expect(source('admin/dashboard/program/BreakDialog.tsx')).toContain('className="grp-form"');
  });

  it('I7: after "Anulează" on the start toast Grupe opens on the current season', () => {
    expect(dialog).toContain('navigate(grupeListTo(null, null))');
  });

  it('I8: newest preview wins, pending blocks step 3 and the apply button, a retry clears the failure', () => {
    for (const s of ['latestGate()', 'gate.current.next()', 'gate.current.isLatest(id)', 'setPending(true)', 'setPending(false)', 'setFailed(null)']) expect(hook, s).toContain(s);
    expect(hook).toContain('pending, failed');
    expect(dialog).toContain('ns.preview && !ns.pending');
  });

  it('minors: no navigation after closing during the apply, Pauze delete error reset, bold season label', () => {
    expect(dialog).toContain('onClose={act.busy ? noop : onClose}');
    const pauze = source('admin/dashboard/program/PauzeSection.tsx');
    expect(pauze).toContain('setError(null)');
    expect(pauze).toContain('remove.clear()');
    expect(source('admin/pages/SezoanePage.tsx')).toContain('<span className="spv-name">{s.label}</span>');
  });
});
