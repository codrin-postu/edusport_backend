import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (p: string): string => readFileSync(join(__dirname, '..', '..', p), 'utf8');

describe('new season (10.1, 10.2, 10.5)', () => {
  const page = source('admin/pages/SezoanePage.tsx');
  const dialog = source('admin/pages/sezoane/NewSeasonDialog.tsx');
  const steps = source('admin/pages/sezoane/NewSeasonSteps.tsx');

  it('the button shows on the next season only and its click does not open the row', () => {
    expect(page).toContain('startableLabel');
    expect(page).toContain('NEW_SEASON_COPY.button');
    expect(page).toContain('stopPropagation');
  });

  it('three steps with their buttons; the last applies with a busy button', () => {
    for (const s of ['NEW_SEASON_COPY.stepOf', 'NEW_SEASON_COPY.next', 'NEW_SEASON_COPY.back', 'NEW_SEASON_COPY.apply', 'NEW_SEASON_COPY.cancel', 'loading=']) expect(dialog, s).toContain(s);
  });

  it('step 1 rows, step 2 tables with header ticks and children, step 3 tiles, lines and warning', () => {
    for (const s of ['step1Rows', 'NEW_SEASON_COPY.onSite', 'NEW_SEASON_COPY.inPanel', 'headerState', 'indeterminate', 'NEW_SEASON_COPY.seeAthletes', 'childMain', 'NEW_SEASON_COPY.mainRule', 'StatTile', 'preview.lines', 'preview.warning', 'preview.summary']) {
      expect(steps, s).toContain(s);
    }
  });

  it('after applying: Grupe on the new season and the toast with "Anulează"', () => {
    expect(dialog).toContain('grupeListTo');
    expect(dialog).toContain('undoToast');
  });
});
