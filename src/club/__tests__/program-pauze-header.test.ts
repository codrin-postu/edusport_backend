import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(join(__dirname, '../../admin/dashboard', p), 'utf8');

describe('Program page Pauze', () => {
  const page = read('ProgramEditPage.tsx');
  const section = read('program/PauzeSection.tsx');

  it('"Adaugă pauză" lives in the page header actions', () => {
    expect(page).toMatch(/<PageHeader[^>]*actions=\{<AddPauzeButton/);
    expect(section).toContain('PAUZE_COPY.add');
    expect(section).not.toContain('headerAction');
  });

  it('the Pauze section is hidden while there are no breaks, its dialogs stay mounted', () => {
    expect(section).toContain('breaks.list.length === 0');
    expect(section).toContain('{!empty && <EditorCard');
    expect(section).toContain('<BreakDialog');
  });
});
