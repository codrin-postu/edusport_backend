import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const dir = join(__dirname, '..', '..', 'admin', 'dashboard', 'inscrieri');
const read = (name: string) => readFileSync(join(dir, name), 'utf8');
const table = read('CompareTable.tsx');
const card = read('MatchCard.tsx');
const panel = read('RegistrationPanel.tsx');
const data = read('usePanelData.ts');

it('the card shows only while unconfirmed, above the tabs (spec 3.3)', () => {
  expect(panel).toContain('{showMatchCard(data.match) && data.match && <MatchCard view={data.match} />}');
  expect(panel.indexOf('<MatchCard')).toBeGreaterThan(panel.indexOf('<PanelHeader'));
  expect(panel.indexOf('<MatchCard')).toBeLessThan(panel.indexOf('<Tabs'));
});

it('card: initials, "Sportiv existent", last group, the last-season line, Compară / Ascunde, the record link', () => {
  expect(card).toContain('{initials(card.name)}');
  expect(card).toContain('{lastGroupText(card)}');
  expect(card).toContain('{view.notAttendedLastSeason && <span>{MATCH_COPY.notAttended}</span>}');
  expect(card).toContain('{open ? MATCH_COPY.hide : MATCH_COPY.compare}');
  expect(card).toContain('<CompareTable rows={view.comparison} />');
  expect(card).toContain('navigate(athleteRecordPath(card.documentId))');
});

it('table: light background only on differences, ticks only in the window on differing rows', () => {
  expect(table).toContain("className={r.differs ? 'is-diff' : undefined}");
  expect(table).not.toContain('<b>');
  expect(table).toContain('{ticks && (');
  expect(table).toContain('{r.differs && (');
  expect(table).toContain('label={CONFIRM_COPY.update}');
});

it('a failed match load never looks like "no match": a separate matchFailed flag shows the load error', () => {
  expect(data).toContain('matchFailed: boolean');
  expect(data).toContain('matchFailed: match.failed');
  expect(panel).toContain('{!linkedAthleteId(row) && data.matchFailed && <p className="ins-empty">{INSCRIERI_PENDING_COPY.loadFailed}</p>}');
});
