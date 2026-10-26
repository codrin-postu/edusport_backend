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
  expect(panel).toContain('onDone={afterConfirm}');
  expect(panel).toMatch(/const afterConfirm = \(\) => \{\s+setTab\('istoric'\);\s+api\.refetch\(\);/);
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
  expect(search).toContain('<mark className="ins-mark">{parts.match}</mark>');
  expect(win).not.toContain("s.mode === 'search'");
});

it('groups under their section, main group line and tick, A.C.S. lines, season note, intent (spec 4.3, 4.4)', () => {
  expect(season).toContain('options={groupChoices(ctx.groups)}');
  expect(season).toContain("onChange={(groupId) => dispatch({ type: 'group', groupId: groupId || null })}");
  expect(season).toContain('placeholder={CONFIRM_COPY.noGroup}');
  expect(season).toContain('label={CONFIRM_COPY.mainTick}');
  expect(season).toContain('{note ? <p className="ins-note">{note}</p> : <GroupAndAcs state={state} dispatch={dispatch} ctx={ctx} busy={busy} />}');
  expect(season).toContain('<p>{acs.status}</p>');
});

it('confirm and undo use a client that survives the window; one request per confirm; a saved one never reads as failed', () => {
  const client = read('useClient.ts');
  expect(client).toContain("import { getFetchClient, useFetchClient } from '@strapi/admin/strapi-admin';");
  expect(client).toContain('post: (url, data, config) => getFetchClient().post(url, data, config),');
  expect(hooks).toContain('const { post } = detachedClient;');
  expect(hooks).not.toContain('const { post } = useStableClient()');
  expect(hooks).toContain('if (!body || sending.current) return;');
  expect(hooks).toContain('sending.current = true;');
  expect(hooks).toContain('saved = dataOf<ConfirmResponse>(await post(CLUB_URLS.confirm(registrationId), body));');
  expect(hooks).toContain('if (saved) succeed(saved);');
  expect(win).toContain('if (ctx.data && !gate.disabled) void submit.run(state, ctx.data);');
});

it('while busy the body is locked; a stale context hides the comparison; a failed reload keeps the cards', () => {
  expect(athlete).toContain('disabled={busy} onClick={open}');
  expect(athlete).toContain('options={choiceOptions(ctx, notAttended)} disabled={busy}');
  expect(athlete).toContain('const comparable = !stale && ctx.comparison.length > 0;');
  expect(athlete).toContain('{failed && <Notice tone="danger">{INSCRIERI_PENDING_COPY.loadFailed}</Notice>}');
  expect(season).toContain('disabled={busy || !state.groupId}');
  expect(hooks).toContain('setState((s) => ({ data: s.data, loading: false, failed: true }))');
  expect(win).toContain('const stale = ctx.loading || ctx.failed;');
  expect(win).toContain('confirmGate(state, ctx.failed ? null : ctx.data, ctx.loading)');
});

it('a new query shows the loading state, not the old results; prototype v5 icons on the links', () => {
  expect(search).toContain('setState({ cards: null, failed: false });');
  expect(athlete).toContain('{open ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}');
  expect(athlete).toContain('<IconSearch size={12} />');
});
