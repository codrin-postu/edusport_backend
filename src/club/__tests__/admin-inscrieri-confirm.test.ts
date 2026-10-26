import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const dir = join(__dirname, '..', '..', 'admin', 'dashboard', 'inscrieri');
const read = (...p: string[]) => readFileSync(join(dir, ...p), 'utf8');
const panel = read('RegistrationPanel.tsx');
const win = read('ConfirmWindow.tsx');
const hooks = read('confirm', 'useConfirm.ts');
const athlete = read('confirm', 'AthletePart.tsx');
const search = read('confirm', 'AthleteSearch.tsx');
const season = read('confirm', 'SeasonPart.tsx');

it('the panel opens the window once the match data is in', () => {
  expect(panel).toContain('onConfirm={data.match ? () => setConfirming(true) : undefined}');
  expect(panel).toContain('{confirming && data.match && (');
  expect(panel).toContain('onDone={api.refetch}');
});

it('a Modal on desktop, a full-height bottom sheet on phones (spec 4.8)', () => {
  expect(win).toContain('desktop="modal"');
  expect(win).toContain('modalSize="md"');
  expect(win).toContain('fullHeight');
  expect(win).toContain('title={CONFIRM_COPY.title(cellText(row.registrationNumber))}');
  expect(win).toContain('React.useReducer(windowReducer, view, initialWindow)');
  expect(win).toContain('{gate.hint && <span className="ins-foot-hint">{gate.hint}</span>}');
});

it('toast with "Anulează" only, 8 seconds; the undo outlives the panel; 409 closes and reloads', () => {
  expect(hooks).toContain('duration: CONFIRM_TOAST_MS, action: { label: CONFIRM_COPY.undo, onClick: undo }');
  expect(hooks).toContain('const undo = () => void runUndo(post, registrationId).then(onDone);');
  expect(hooks).toContain('if (!failure.close) return;');
  expect(hooks).toContain('await post(CLUB_URLS.confirm(registrationId), body)');
});

it('choice cards, compare with ticks, search in place, "Vezi fișa" in the same tab (spec 4.1, 4.2)', () => {
  expect(athlete).toContain('variant="card"');
  expect(athlete).toContain('value={state.choice}');
  expect(athlete).toContain('<CompareTable rows={ctx.comparison} ticks={ticks} />');
  expect(athlete).toContain('navigate(athleteRecordPath(card.documentId))');
  expect(search).toContain('placeholder={CONFIRM_COPY.searchPlaceholder}');
  expect(search).toContain('{CONFIRM_COPY.noResults(text)}');
  expect(search).toContain('{cardDetailLine(card)}');
});

it('groups under their section, main group line and tick, A.C.S. lines, season note, intent (spec 4.3, 4.4)', () => {
  expect(season).toContain('options={groupChoices(ctx.groups)}');
  expect(season).toContain('placeholder={CONFIRM_COPY.noGroup}');
  expect(season).toContain('label={CONFIRM_COPY.mainTick}');
  expect(season).toContain('{note ? <p className="ins-note">{note}</p> : <GroupAndAcs state={state} dispatch={dispatch} ctx={ctx} />}');
  expect(season).toContain('<p>{acs.status}</p>');
});
