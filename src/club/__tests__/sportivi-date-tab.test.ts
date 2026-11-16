import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = (rel: string) => readFileSync(join(__dirname, '../..', rel), 'utf8');
const dateTab = src('admin/dashboard/sportivi/DateTab.tsx');
const access = src('admin/dashboard/sportivi/AccessBlock.tsx');
const insTab = src('admin/dashboard/inscrieri/DateTab.tsx');
const recordView = src('club/sportivi/record-view.ts');
const accessCopy = src('club/portal/access/copy.ts');
const css = src('admin/dashboard/sportivi/styles.ts');

describe('Sportivi record Date tab', () => {
  it('has a "Date" card header with Editează at the right edge, and Salvează / Renunță there in edit mode', () => {
    expect(dateTab).toContain('<EditorCard');
    expect(dateTab).toContain('title={RECORD_COPY.tabs.date}');
    expect(dateTab).toContain('headerAction=');
    expect(dateTab).toContain('RECORD_COPY.edit');
    expect(dateTab).toContain('RECORD_COPY.save');
    expect(dateTab).toContain('RECORD_COPY.cancel');
    expect(recordView).toContain("cancel: 'Renunță'");
    expect(dateTab).not.toContain('spv-actions');
    expect(dateTab).not.toContain('useRecordFooter');
  });
  it('has no "Obligatorii pentru" line', () => {
    expect(recordView).not.toContain('Obligatorii pentru');
    expect(recordView).not.toContain('requiredHint');
    expect(dateTab).not.toContain('requiredHint');
  });
  it('stars the required fields in edit mode and keeps the missing marker in the read view', () => {
    expect(dateTab.match(/<Field [^>]*\brequired\b/g)?.length).toBe(5);
    expect(dateTab).toContain('spv-missing');
  });
  it('shows "Membru A.C.S. <sezon>" as a field of the grid, not a side line', () => {
    expect(recordView).toContain('Membru A.C.S. ${');
    expect(dateTab).not.toContain('spv-line');
    expect(dateTab).toContain('acsField');
  });
});

describe('Acces portal block', () => {
  it('has a header row, the e-mail, the badge and the button at the right edge', () => {
    expect(access).toContain('<EditorCard');
    expect(access).toContain("TITLE = 'Acces portal'");
    expect(access).toContain('accessBadge(');
    expect(access).toContain('<StatusBadge');
    expect(access).toContain('spv-access');
    expect(access.indexOf('block.email')).toBeLessThan(access.indexOf('<StatusBadge'));
    expect(access.indexOf('<StatusBadge')).toBeLessThan(access.indexOf('spv-access-acts'));
  });
  it('has no "Fără acces în portal." line', () => {
    expect(accessCopy).not.toContain('Fără acces în portal');
    expect(access).not.toContain('block.hint');
  });
  it('drops the button to its own full-width line on a phone', () => {
    expect(css).toMatch(/@media \(max-width: 640px\)\{[\s\S]*\.spv-access-acts\{[^}]*width:100%/);
  });
});

describe('Înscrieri detail panel header', () => {
  it('puts Editează in a header row, not beside the e-mail field', () => {
    expect(insTab).not.toContain('EditLabel');
    expect(insTab).toContain('ins-date-head');
    expect(insTab).toContain('PANEL_COPY.edit');
  });
});
