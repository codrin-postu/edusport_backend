import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ui = (file: string): string => readFileSync(join(process.cwd(), 'src/admin/ui', file), 'utf8');

describe('icon-only controls show a native tooltip', () => {
  it('Button falls back to its aria-label for the title', () => {
    expect(ui('Button.tsx')).toContain("title={rest.title ?? rest['aria-label']}");
  });

  it.each([
    ['DateInput.tsx', 'aria-label="Alege data" title="Alege data"'],
    ['TimeInput.tsx', 'aria-label="Alege ora" title="Alege ora"'],
    ['NumberInput.tsx', "title={`Crește ${label ?? 'valoarea'}`}"],
    ['NumberInput.tsx', "title={`Scade ${label ?? 'valoarea'}`}"],
    ['RepeatableList.tsx', 'title={`Mută ${name}`}'],
    ['SearchableSelect.tsx', "title={open ? 'Închide lista' : 'Deschide lista'}"],
    ['Pager.tsx', 'title="Pagina anterioară"'],
  ])('%s sets the title next to the aria-label', (file, snippet) => {
    expect(ui(file)).toContain(snippet);
  });

  it('every ui-iconbtn in the shared components carries a title', () => {
    for (const file of ['RepeatableList.tsx', 'SearchableSelect.tsx']) {
      const tags = ui(file).match(/<button[^>]*ui-iconbtn[\s\S]*?>/g) ?? [];
      expect(tags.length).toBeGreaterThan(0);
      for (const tag of tags) expect(tag).toContain('title=');
    }
  });
});
