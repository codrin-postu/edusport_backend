import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const source = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');

describe('the general calendar (7.2, W18)', () => {
  const editor = source('plugins/component-preview/admin/src/ProgramOverviewEditor.tsx');
  const model = source('plugins/component-preview/admin/src/calendar/model.ts');
  const drawer = source('plugins/component-preview/admin/src/calendar/EventDrawer.tsx');

  it('reads the admin occurrences route, so non-public groups show too', () => {
    expect(editor).toContain('/api/club/calendar/occurrences');
    expect(editor).not.toContain("fetch(`/api/calendar/occurrences");
  });

  it('group events read "<ora> <grupă>" and open the group date panel with "Deschide grupa"', () => {
    expect(model).toContain('o.groupName');
    expect(editor).toContain('<DatePanel');
    expect(editor).toContain('groupPageTo');
    expect(editor).toContain('o.groupId');
  });

  it('new events no longer offer "Școala de patinaj"', () => {
    expect(model).toContain('NEW_EVENT_CATEGORY_OPTIONS');
    expect(drawer).toContain('NEW_EVENT_CATEGORY_OPTIONS');
  });
});
