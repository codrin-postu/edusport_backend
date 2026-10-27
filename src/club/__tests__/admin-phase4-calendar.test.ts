import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');

describe('empty group tabs (10.6, W31)', () => {
  const roster = source('admin/dashboard/grupe/RosterTab.tsx');
  const program = source('admin/dashboard/grupe/ProgramTab.tsx');

  it('Sportivi: "Niciun sportiv în <sezon>.", "Copiază sportivii din <sezon>", the hint, the toast with undo', () => {
    for (const s of ['page.copyFrom', 'NEW_SEASON_COPY.emptyMembers', 'NEW_SEASON_COPY.copyMembers', 'NEW_SEASON_COPY.copyMembersHint', 'NEW_SEASON_COPY.membersCopiedToast', 'api.copyMembers', 'writable(page)']) expect(roster, s).toContain(s);
  });

  it('Program: "Niciun program în <sezon>.", "Copiază programul din <sezon>" beside "Adaugă program", the hint, the toast', () => {
    for (const s of ['page.copyFrom', 'NEW_SEASON_COPY.emptyProgram', 'NEW_SEASON_COPY.copyProgram', 'NEW_SEASON_COPY.copyProgramHint', 'NEW_SEASON_COPY.programCopiedToast', 'api.copyProgram']) expect(program, s).toContain(s);
  });
});
